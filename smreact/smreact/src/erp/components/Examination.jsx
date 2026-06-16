import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import * as examService from '../services/examService';
import useAsync from '../hooks/useAsync';
import { buildUrl } from '../../utils/apiConfig';
/* ═══════════════════════════════════════════════════════════════════
   EXAMINATION — port of the HTML #module-exam (only Exam Setup is
   functional; other tabs show Coming Soon).
   Source: ~/Desktop/ERP-HTML/Final_Submissions_with_Examination_3 (43).html
   ═══════════════════════════════════════════════════════════════════ */

const EXAM_TERMS = ['2nd', '3rd Term', '5th Term', 'testing', 'combined'];

const ALL_CLASSES = [
  'class 1A (B)', 'class 1A (C)', 'class 1A (D)', 'class 1A (Green f)',
  'class 1A (New)', 'II-Pre (A)', 'III-Pre (2)', 'Marketing Class (A)',
  'Class IV', 'Class V', 'Class VI', 'Class VII', 'Class VIII',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A',
  'Grade 4 - Section A', 'Grade 5 - Section A',
];

/* Exams now load via examService (src/services/examService.js). Add/edit/delete
   are still in-memory until backend wires the mutation endpoints. */

/* ── Date Sheet subject vocabulary + seed ── */
const ALL_SUBJECTS = [
  'English', 'Urdu', 'Mathematics', 'Science', 'Islamiyat',
  'Social Studies', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'Pak Studies', 'Arabic', 'History', 'Geography', 'Art & Drawing',
];
/* ── Syllabus seed (HTML #syllabusData) ── */
/* Syllabus now loads via examService.getSyllabus(). */
function sylClassStatus(data) {
  if (!data || !data.length) return { label:'Not Added', cls:'notadded', icon:'fa-circle-xmark' };
  const withContent = data.filter(s => s.content && s.content.replace(/<[^>]+>/g,'').trim().length > 0);
  if (withContent.length === 0)            return { label:'Not Added',       cls:'notadded', icon:'fa-circle-xmark' };
  if (withContent.length === data.length)  return { label:'Added',           cls:'added',    icon:'fa-circle-check' };
  return                                          { label:'Partially Added', cls:'partial',  icon:'fa-circle-half-stroke' };
}

/* Date sheets now load via examService.getDateSheets(). */

/* ── Helpers ── */
function parseDDMMYYYY(s) {
  if (!s) return null;
  
  // If it's already a Date object
  if (s instanceof Date) return s;
  
  // Handle ISO format (YYYY-MM-DD)
  if (s.includes('-')) {
    const [y, m, d] = s.split('T')[0].split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  
  // Handle DD/MM/YYYY format
  const [d, m, y] = s.split('/');
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}


function inputToDDMMYYYY(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}
function ddmmyyyyToInput(s) {
  if (!s) return '';
  const [d, m, y] = s.split('/');
  return `${y}-${m}-${d}`;
}
function getExamStatus(ex) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = parseDDMMYYYY(ex.from);
  const end   = parseDDMMYYYY(ex.to);
  if (!start) return { label: 'Upcoming', cls: 'upcoming', icon: 'fa-clock' };
  if (today < start) return { label: 'Upcoming', cls: 'upcoming', icon: 'fa-clock' };
  if (!end || today <= end) return { label: 'Current', cls: 'current', icon: 'fa-circle-dot' };
  return { label: 'Past', cls: 'past', icon: 'fa-flag-checkered' };
}
function calcDuration(from, to) {
  if (!from || !to) return '—';
  
  // Parse dates that could be in either ISO format or DD/MM/YYYY format
  const parseDate = (dateStr) => {
    // If it's already a Date object
    if (dateStr instanceof Date) return dateStr;
    
    // Try ISO format (YYYY-MM-DD)
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('T')[0].split('-');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    
    // Try DD/MM/YYYY format
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    
    // Try creating Date directly as fallback
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };
  
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  
  if (!fromDate || !toDate) return '—';
  
  const diff = Math.round((toDate - fromDate) / 86400000);
  const days = diff + 1;
  
  return days + ' Day' + (days !== 1 ? 's' : '');
}
/* Result Setup grades / signatures / remarks now load via examService. */
const RS_GRADE_LIST = ['A+','A','B+','B','C+','C','D','E','F'];
const RS_COND_LIST = [
  { v:'gte',     l:'Greater than or equal to (>=)' },
  { v:'gt',      l:'Greater than (>)' },
  { v:'lte',     l:'Less than or equal to (<=)' },
  { v:'lt',      l:'Less than (<)' },
  { v:'eq',      l:'Equal to (=)' },
  { v:'between', l:'Between' },
];
const RS_COND_MAP = { gte:'≥', gt:'>', lte:'≤', lt:'<', eq:'=', between:'~' };
const RS_GRADE_COLORS = {
  'A+':'#16A34A', 'A':'#0284C7', 'B+':'#2563EB', 'B':'#6366F1',
  'C+':'#7C3AED', 'C':'#D97706', 'D':'#EA580C',  'E':'#9333EA', 'F':'#DC2626',
};

/* Result Card Options now load via examService.getRcoGeneral() / getRcoSig(). */
/* ── Result Card preview seed data + helpers ── */
const RES_SUBJECTS = [
  'English','Urdu','Mathematics','Science','Islamiyat',
  'Computer','Social Studies','Quran','Art & Craft','Physical Education',
];
const RC_GRADE_SETUP = [
  { min:90, grade:'A+', comment:'Excellent Work Done' },
  { min:80, grade:'A',  comment:'Very Good Work Done' },
  { min:70, grade:'B',  comment:'Good Work Done' },
  { min:60, grade:'C',  comment:'Satisfactory Work Done' },
  { min:50, grade:'D',  comment:'Needs Improvement' },
  { min:0,  grade:'F',  comment:'Unsatisfactory' },
];
const RC_FINAL_REMARKS_SETUP = [
  { min:90, remark:'Outstanding performance. Keep it up. Wishing you continued success.' },
  { min:80, remark:'Very Good Work Done. Keep Working Hard to Maintain Your Position.' },
  { min:70, remark:'Good Work Done. Keep Working Hard to Maintain Your Position.' },
  { min:60, remark:'Satisfactory performance. Work harder to improve your grades.' },
  { min:50, remark:'Needs improvement. Please focus more on your studies.' },
  { min:0,  remark:'Unsatisfactory performance. Please consult your teachers for guidance.' },
];
function rcGetGrade(obt, tot) {
  if (!tot || !obt) return null;
  const pct = (obt / tot) * 100;
  return RC_GRADE_SETUP.find(g => pct >= g.min) || RC_GRADE_SETUP[RC_GRADE_SETUP.length - 1];
}
function rcGetFinalRemarks(pct) {
  return (RC_FINAL_REMARKS_SETUP.find(r => pct >= r.min) || RC_FINAL_REMARKS_SETUP[RC_FINAL_REMARKS_SETUP.length - 1]).remark;
}

const SAMPLE_RC_STUDENT = {
  id: 1, rollNo: '245-00072', name: 'Ali Khan', father: 'Ahmed Khan',
  obtained: {
    English:18, Urdu:16, Mathematics:20, Science:17, Islamiyat:14,
    Computer:0, 'Social Studies':0, Quran:16, 'Art & Craft':18, 'Physical Education':19,
  },
  absentSubjects: ['Computer', 'Social Studies'],
  attendance: '92%',
};
const SAMPLE_RC_RD = {
  totalMarks: {
    English:20, Urdu:20, Mathematics:20, Science:20, Islamiyat:20,
    Computer:20, 'Social Studies':20, Quran:20, 'Art & Craft':20, 'Physical Education':20,
  },
};
const SAMPLE_RC_EX = { name: 'Term Examination', classes: ['Class V (A)'] };
/* ── Single Assessment Result — sample seed ── */
const RES_DEFAULT_TOTALS = {
  English:20, Urdu:20, Mathematics:20, Science:20, Islamiyat:20,
  Computer:20, 'Social Studies':20, Quran:20, 'Art & Craft':20, 'Physical Education':20,
};
const RES_SAMPLE_STUDENTS = [
  { id:1, rollNo:'245-00072', name:'Ali Khan',      father:'Ahmed Khan',
    obtained:{ English:18, Urdu:16, Mathematics:20, Science:17, Islamiyat:14, Computer:0, 'Social Studies':0, Quran:16, 'Art & Craft':18, 'Physical Education':19 },
    absentSubjects:['Computer','Social Studies'], attendance:'92%' },
  { id:2, rollNo:'245-00073', name:'Haroon Sheikh', father:'Abdul Rauf',
    obtained:{ English:15, Urdu:12, Mathematics:18, Science:14, Islamiyat:13 },
    absentSubjects:[], attendance:'88%' },
  { id:3, rollNo:'245-00074', name:'Amna Malik',    father:'Tariq Malik',
    obtained:{}, absentSubjects:[], attendance:'95%' },
  { id:4, rollNo:'245-00075', name:'Zara Ahmed',    father:'Imran Ahmed',
    obtained:{}, absentSubjects:[], attendance:'90%' },
  { id:5, rollNo:'245-00076', name:'Bilal Hussain', father:'Riaz Hussain',
    obtained:{}, absentSubjects:[], attendance:'91%' },
];
function freshStudents() {
  return RES_SAMPLE_STUDENTS.map(s => ({
    ...s,
    obtained: { ...s.obtained },
    absentSubjects: [...(s.absentSubjects || [])],
    finalRemarks: '',
    manualRemarks: {},
    absent: false,
  }));
}

/* Combined Assessment results scaffold now loads via examService.getCbrResults().
   The pre-computed shape (including ranks and grades) lives in mock/exams.js. */

const CBR_CLASS_OPTIONS = [
  'Grade 1 - Section A', 'Grade 2 - Section A', 'Grade 3 - Section A',
  'Grade 4 - Section A', 'Grade 5 - Section A',
];

/* ── Result History — sample students with result histories ── */
function rhMakeSubjects(pct) {
  // Derive plausible per-subject obtained (out of 20) so subject averages have signal
  const base = (pct / 100) * 20;
  const offsets = [1, 0, 2, -1, -2, 1, 0, -1, 1, 0];
  const out = {};
  RES_SUBJECTS.slice(0, 10).forEach((s, i) => {
    out[s] = Math.max(0, Math.min(20, Math.round(base + offsets[i])));
  });
  return out;
}
function rhMakeRes(id, exam, type, pct, date, year, rank) {
  return { id, exam, type, pct, date, year, rank, subjects: type === 'single' ? rhMakeSubjects(pct) : null };
}
const RH_INITIAL_STUDENTS = [
  { id:1,  name:'Ahmed Raza',     father:'Muhammad Raza',  rollNo:'1001-2026', admission:'ADM-1001', cls:'Grade 1 - Section A', section:'A', session:'2025-26', attendance:92,
    results:[ rhMakeRes('r1a','Mid Term','single',74,'10-03-2026','2025-26',2), rhMakeRes('r1b','Final Term','single',78,'10-05-2026','2025-26',2), rhMakeRes('r1c','Mid + Final Combined','combined',76,'15-05-2026','2025-26',2) ] },
  { id:2,  name:'Sara Hussain',   father:'Ghulam Hussain', rollNo:'1002-2026', admission:'ADM-1002', cls:'Grade 1 - Section A', section:'A', session:'2025-26', attendance:88,
    results:[ rhMakeRes('r2a','Mid Term','single',68,'10-03-2026','2025-26',3), rhMakeRes('r2b','Final Term','single',71,'10-05-2026','2025-26',3), rhMakeRes('r2c','Mid + Final Combined','combined',72,'15-05-2026','2025-26',3) ] },
  { id:3,  name:'Usman Tariq',    father:'Tariq Mehmood',  rollNo:'1003-2026', admission:'ADM-1003', cls:'Grade 1 - Section A', section:'A', session:'2025-26', attendance:95,
    results:[ rhMakeRes('r3a','Mid Term','single',65,'10-03-2026','2025-26',4), rhMakeRes('r3b','Final Term','single',62,'10-05-2026','2025-26',4), rhMakeRes('r3c','Term Performance Evaluation','combined',60,'12-05-2026','2025-26',4) ] },
  { id:4,  name:'Fatima Noor',    father:'Noor Ahmad',     rollNo:'1004-2026', admission:'ADM-1004', cls:'Grade 1 - Section A', section:'A', session:'2025-26', attendance:94,
    results:[ rhMakeRes('r4a','Mid Term','single',84,'10-03-2026','2025-26',1), rhMakeRes('r4b','Final Term','single',90,'10-05-2026','2025-26',1), rhMakeRes('r4c','Mid + Final Combined','combined',88,'15-05-2026','2025-26',1) ] },
  { id:5,  name:'Bilal Sheikh',   father:'Khalid Sheikh',  rollNo:'1005-2026', admission:'ADM-1005', cls:'Grade 1 - Section A', section:'A', session:'2025-26', attendance:78,
    results:[ rhMakeRes('r5a','Mid Term','single',55,'10-03-2026','2025-26',5), rhMakeRes('r5b','Final Term','single',58,'10-05-2026','2025-26',5) ] },
  { id:6,  name:'Ali Khan',       father:'Ahmed Khan',     rollNo:'2001-2026', admission:'ADM-2001', cls:'Grade 2 - Section A', section:'A', session:'2025-26', attendance:90,
    results:[ rhMakeRes('r6a','Mid Term','single',80,'10-03-2026','2025-26',2), rhMakeRes('r6b','Final Term','single',74,'10-05-2026','2025-26',2), rhMakeRes('r6c','Mid + Final Combined','combined',78,'15-05-2026','2025-26',2) ] },
  { id:7,  name:'Haroon Sheikh',  father:'Abdul Rauf',     rollNo:'2002-2026', admission:'ADM-2002', cls:'Grade 2 - Section A', section:'A', session:'2025-26', attendance:86,
    results:[ rhMakeRes('r7a','Mid Term','single',60,'10-03-2026','2025-26',4), rhMakeRes('r7b','Final Term','single',65,'10-05-2026','2025-26',4), rhMakeRes('r7c','Term Performance Evaluation','combined',64,'12-05-2026','2025-26',4) ] },
  { id:8,  name:'Amna Malik',     father:'Tariq Malik',    rollNo:'3001-2026', admission:'ADM-3001', cls:'Grade 3 - Section A', section:'A', session:'2025-26', attendance:96,
    results:[ rhMakeRes('r8a','Mid Term','single',91,'10-03-2026','2025-26',1), rhMakeRes('r8b','Final Term','single',89,'10-05-2026','2025-26',1), rhMakeRes('r8c','Mid + Final Combined','combined',90,'15-05-2026','2025-26',1) ] },
  { id:9,  name:'Zara Ahmed',     father:'Imran Ahmed',    rollNo:'4001-2026', admission:'ADM-4001', cls:'Grade 4 - Section A', section:'A', session:'2025-26', attendance:80,
    results:[ rhMakeRes('r9a','Mid Term','single',48,'10-03-2026','2025-26',5), rhMakeRes('r9b','Final Term','single',54,'10-05-2026','2025-26',5) ] },
  { id:10, name:'Bilal Hussain',  father:'Riaz Hussain',   rollNo:'5001-2026', admission:'ADM-5001', cls:'Grade 5 - Section A', section:'A', session:'2025-26', attendance:73,
    results:[ rhMakeRes('r10a','Mid Term','single',52,'10-03-2026','2025-26',5), rhMakeRes('r10b','Final Term','single',58,'10-05-2026','2025-26',5), rhMakeRes('r10c','Mid + Final Combined','combined',56,'15-05-2026','2025-26',5) ] },
];
const RH_SESSIONS = ['2025-26', '2024-25'];
const RH_SECTIONS = ['A'];
const RH_EXAM_TYPES = [
  { v:'single',   l:'Single Assessment' },
  { v:'combined', l:'Combined Assessment' },
];

/* Derive per-subject obtained marks for the result card preview from a combined student's mainObt. */
function cbrDeriveSubjectMarks(mainObt) {
  const per = mainObt / 10;
  const offsets = [0, 1, -1, 2, -2, 1, 0, -1, 1, -1];
  const out = {};
  RES_SUBJECTS.slice(0, 10).forEach((s, i) => {
    out[s] = Math.max(0, Math.min(20, Math.round(per * (20 / 20) + offsets[i])));
  });
  return out;
}

/* Initial result scaffold now loads via examService.getResultData().
   RES_SAMPLE_STUDENTS, RES_DEFAULT_TOTALS, and freshStudents() stay below as
   in-memory scaffolding for sync CRUD (used by buildDefaultClass, publish
   and unpublish handlers, and the rh- / cbr- helpers). They will move to
   the service once the backend exposes /api/result-defaults or equivalent. */

const SAMPLE_RC_COMBINED = {
  grandTotal: 235, grandObt: 165.65, ovPct: 70.49,
  mainExName: 'Term Examination', mainTotal: 200, mainObt: 138,
  subBreakdown: [
    { name:'Monthly Test', origT:100, subObt:82, weight:20, conv:16.4 },
    { name:'Mid Term',     origT:100, subObt:75, weight:15, conv:11.25 },
  ],
};

const RC_TEMPLATES = [
  {
    id:'classic',
    name:'Classic Result Card',
    desc:'Clean, compact layout with subject marks table.',
    badge:{ label:'Default', cls:'default' },
    accent:'#1E40AF',
    accentLight:'#DBEAFE',
    accentBg:'rgba(30,64,175,.08)',
    pages:{ single:'1 Page', combined:'2 Pages', combinedCol:'#7C3AED' },
    tags:[
      { i:'fa-table', label:'Marks Table' },
      { i:'fa-print', label:'Print Ready' },
    ],
  },
  {
    id:'insight',
    name:'Insight Result Card',
    desc:'Performance bars with visual grade summary.',
    badge:{ label:'New', cls:'new' },
    accent:'#7C3AED',
    accentLight:'rgba(124,58,237,.08)',
    accentBg:'rgba(124,58,237,.08)',
    pages:{ single:'1 Page', combined:'2 Pages', combinedCol:'#7C3AED' },
    tags:[
      { i:'fa-chart-bar', label:'Performance Bars' },
      { i:'fa-star',      label:'Visual Summary'   },
    ],
  },
  {
    id:'portfolio',
    name:'Portfolio Report',
    desc:'Premium academic report with cover, performance bars and strengths.',
    badge:null,
    accent:'#D97706',
    accentLight:'rgba(217,119,6,.09)',
    accentBg:'rgba(217,119,6,.09)',
    pages:{ single:'2 Pages', singleCol:'#D97706', combined:'3 Pages', combinedCol:'#7C3AED' },
    tags:[
      { i:'fa-file-lines', label:'Cover Page' },
      { i:'fa-chart-bar',  label:'Perf. Bars' },
      { i:'fa-trophy',     label:'Strengths'  },
    ],
  },
];

/* "08:00 AM" → "08:00" for <input type="time"> */
function dsTimeToInput(t) {
  if (!t) return '';
  if (t.includes('AM') || t.includes('PM')) {
    const [time, ampm] = t.split(' ');
    let [h, m] = time.split(':');
    h = parseInt(h, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return String(h).padStart(2, '0') + ':' + m;
  }
  return t;
}
/* "20:00" → "8:00 PM" */
function dsTimeFromInput(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return ((hr % 12) || 12) + ':' + m + ' ' + ampm;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function Examination({ toast = () => {} }) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tab, setTab]               = useState('setup'); // setup | datesheet | syllabus | results
  const [term, setTerm]             = useState('');
  const [openExamId, setOpenExamId] = useState(null);
  const [editing, setEditing]       = useState(null);     // null = closed, { id?, ... } = open
  const [confirmDel, setConfirmDel] = useState(null);     // exam to delete
  const [reportReq, setReportReq]   = useState(null);     // { scope:'all'|<examId>, name }
const [exams, setExams] = useState([]);
  /* ── Date Sheet state ── */
  const [dsTerm, setDsTerm]           = useState('2nd');
  const [dsExamId, setDsExamId]       = useState(null);
  const [dsOpenKey, setDsOpenKey]     = useState(null);
  const { data: dateSheets = {}, setData: setDateSheets } = useAsync(examService.getDateSheets, []);
  const [dsEditing, setDsEditing]     = useState(null);   // { examId, classKey, className, rows }
  const [dsConfirmDel, setDsConfirmDel] = useState(null); // { examId, classKey, className }
  const [dsConfirmCopy, setDsConfirmCopy] = useState(null); // { examId, sourceKey, count, examName }
  const [dsReportReq, setDsReportReq] = useState(null);   // { classKey:'all'|key }
const [subjects, setSubjects] = useState([]);
  /* ── Result Setup state ── */
  const [rsTab, setRsTab]               = useState('resultsetup'); // resultsetup | singleassessment | combinedassessment | resulthistory
  const [rsL2, setRsL2]                 = useState('setup');       // setup | cardoptions (cardoptions = Coming Soon for now)
  const { data: rsGrades = [],  setData: setRsGrades }  = useAsync(examService.getRsGrades,  []);
  const { data: rsSigs = [],    setData: setRsSigs }    = useAsync(examService.getRsSigs,    []);
  const { data: rsRemarks = [], setData: setRsRemarks } = useAsync(examService.getRsRemarks, []);
  const [rsAbsentMode, setRsAbsentMode] = useState('exclude'); // 'zero' | 'exclude'
  const [rsModalOpen, setRsModalOpen]   = useState(false);
  const [rsReportReq, setRsReportReq]   = useState(null);      // truthy → picker open

  /* ── Single Assessment state ── */
  const [resTerm, setResTerm]           = useState('2nd');
  const [resExamId, setResExamId]       = useState(null);
  const [resOpenKey, setResOpenKey]     = useState(null);
  const { data: resultData = {}, setData: setResultData } = useAsync(examService.getResultData, []);
  const [resUpdateCtx, setResUpdateCtx] = useState(null); // { examId, key, studentId }
  const [resCardCtx, setResCardCtx]     = useState(null); // { examId, key, studentId }
  const [resConfirmPublish, setResConfirmPublish] = useState(null); // { key, className, released }
  const [resTotalMarksCtx, setResTotalMarksCtx]   = useState(null); // { examId, key, className }
  const [resConfirmDelete, setResConfirmDelete]   = useState(null); // { examId, key, className }
  const [resRemarksCtx, setResRemarksCtx]         = useState(null); // { examId, key, studentId }
  const [resClassReportReq, setResClassReportReq] = useState(null); // { examId, key, className }

  /* ── Combined Assessment state ── */
  const { data: cbrResults = [], setData: setCbrResults } = useAsync(examService.getCbrResults, []);
  const [cbrFilterClass, setCbrFilterClass] = useState('');
  const [cbrActiveGroup, setCbrActiveGroup] = useState(null);
  const [cbrOpenKey, setCbrOpenKey]       = useState(null);
  const [cbrCardCtx, setCbrCardCtx]       = useState(null); // { groupId, classId, studentRollNo }
  const [cbrConfirmPublish, setCbrConfirmPublish] = useState(null); // { classId, className, published }
  const [cbrConfirmDelete, setCbrConfirmDelete]   = useState(null); // { classId, className }
  const [cbrCreateOpen, setCbrCreateOpen]         = useState(false);
  const [cbrReportReq, setCbrReportReq]           = useState(null); // { classId, className }

  /* ── Result History state ── */
  const [rhSearchQ, setRhSearchQ]             = useState('');
  const [rhFilterSession, setRhFilterSession] = useState('2025-26');
  const [rhFilterClass, setRhFilterClass]     = useState('');
  const [rhFilterSection, setRhFilterSection] = useState('');
  const [rhFilterExam, setRhFilterExam]       = useState('');
  const [rhSearchFocused, setRhSearchFocused] = useState(false);
  const [rhActiveStudent, setRhActiveStudent] = useState(null); // student object
  const [rhCardCtx, setRhCardCtx]             = useState(null); // { student, result }
  const [rhReportReq, setRhReportReq]         = useState(null); // { student, type:'card'|'history'|'progress'|'comparison'|'attendance', result? }

  /* ── Result Card Options state ── */
  const [rcTemplate, setRcTemplate]     = useState('classic'); // classic | insight | portfolio
  const { data: rcoGeneral = [], setData: setRcoGeneral } = useAsync(examService.getRcoGeneral, []);
  const { data: rcoSig = [],     setData: setRcoSig }     = useAsync(examService.getRcoSig,     []);
  const [rcPreviewId, setRcPreviewId]   = useState(null);      // template id being previewed

  /* ── Syllabus state ── */
  const [sylTerm, setSylTerm]               = useState('2nd');
  const [sylExamId, setSylExamId]           = useState(null);
  const [sylOpenKey, setSylOpenKey]         = useState(null);
  const { data: syllabusData = {}, setData: setSyllabusData } = useAsync(examService.getSyllabus, []);
  const [sylEditing, setSylEditing]         = useState(null);   // { examId, classKey, className, subjects }
  const [sylConfirmDel, setSylConfirmDel]   = useState(null);   // { examId, classKey, className }
  const [sylReportReq, setSylReportReq]     = useState(null);   // { classKey, name }
  const [sessionList, setSessionList]   = useState([]);
  const [branchSession, setBranchSession]         = useState([]);
const [terms, setTerms] = useState([]);
const [filtered, setFiltered] = useState([]);
const [selectedTermId, setSelectedTermId] = useState(null);
const [examClasses, setExamClasses] = useState([]);
const [loadingGrades, setLoadingGrades] = useState(false);
const [loadingSigs, setLoadingSigs] = useState(false);
const [loadingRemarks, setLoadingRemarks] = useState(false);

  const [resStudentData, setResStudentData] = useState({}); // key → { students, subjects, marks, rankings }
const [resLoadingKey, setResLoadingKey] = useState(null);

    /* Load the session (academic-year) dropdown. Default-selects the session whose
       id matches sessionStorage.sessionID — the active session for the logged-in user. */
    useEffect(() => {
      (async () => {
        try {
          const res = await fetch(buildUrl('/api/Setting/get-sessions'), { method: 'GET', headers: termsAuthHeaders() });
          const json = await res.json();
          setSessions(json?.data || []);
          const stored = termsSessionYearID();
          if (stored) setSessionId(String(stored));
        } catch (e) {
          console.error('Error loading sessions:', e);
        }
      })();
    }, []);
  
    /* Load the session start/end dates for the current branch. */
    useEffect(() => { loadSessionDates(); }, []);
  
    const loadSessionDates = async () => {
      try {
        const res = await fetch(
          buildUrl(`/api/getsessionsummarybybranchid?branchID=${termsBranchID()}&pageNo=1`),
         {
          method: 'GET',
          headers: {
            Accept: '*/*',
            Authorization: `Bearer ${sessionStorage.getItem('token') || ''}`,
          },
        }
        );
        const json = await res.json();
        const row = (json?.data || [])[0];
        if (!row) return;
        if (row.sessionStart) setStart(row.sessionStart.slice(0, 10));
        if (row.sessionEnd)   setEnd(row.sessionEnd.slice(0, 10));
      } catch (e) {
        console.error('Error loading session dates:', e);
      }
    };
  
  const getSessionData = async () => {
    try {
      const branchID = sessionStorage.getItem("branchID");
      const empID = sessionStorage.getItem("employee_ID");
  
      const res = await fetch(
        buildUrl(`api/Setting/get-branch-session/${branchID}`),
        {
          method: "GET",
          headers: {
            Accept: "*/*",
          },
        }
      );
  
      const json = await res.json();
      sessionStorage.setItem('sessionID', json.data[0].SessionID)
      notifySessionChange();
    } catch (error) {
      console.error("Error loading classes:", error);
    }
  };

    /* Switch the active session: persist it and reload the terms scoped to it. */
    const changeSession = id => {
      setSessionId(id);
      /* Store the user-switched session under changeSessionId (takes priority in
         termsSessionYearID) and broadcast so all loaders re-run. */
      sessionStorage.setItem('changeSessionId', id);
      notifySessionChange();
    };
  
    /* Load terms from the backend on mount, replacing any seed/mock data. */
    useEffect(() => { getTerms(); }, []);
  
    /* Re-run the term/session calls whenever a session key changes (same-tab event)
       or another tab edits sessionStorage. */
    useEffect(() => {
      const reload = () => { getTerms(); loadSessionDates(); };
      window.addEventListener(SESSION_CHANGE_EVENT, reload);
      window.addEventListener('storage', reload);
      return () => {
        window.removeEventListener(SESSION_CHANGE_EVENT, reload);
        window.removeEventListener('storage', reload);
      };
    }, []);
    const termsBranchID      = () => Number(sessionStorage.getItem('branchID')) || 0;
/* Prefer the user-switched session (changeSessionId); fall back to the session
   set at login (SessionID / sessionID). Sent as sessionYearID on term calls. */
const termsSessionYearID = () =>
  sessionStorage.getItem('changeSessionId')
  || sessionStorage.getItem('SessionID')
  || sessionStorage.getItem('sessionID')
  || '';

/* sessionStorage writes don't fire the native 'storage' event in the same tab,
   so we broadcast our own event after changing a session key. Loaders listen for
   it (and the native cross-tab 'storage' event) to re-run their term/calendar calls. */
const SESSION_CHANGE_EVENT = 'sm-session-change';
const notifySessionChange = () => {
  try { window.dispatchEvent(new Event(SESSION_CHANGE_EVENT)); } catch (e) { /* SSR/no-window */ }
};


/* Auth headers — attach the JWT from sessionStorage.token as a bearer token. */
const termsAuthHeaders = (extra = {}) => ({
  Accept: '*/*',
  Authorization: `bearer ${sessionStorage.getItem('token') || ''}`,
  ...extra,
});
  const [sessions,  setSessions]  = useState([]);
  const [sessionId, setSessionId] = useState(() => termsSessionYearID());
  const [start,  setStart]  = useState('2026-01-01');
  const [end,    setEnd]    = useState('2026-12-31');
   const loginSessionId = sessionStorage.getItem('SessionID') || sessionStorage.getItem('sessionID') || '';
    const isOtherSession = !!sessionId && !!loginSessionId && String(sessionId) !== String(loginSessionId);
async function getTerms() {
  try {
    const token = sessionStorage.getItem('token');
    const branchID = Number(sessionStorage.getItem('branchID'));

    const response = await fetch(buildUrl('/api/termscrud'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        id: 0,
        branchID,
        term: '',
        sessionYearID: termsSessionYearID(),
        action: 'get'
      })
    });

    const data = await response.json();

    // FIX: Ensure data is an array before setting state
    if (Array.isArray(data)) {
      setTerms(data);
    } else if (data && Array.isArray(data.data)) {
      // If API returns { data: [...] }
      setTerms(data.data);
    } else if (data && data.length !== undefined) {
      // If data is array-like
      setTerms(Array.from(data));
    } else {
      // Fallback to empty array
      console.warn('Unexpected terms data format:', data);
      setTerms([]);
    }
  } catch (error) {
    console.log('Could not load terms', error);
    setTerms([]); // Set empty array on error
  }
} 

  
// Update fetchGradeSetup function
async function fetchGradeSetup() {
  try {
    setLoadingGrades(true);
    const token = sessionStorage.getItem('token');
    const branchID = sessionStorage.getItem('branchID');

    const response = await fetch(buildUrl('/api/gradingcrud'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      body: JSON.stringify({
        id: 0,
        branchID: branchID || "1",
        percentage: "",
        grade: "",
        remarks: "",
        percentageNo: "",
        action: "get"
      })
    });

    const data = await response.json();
    console.log("Grade Setup API Response:", data);
    
    // Transform API response to match the expected format
    // API returns: { id, branchID, percentage: "≥90", grade: "A+", remarks: "good" }
    const transformedGrades = (data || []).map(item => {
      // Extract the condition and percentage value from "≥90" format
      let cond = 'gte';
      let pct = '';
      
      if (item.percentage) {
        if (item.percentage.includes('≥')) {
          cond = 'gte';
          pct = item.percentage.replace('≥', '').trim();
        } else if (item.percentage.includes('>')) {
          cond = 'gt';
          pct = item.percentage.replace('>', '').trim();
        } else if (item.percentage.includes('≤')) {
          cond = 'lte';
          pct = item.percentage.replace('≤', '').trim();
        } else if (item.percentage.includes('<')) {
          cond = 'lt';
          pct = item.percentage.replace('<', '').trim();
        } else if (item.percentage.includes('=')) {
          cond = 'eq';
          pct = item.percentage.replace('=', '').trim();
        } else {
          pct = item.percentage;
        }
      }
      
      return {
        id: item.id,
        grade: item.grade || '',
        cond: cond,
        pct: pct,
        comment: item.remarks || ''
      };
    });
    
    setRsGrades(transformedGrades);
    return transformedGrades;
  } catch (error) {
    console.log("Could not load grade setup", error);
    toast('Could not load grade setup', 'error');
    return [];
  } finally {
    setLoadingGrades(false);
  }
}
const handleConfirmPublish = async () => {
  if (!resConfirmPublish) return;
  const { key, released, cls } = resConfirmPublish;
  const selectedExam = filtered.find(e => e.id === resExamId);
const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');

  try {
    const payload = {
      classID: cls.classID,
      sectionID: cls.sectionID,
      examID: selectedExam?.selectExam || 0,
      termID: selectedExam?.termID || 0,
      branchID: branchID,
      isResultVisibleToParents: !released,
    };

    const res = await fetch( buildUrl('/api/sauploadmarksUpdatevissibility'), {
      method: 'POST',
 headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
            body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('API failed');

    setResultData(prev => {
      const next = { ...prev };
      const examMap = { ...(next[resExamId] || {}) };
      const oldCd = examMap[key] || { released: false, totalMarks: { ...RES_DEFAULT_TOTALS }, students: freshStudents() };
      examMap[key] = { ...oldCd, released: !oldCd.released };
      next[resExamId] = examMap;
      return next;
    });

    toast(released ? 'Result unpublished' : 'Result published!', 'success');
  } catch (err) {
    toast('Failed to update visibility. Please try again.', 'error');
  } finally {
    setResConfirmPublish(null);
  }
};

// Update fetchSignatureSetup function
async function fetchSignatureSetup() {
  try {
    setLoadingSigs(true);
    const token = sessionStorage.getItem('token');
    const branchID = sessionStorage.getItem('branchID');

    const response = await fetch(buildUrl('/api/gradinguploadercrud'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      body: JSON.stringify({
        id: 0,
        branchID: branchID || "1",
        name: "",
        designation: "",
        signature: "",
        action: "get"
      })
    });

    const data = await response.json();
    console.log("Signature Setup API Response:", data);
    
    // Transform API response to match the expected format
    // API returns: { id, branchID, name: "Sawaira", designation: "principle", signature: "sawairaG" }
    const transformedSigs = (data || []).map(item => ({
      id: item.id,
      name: item.name || '',
      desig: item.designation || '',
      img: item.signature || ''  // signature field contains the name/signature text
    }));
    
    setRsSigs(transformedSigs);
    return transformedSigs;
  } catch (error) {
    console.log("Could not load signature setup", error);
    toast('Could not load signature setup', 'error');
    return [];
  } finally {
    setLoadingSigs(false);
  }
}

// Update fetchRemarksSetup function
async function fetchRemarksSetup() {
  try {
    setLoadingRemarks(true);
    const token = sessionStorage.getItem('token');
    const branchID = sessionStorage.getItem('branchID');

    const response = await fetch(buildUrl('/api/overallgradingcrud'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      body: JSON.stringify({
        id: 0,
        branchID: branchID || "1",
        percentage: "",
        finalRemarks: "",
        action: "get"
      })
    });

    const data = await response.json();
    console.log("Remarks Setup API Response:", data);
    
    // Transform API response to match the expected format
    // API returns: { id, branchID, percentage: "≥ 90", finalRemarks: "Outstanding" }
    const transformedRemarks = (data || []).map(item => {
      // Extract the condition and percentage value from "≥ 90" format
      let cond = 'gte';
      let pct = '';
      
      if (item.percentage) {
        if (item.percentage.includes('≥')) {
          cond = 'gte';
          pct = item.percentage.replace('≥', '').trim();
        } else if (item.percentage.includes('>')) {
          cond = 'gt';
          pct = item.percentage.replace('>', '').trim();
        } else if (item.percentage.includes('≤')) {
          cond = 'lte';
          pct = item.percentage.replace('≤', '').trim();
        } else if (item.percentage.includes('<')) {
          cond = 'lt';
          pct = item.percentage.replace('<', '').trim();
        } else if (item.percentage.includes('=')) {
          cond = 'eq';
          pct = item.percentage.replace('=', '').trim();
        } else {
          pct = item.percentage;
        }
      }
      
      return {
        id: item.id,
        cond: cond,
        pct: pct,
        text: item.finalRemarks || ''
      };
    });
    
    setRsRemarks(transformedRemarks);
    return transformedRemarks;
  } catch (error) {
    console.log("Could not load remarks setup", error);
    toast('Could not load remarks setup', 'error');
    return [];
  } finally {
    setLoadingRemarks(false);
  }
}

// Update the useEffect that loads result setup when rsTab changes
useEffect(() => {
  if (rsTab === 'resultsetup' && rsL2 === 'setup') {
    // Load all three APIs when Result Setup tab is active
    fetchGradeSetup();
    fetchSignatureSetup();
    fetchRemarksSetup();
  }
}, [rsTab, rsL2]);

// Also load when component mounts for the first time if Result Setup is active
useEffect(() => {
  if (rsTab === 'resultsetup' && rsL2 === 'setup') {
    fetchGradeSetup();
    fetchSignatureSetup();
    fetchRemarksSetup();
  }
}, []);
const openAdd = () => {
  setEditing({ name: '', classes: [], from: '', to: '', termID: selectedTermId });
};
  // Replace your current openEdit function with this:
const openEdit = (exam) => {
  console.log("Editing exam:", exam);
  
  // Make sure we have all the data needed for editing
  const examToEdit = {
    id: exam.id,
    name: exam.name,
    termID: exam.termID,
    termName: exam.termName,
    selectExam: exam.selectExam,
    from: exam.from,
    to: exam.to,
    classes: exam.classes || [] // Make sure classes array exists
  };
  
  setEditing(examToEdit);
};
async function getExamClasses(examId, termId) {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const empID = sessionStorage.getItem('employee_ID');
    const token = sessionStorage.getItem('token');

    const response = await fetch(
      buildUrl(
        `/api/getclassesinexam?branchID=${branchID}&selectExam=${examId}&termID=${termId}&empID=${empID}`
      ),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    const data = await response.json();
    console.log("API Response:", data); // Debug log
    
    // Transform the data to match your component structure
    const transformedData = (data || []).map(item => ({
      id: item.id,
      classID: item.gradeID,      // Note: API returns gradeID
      sectionID: item.sectionID,
      sectionName: item.sectionName,
      gradeName: item.name,        // API returns 'name' for grade name
      className: `${item.name} - ${item.sectionName}`.trim()
    }));
    
    console.log("Transformed Data:", transformedData); // Debug log
    setExamClasses(transformedData);
    return transformedData;
    
  } catch (error) {
    console.log("Could not load exam classes", error);
    setExamClasses([]);
    return [];
  }
}

  /* ── Date Sheet helpers ── */
  const dsTermExams   = exams.filter(e => e.term === dsTerm);
  const dsCurrentExam = dsExamId ? exams.find(e => e.id === dsExamId) : null;
  const dsExamSheets  = (dsExamId && dateSheets[dsExamId]) || {};

  const dsPickTerm = t => {
    setDsTerm(t);
    setDsExamId(null);
    setDsOpenKey(null);
  };
 // For Date Sheet
// Replace your existing dsPickExam function with this one
const dsPickExam = async (id) => {
  setDsExamId(id);
  setDsOpenKey(null);
  setExamClasses([]); // Clear previous classes while loading
  
  // Find the selected exam to get its selectExam ID and termID
  const selectedExam = filtered.find(ex => ex.id === id);
  console.log("Selected Exam:", selectedExam);
  
  if (selectedExam) {
    const selectExamId = selectedExam.selectExam;
    const termID = selectedExam.termID;
    console.log("Fetching classes for selectExam:", selectExamId, "termID:", termID);
    
    // First, get the classes for this exam
    const classes = await getExamClasses(selectExamId, termID);
    setExamClasses(classes);
    
    // Then, load date sheet data for ALL classes at once
    const dateSheetsMap = {};
    
    for (const cls of classes) {
      const key = `cls_${id}_${cls.sectionID}_${classes.indexOf(cls)}`;
      
      // Fetch date sheet data for this class
      const rows = await getDateSheetData(cls.classID, cls.sectionID, id, termID);
      
      console.log(`Loaded ${rows.length} subjects for class ${cls.gradeName} - ${cls.sectionName}`);
      
      dateSheetsMap[key] = rows;
    }
    
    // Update date sheets state with all loaded data
    setDateSheets(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...dateSheetsMap },
    }));
  }
};
const sylPickExam = async (id) => {
  setSylExamId(id);
  setSylOpenKey(null);
  setExamClasses([]); // Clear previous classes while loading
  
  // Find the selected exam to get its selectExam ID and termID
  const selectedExam = filtered.find(ex => ex.id === id);
  console.log("Selected Exam:", selectedExam);
  
  if (selectedExam) {
    const selectExamId = selectedExam.selectExam;
    const termID = selectedExam.termID;
    console.log("Fetching classes for selectExam:", selectExamId, "termID:", termID);
    
    // First, get the classes for this exam
    const classes = await getExamClasses(selectExamId, termID);
    setExamClasses(classes);
    
    // Load syllabus data for ALL classes at once (in parallel)
    if (classes && classes.length > 0) {
      // Create an array of promises to load syllabus for all classes
      const loadPromises = classes.map(async (cls, index) => {
        const key = `scls_${id}_${cls.sectionID}_${index}`;
        
        // Fetch syllabus for this class
        const rows = await getExamSyllabusByClassAndTerms(
          cls.classID,
          cls.sectionID,
          selectExamId,
          termID,
          1
        );
        
        // Map API rows -> { subject, content, updatedAt } shape
        const mapped = (rows || []).map(r => ({
          subject: r.subjectDisplayName || '',
          content: r.subjectDetails || '',
          updatedAt: r.updatedAt || r.UpdatedOn || '—',
        }));
        
        return { key, mapped };
      });
      
      // Wait for all promises to complete
      const results = await Promise.all(loadPromises);
      
      // Update syllabus data state with all loaded data
      const syllabusMap = {};
      results.forEach(({ key, mapped }) => {
        syllabusMap[key] = mapped;
      });
      
      setSyllabusData(prev => ({
        ...prev,
        [id]: { ...(prev[id] || {}), ...syllabusMap },
      }));
      
      console.log(`Loaded syllabus for ${classes.length} classes`);
    }
  }
};
const loadResClassData = async (key, cls) => {
  if (resStudentData[key]) return; // already loaded
  setResLoadingKey(key);
  try {
    const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');
    const selectedExam = filtered.find(e => e.id === resExamId);
    const selectExamValue = selectedExam?.selectExam || 0;
    const termID = selectedExam?.termID || selectedTermId;

    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

    // 1. Students
    const studentsRes = await fetch(
      buildUrl(`/api/getstudentsbybranchsectionandgrade?branchID=${branchID}&sectionID=${cls.sectionID}&gradeID=${cls.classID}`),
      { method: 'GET', headers }
    );
    const studentsData = await studentsRes.json();
    const students = Array.isArray(studentsData) ? studentsData : (studentsData?.data || []);

    // 2. Subject totals
    const subjParams = new URLSearchParams({
      branchID: String(branchID),
      classID: String(cls.classID),
      termID: String(termID),
      ExamID: String(selectExamValue),
      sectionID: String(cls.sectionID),
      pageNo: '1'
    });
    const subjRes = await fetch(
      buildUrl(`/api/getsasubjectbybranchclassandtermtotalsum?${subjParams}`),
      { method: 'GET', headers }
    );
    const subjData = await subjRes.json();
    const subjects = Array.isArray(subjData) ? subjData : (subjData?.data || []);

    // 3. Student marks
    const marksParams = new URLSearchParams({
      branchID: String(branchID),
      classID: String(cls.classID),
      termID: String(termID),
      ExamID: String(selectExamValue),
      sectionID: String(cls.sectionID),
      pageNo: '1'
    });
    const marksRes = await fetch(
      buildUrl(`/api/getsauploadmarksbystudentbranchsum?${marksParams}`),
      { method: 'GET', headers }
    );
    const marksData = await marksRes.json();
const marks = Array.isArray(marksData) 
  ? marksData 
  : (marksData?.data || marksData?.Data || []);
    // 4. Rankings
    const rankParams = new URLSearchParams({
      sectionID: String(cls.sectionID),
      termID: String(termID),
      examID: String(selectExamValue)
    });
    const rankRes = await fetch(
      buildUrl(`/api/getstudentsrankings?${rankParams}`),
      { method: 'GET', headers }
    );
    const rankData = await rankRes.json();
    const rankings = Array.isArray(rankData) ? rankData : (rankData?.data || []);

    // 5. Update rankings
    await fetch(
      buildUrl(`/api/updaterankings?ClassID=${cls.classID}&SectionID=${cls.sectionID}&TermID=${termID}&ExamID=${selectExamValue}`),
      { method: 'GET', headers }
    );

    // Store everything
    setResStudentData(prev => ({
      ...prev,
      [key]: { students, subjects, marks, rankings }
    }));
console.log('SUBJECTS:', subjects);
console.log('MARKS:', marks);
console.log('totalMarksSum:', subjects[0]?.totalMarksSum);
  } catch (err) {
    console.error('Error loading class data:', err);
  } finally {
    setResLoadingKey(null);
  }
};
async function getDateSheetData(classID, sectionID, examId, termId) {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const empID = sessionStorage.getItem('employee_ID');
    const token = sessionStorage.getItem('token');
    
    // Find the selected exam to get the selectExam value
    const selectedExam = filtered.find(ex => ex.id === examId);
    const selectExamValue = selectedExam ? selectedExam.selectExam : examId;
    
    console.log("Fetching date sheet with:", {
      branchID,
      classID,
      termID: termId,
      ExamID: selectExamValue,  // ← Use selectExam value (27) instead of examId (38)
      sectionID,
      empID
    });

    const params = new URLSearchParams({
      branchID: String(branchID),
      classID: String(classID),
      termID: String(termId),
      ExamID: String(selectExamValue),  // ← This is the key fix
      sectionID: String(sectionID),
      empID: String(empID)
    });

    const response = await fetch(
      buildUrl(`/api/getdatesheetbybranchclassidtermid?${params.toString()}`),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );
const data = await response.json();
console.log("Date Sheet API Response:", data);

// API returns a plain array (or sometimes {success,data}) — handle both
const rows = Array.isArray(data) ? data : (data?.data || []);

if (rows.length) {
  console.log("Transformed Date Sheet Rows:", rows); // Debug log 
  const transformedRows = rows.map(item => ({
        id: item.id,
    subject: item.subjectName || item.subject || '',
    date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
    timeFrom: item.timeFrom || '',
    timeTo: item.timeTo || '',
  }));
  return transformedRows;
}

return [];
  } catch (error) {
    console.log("Could not load date sheet data", error);
    return [];
  }
}
const dsOpenEdit = async (classKey, className, classID, sectionID) => {
  // Fetch existing date sheet data from API
  const existingRows = await getDateSheetData(classID, sectionID, dsExamId, selectedTermId);
  
  // Use fetched data if available, otherwise use local data or create empty row
  const rows = existingRows.length 
    ? existingRows.map(r => ({ ...r })) 
    : (dateSheets[dsExamId]?.[classKey] || [{ subject: '', date: '', timeFrom: '', timeTo: '' }]);
  
  // Fetch subjects for this class for the dropdown
  const fetchedSubjects = await getSyllabusSubjects(classID, sectionID);
  
  // Transform subjects to the format needed for the datalist
  const subjectList = fetchedSubjects.map(s => s.subjectName);
    const selectedExam = filtered.find(ex => ex.id === dsExamId);
  const selectExamValue = selectedExam ? selectedExam.selectExam : dsExamId;
  
  setDsEditing({ 
    examId: selectExamValue, 
    classKey, 
    className, 
    rows, 
    termID: selectedTermId  ,
    subjects: subjectList,
    classID: classID,
    sectionID: sectionID
  });
};

const dsSaveEdit = async (payload) => {
  const cleaned = payload.rows
    .filter(r => r.subject && r.subject.trim())
    .map(r => ({ 
            id: r.id,  // ← Make sure this is being passed
      subject: r.subject.trim(),
      date: r.date,
      timeFrom: r.timeFrom,
      timeTo: r.timeTo
    }));
  
  if (!cleaned.length) { 
    toast('Please add at least one subject', 'warning'); 
    return; 
  }
  
  try {
    const token = sessionStorage.getItem('token');
    const branchID = sessionStorage.getItem('branchID');
    
    // Find the selected exam to get the selectExam value
    const selectedExam = filtered.find(ex => ex.id === payload.examId);
    const selectExamValue = selectedExam ? selectedExam.selectExam : payload.examId;
    
    console.log("Saving date sheet with ExamID:", selectExamValue);
    
    // Prepare payload for each subject row
    const savePromises = cleaned.map(async (row) => {
     const requestPayload = {
  id: row.id || 0,
  branchID: Number(branchID),
  classID: Number(payload.classID),
  sectionID: Number(payload.sectionID),
  examID: Number(selectExamValue),
  termID: selectedTermId,
  subjectName: row.subject,
  date: row.date,
  timeFrom: row.timeFrom,
  timeTo: row.timeTo,
  action: row.id && row.id !== 0 ? "update" : "insert"
};
      
      console.log("Saving row payload:", requestPayload);
      
      const response = await fetch(buildUrl('/api/datesheetcrud'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(requestPayload)
      });
      
      return response.json();
    });
    
    await Promise.all(savePromises);
    
    // Also update local state
    setDateSheets(prev => ({
      ...prev,
      [payload.examId]: { 
        ...(prev[payload.examId] || {}), 
        [payload.classKey]: cleaned 
      },
    }));
    
    toast('Date sheet saved successfully!', 'success');
    setDsEditing(null);
  } catch (error) {
    console.error('Error saving date sheet:', error);
    toast('Failed to save date sheet', 'error');
  }
};
const dsRunDelete = async ({ examId, classKey, className, classID, sectionID }) => {
  try {
    const token = sessionStorage.getItem('token');
    const branchID = sessionStorage.getItem('branchID');
    
    // Find the selected exam to get the selectExam value
    const selectedExam = filtered.find(ex => ex.id === examId);
    const selectExamValue = selectedExam ? selectedExam.selectExam : examId;
    
    console.log("Deleting date sheet with ExamID:", selectExamValue);
    
    // Call the delete API
    const params = new URLSearchParams({
      branchID: String(branchID),
      classID: String(classID),
      termID: String(selectedTermId),
      ExamID: String(selectExamValue),  // ← Use selectExam value (27) instead of examId (38)
      sectionID: String(sectionID)
    });
    
    const response = await fetch(
      buildUrl(`/api/deletedatesheetbyfilters?${params.toString()}`),
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );
    
    const data = await response.json();
    
    if (response.ok) {
      // Also update local state after successful API call
      setDateSheets(prev => {
        const next = { ...prev };
        if (next[examId]) { 
          const c = { ...next[examId] }; 
          delete c[classKey]; 
          next[examId] = c; 
        }
        return next;
      });
      
      toast('Date sheet deleted successfully!', 'success');
    } else {
      toast(data.message || 'Failed to delete date sheet', 'error');
    }
  } catch (error) {
    console.error('Error deleting date sheet:', error);
    toast('Failed to delete date sheet', 'error');
  }
  
  setDsConfirmDel(null);
};
// Update the dsRunCopy function to only copy missing subjects
const dsRunCopy = async () => {
  if (!dsConfirmCopy) return;
  
  const { examId, sourceKey } = dsConfirmCopy;
  const sourceRows = dateSheets[examId]?.[sourceKey];
  
  if (!sourceRows || sourceRows.length === 0) { 
    setDsConfirmCopy(null);
    toast('No source date sheet to copy from', 'warning');
    return;
  }
  
  const ex = exams.find(e => e.id === examId);
  if (!ex) { 
    setDsConfirmCopy(null);
    return;
  }
  
  try {
    // Show loading toast
    toast('Copying date sheets to other classes...', 'info');
    
    // Process each target class
    const copyPromises = [];
    const results = [];
    
    for (let i = 0; i < examClasses.length; i++) {
      const targetCls = examClasses[i];
      const targetKey = `cls_${examId}_${targetCls.sectionID}_${i}`;
      
      // Skip the source class
      if (targetKey === sourceKey) continue;
      
      // Get existing date sheet for target class
      const existingRows = await getDateSheetData(
        targetCls.classID, 
        targetCls.sectionID, 
        examId, 
        selectedTermId
      );
      
      // Create a map of existing subjects for quick lookup
      const existingSubjectsMap = new Map();
      existingRows.forEach(row => {
        existingSubjectsMap.set(row.subject.toLowerCase().trim(), true);
      });
      
      // Filter source rows to only include subjects that don't exist in target
      const rowsToCopy = sourceRows.filter(sourceRow => 
        !existingSubjectsMap.has(sourceRow.subject.toLowerCase().trim())
      );
      
      if (rowsToCopy.length === 0) {
        results.push({
          className: `${targetCls.gradeName} - ${targetCls.sectionName}`,
          copiedCount: 0,
          skippedCount: sourceRows.length,
          reason: 'All subjects already exist'
        });
        continue;
      }
      
      // Save each missing subject to the target class
      const savePromises = rowsToCopy.map(async (row) => {
        const selectedExam = filtered.find(ex => ex.id === examId);
        const selectExamValue = selectedExam ? selectedExam.selectExam : examId;
        
        const requestPayload = {
          id: 0,
          branchID: Number(sessionStorage.getItem('branchID')),
          classID: Number(targetCls.classID),
          sectionID: Number(targetCls.sectionID),
          examID: Number(selectExamValue),
          termID: selectedTermId,
          subjectName: row.subject,
          date: row.date,
          timeFrom: row.timeFrom,
          timeTo: row.timeTo,
          action: "insert"
        };
        
        const response = await fetch(buildUrl('/api/datesheetcrud'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('token')}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(requestPayload)
        });
        
        return response.json();
      });
      
      try {
        await Promise.all(savePromises);
        
        // Update local state
        setDateSheets(prev => {
          const next = { ...prev };
          const examData = { ...(next[examId] || {}) };
          const existingTargetRows = examData[targetKey] || [];
          
          // Merge existing rows with new rows (avoid duplicates)
          const mergedRows = [...existingTargetRows];
          rowsToCopy.forEach(rowToCopy => {
            const exists = mergedRows.some(r => 
              r.subject.toLowerCase().trim() === rowToCopy.subject.toLowerCase().trim()
            );
            if (!exists) {
              mergedRows.push({ ...rowToCopy });
            }
          });
          
          examData[targetKey] = mergedRows;
          next[examId] = examData;
          return next;
        });
        
        results.push({
          className: `${targetCls.gradeName} - ${targetCls.sectionName}`,
          copiedCount: rowsToCopy.length,
          skippedCount: sourceRows.length - rowsToCopy.length,
          reason: rowsToCopy.length === 0 ? 'All subjects exist' : 'Success'
        });
        
      } catch (error) {
        console.error(`Error copying to class ${targetCls.className}:`, error);
        results.push({
          className: `${targetCls.gradeName} - ${targetCls.sectionName}`,
          copiedCount: 0,
          skippedCount: sourceRows.length,
          reason: 'Error occurred'
        });
      }
    }
    
    // Show summary toast
    const successful = results.filter(r => r.copiedCount > 0);
    const skipped = results.filter(r => r.copiedCount === 0);
    
    if (successful.length > 0) {
      toast(`Successfully copied to ${successful.length} class(es)`, 'success');
    }
    if (skipped.length > 0) {
      toast(`${skipped.length} class(es) had all subjects already`, 'info');
    }
    
    // Reload the current class's date sheet to reflect changes
    if (dsExamId && examClasses.length > 0) {
      const currentClass = examClasses.find((_, idx) => 
        `cls_${dsExamId}_${examClasses[idx].sectionID}_${idx}` === sourceKey
      );
      if (currentClass) {
        await dsLoadClassDateSheet(sourceKey, currentClass);
      }
    }
    
  } catch (error) {
    console.error('Error in copy operation:', error);
    toast('Error copying date sheets', 'error');
  }
  
  setDsConfirmCopy(null);
};

  /* ── Syllabus helpers ── */
  const sylTermExams   = exams.filter(e => e.term === sylTerm);
  const sylCurrentExam = sylExamId ? exams.find(e => e.id === sylExamId) : null;
  const sylExamData    = (sylExamId && syllabusData[sylExamId]) || {};

  const sylPickTerm = t => { setSylTerm(t); setSylExamId(null); setSylOpenKey(null); };
 const sylOpenEdit = (classKey, className, classID, sectionID) => {
  const existing = syllabusData[sylExamId]?.[classKey] || [];
  const subjects = existing.length
    ? existing.map(s => ({ ...s }))
    : ALL_SUBJECTS.slice(0, 5).map(s => ({ subject: s, content: '', updatedAt: '—' }));
  setSylEditing({ examId: sylExamId, classKey, className, classID, sectionID, subjects });
};
  const sylSaveEdit = subjects => {
    if (!sylEditing) return;
    const today = new Date().toLocaleDateString('en-GB');
    const saved = subjects.map(s => ({
      subject: s.subject,
      content: s.content || '',
      updatedAt: (s.content || '').replace(/<[^>]+>/g, '').trim()
        ? today
        : (s.updatedAt || '—'),
    }));
    setSyllabusData(prev => ({
      ...prev,
      [sylEditing.examId]: { ...(prev[sylEditing.examId] || {}), [sylEditing.classKey]: saved },
    }));
    toast('Syllabus saved successfully!', 'success');
    setSylEditing(null);
  };
const sylRunDelete = async ({ examId, classKey, classID, sectionID }) => {
  if (sylCurrentExam) {
    const { ok } = await deleteSyllabusByAllIds(
      classID,
      sectionID,
      sylCurrentExam.selectExam,
      selectedTermId,                       // term name string (set via setTerm)
    );
    if (!ok) {
      toast('Could not delete syllabus', 'error');
      setSylConfirmDel(null);
      return;
    }
  }
  // Clear local cache so the row reflects the deletion
  setSyllabusData(prev => {
    const next = { ...prev };
    if (next[examId]) { const c = { ...next[examId] }; delete c[classKey]; next[examId] = c; }
    return next;
  });
  setSylConfirmDel(null);
  toast('Syllabus deleted', 'info');
};
// Component ke bahar, ya useEffect se pehle
const fetchSASubjects = async (classID, sectionID, examId, termId) => {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');

    const selectedExam = filtered.find(ex => ex.id === examId);
    const selectExamValue = selectedExam ? selectedExam.selectExam : examId;

    const params = new URLSearchParams({
      branchID: String(branchID),
      classID: String(classID),
      termID: String(selectedTermId),
      ExamID: String(selectExamValue),
      sectionID: String(sectionID),
      pageNo: '1'
    });

    const response = await fetch(
      buildUrl(`/api/getsasubjectbybranchclassandterm?${params.toString()}`),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        }
      }
    );

    const data = await response.json();

    return (data?.data || []).map(item => ({
      id: item.id,
      subjectID: item.subjectID,
      subjectName: item.subjectName || item.name || item.subject,
      totalMarks: item.totalMarks || "0"
    }));
  } catch (error) {
    console.error('Error fetching SA subjects:', error);
    return [];
  }
};
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  
  let date;
  if (dateStr.includes('-')) {
    // ISO format
    const [y, m, d] = dateStr.split('T')[0].split('-');
    date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  } else if (dateStr.includes('/')) {
    // DD/MM/YYYY format
    const [d, m, y] = dateStr.split('/');
    date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  } else {
    date = new Date(dateStr);
  }
  
  if (isNaN(date.getTime())) return "—";
  
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

async function getExamsByTerm(termID) {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const empID = sessionStorage.getItem('employee_ID');
    const token = sessionStorage.getItem('token');

    const response = await fetch(
      buildUrl(
        `/api/getexamsbybranchidtermid?branchID=${branchID}&termID=${termID}&empID=${empID}`
      ),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    const data = await response.json();

    const mapped = (data || []).reduce((acc, ex) => {
      // ek exam ko uniquely identify karne ke liye examName + termID
      const key = `${ex.examName}_${ex.termID}`;

      if (!acc[key]) {
        acc[key] = {
          // exam-level common fields
          name: ex.examName,
          termID: ex.termID,
          termName: ex.termName,
          selectExam: ex.selectExam,
          from: ex.dateFrom,
          to: ex.dateTo,
          gradeName: ex.gradeName,

          // store full class objects (keyed by sectionID to avoid dupes)
          classes: new Map()
        };
      }

      // har class/section ka apna record id + section info store karo
      // key sectionID rakho (yahi unique row hai class+section ke liye)
      acc[key].classes.set(String(ex.sectionID), {
        id: ex.id,                 // per-row id (UPDATE ke liye zaruri)
        classID: ex.classID,
        sectionID: ex.sectionID,
        sectionName: ex.sectionName,
        gradeName: ex.gradeName,
        // display label: grade + section
        className: `${ex.gradeName || ''}${ex.sectionName ? ' - ' + ex.sectionName : ''}`.trim()
      });

      return acc;
    }, {});

    const finalData = Object.values(mapped).map(ex => ({
      ...ex,
      classes: Array.from(ex.classes.values())
    }));

    setFiltered(finalData);
    setExams(finalData);

  } catch (error) {
    console.log("Could not load exams", error);
  }
}
// Parent component me onSave aise handle karo:

// Update handleSaveExam function
async function handleSaveExam({ payloads, name, from, to, classes, deletedCount }) {
  try {
    const token = sessionStorage.getItem('token');
    
    // Process insert and update operations
    const results = await Promise.all(
      payloads.map(p =>
        fetch(buildUrl('/api/addexamcrud'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(p)
        }).then(r => r.json())
      )
    );
    
    console.log('Exam CRUD results:', results);
    
    let message = 'Exam saved successfully';
    if (deletedCount > 0) {
      message += `, ${deletedCount} class(es) removed`;
    }
    toast(message, 'success');
    
    // Close modal
    setEditing(null);
    
    // Refresh the exam list
    if (selectedTermId) {
      await getExamsByTerm(selectedTermId);
    }
  } catch (error) {
    console.log('Could not save exam', error);
    toast('Could not save exam', 'error');
  }
}

// Make sure getExamsByTerm is properly defined to handle multiple classes
async function getExamsByTerm(termID) {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const empID = sessionStorage.getItem('employee_ID');
    const token = sessionStorage.getItem('token');

    const response = await fetch(
      buildUrl(
        `/api/getexamsbybranchidtermid?branchID=${branchID}&termID=${termID}&empID=${empID}`
      ),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    const data = await response.json();

    const mapped = (data || []).reduce((acc, ex) => {
      // ek exam ko uniquely identify karne ke liye examName + termID
      const key = `${ex.examName}_${ex.termID}`;

      if (!acc[key]) {
        acc[key] = {
          // exam-level common fields
          id: ex.id,
          name: ex.examName,
          termID: ex.termID,
          termName: ex.termName,
          selectExam: ex.selectExam,
          from: ex.dateFrom,
          to: ex.dateTo,
          gradeName: ex.gradeName,

          // store full class objects (keyed by sectionID to avoid dupes)
          classes: new Map()
        };
      }

      // har class/section ka apna record id + section info store karo
      // key sectionID rakho (yahi unique row hai class+section ke liye)
      acc[key].classes.set(String(ex.sectionID), {
        id: ex.id,                 // per-row id (UPDATE ke liye zaruri)
        classID: ex.classID,
        sectionID: ex.sectionID,
        sectionName: ex.sectionName,
        gradeName: ex.gradeName,
        // display label: grade + section
        className: `${ex.gradeName || ''}${ex.sectionName ? ' - ' + ex.sectionName : ''}`.trim()
      });

      return acc;
    }, {});

    const finalData = Object.values(mapped).map(ex => ({
      ...ex,
      classes: Array.from(ex.classes.values())
    }));

    setFiltered(finalData);
    setExams(finalData);

  } catch (error) {
    console.log("Could not load exams", error);
  }
}
const handleDeleteExam = async (exam) => {
  console.log("Deleting exam:", exam);

  try {
    const branchID = Number(sessionStorage.getItem("branchID"));
    const token = sessionStorage.getItem("token");

    const url = buildUrl(
      `/api/deleteexamdata?branchID=${branchID}&id=${Number(exam.selectExam)}`
    );

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "*/*",
      },
    });

    const data = await response.json();

    if (data.status || data.message) {
      setConfirmDel(null);
      getExamsByTerm(exam.termID);
    } else {
      console.log(data.message || "Delete failed");
    }
  } catch (error) {
    console.error(error);
  }
};
async function getSyllabusSubjects(gradeId, sectionID) {
  try {
    const branchID = sessionStorage.getItem("branchID");
    const empID = sessionStorage.getItem("employee_ID");
    const token = sessionStorage.getItem("token");

    const response = await fetch(
      buildUrl(`/get-subjects_byEmployeeID/${gradeId}/${sectionID}/${empID}`),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const data = await response.json();

    if (data && data.success && data.data) {
      const subjectList = data.data.map(subject => ({
        subjectID: subject.subjectID,
        subjectName: subject.subjectName,
        subject: subject.subjectName,
        content: '',
        updatedAt: '—'
      }));
      setSubjects(subjectList);
      return subjectList; // Return the subjects array
    } else if (data && Array.isArray(data)) {
      const subjectList = data.map(subject => ({
        subjectID: subject.subjectID,
        subjectName: subject.subjectName,
        subject: subject.subjectName,
        content: '',
        updatedAt: '—'
      }));
      setSubjects(subjectList);
      return subjectList; // Return the subjects array
    } else {
      setSubjects([]);
      return [];
    }
  } catch (err) {
    console.error("Error fetching syllabus subjects:", err);
    setSubjects([]);
    return [];
  }
}
async function getExamSyllabusBySubject(classID, sectionID, subjectID, selectExam, termName, pageNo = 1) {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');

    const params = new URLSearchParams({
      classID: String(classID),
      Terms: termName,
      pageNo: String(pageNo),
      branchID: String(branchID),
      subjectName: String(subjectID),     // ← key bhi subjectID; agar API subjectName key chahti hai to: subjectName: String(subjectID)
      ExamID: String(selectExam),       // ← ab selectExam (27) ja raha hai
      sectionID: String(sectionID),
    });

    const response = await fetch(
      buildUrl(`/api/getexamsyllabusbyclasstermsbranchsubject?${params.toString()}`),
      { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );

    const data = await response.json();
    return data?.data || data?.result || (Array.isArray(data) ? data : []);
  } catch (error) {
    console.log('Could not load subject syllabus', error);
    return [];
  }
}
const sylLoadClassSyllabus = async (key, cls) => {
  if (!sylCurrentExam) return;
  
  // Check if we already have the data in state
  const existingData = syllabusData[sylExamId]?.[key];
  
  if (existingData && existingData.length > 0) {
    // Data already loaded, no need to fetch again
    console.log('Using cached syllabus data for:', cls.gradeName);
    return;
  }
  
  // Only fetch if we don't have data (fallback)
  const rows = await getExamSyllabusByClassAndTerms(
    cls.classID,
    cls.sectionID,
    sylCurrentExam.selectExam,
    selectedTermId,
    1
  );
  
  // Map API rows -> { subject, content, updatedAt } shape
  const mapped = (rows || []).map(r => ({
    subject: r.subjectDisplayName || '',
    content: r.subjectDetails || '',
    updatedAt: r.updatedAt || r.UpdatedOn || '—',
  }));
  
  setSyllabusData(prev => ({
    ...prev,
    [sylExamId]: { ...(prev[sylExamId] || {}), [key]: mapped },
  }));
};
  async function getExamSyllabusByClassAndTerms(classID, sectionID, selectExam, termName, pageNo = 1) {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const empID = sessionStorage.getItem('employee_ID');
    const token = sessionStorage.getItem('token');

    const params = new URLSearchParams({
      branchID: String(branchID),
      classID: String(classID),
      Terms: termName,
      ExamID: String(selectExam),
      sectionID: String(sectionID),
      pageNo: String(pageNo),
      empID: String(empID),
    });

    const response = await fetch(
      buildUrl(`/api/getexamsyllabusbybranchclassandterms?${params.toString()}`),
      { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );

    const data = await response.json();
    return data?.data || data?.result || (Array.isArray(data) ? data : []);
  } catch (error) {
    console.log('Could not load class syllabus', error);
    return [];
  }
}
async function deleteSyllabusByAllIds(classID, sectionID, selectExam, termName) {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');

    const params = new URLSearchParams({
      classID: String(classID),
      Terms: termName,
      branchID: String(branchID),
      ExamID: String(selectExam),
      sectionID: String(sectionID),
    });

    const response = await fetch(
      buildUrl(`/api/deleteSyllabusbyALLIds?${params.toString()}`),
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: '*/*' } }
    );

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  } catch (error) {
    console.log('Could not delete syllabus', error);
    return { ok: false, data: null };
  }
}
const dsLoadClassDateSheet = async (key, cls) => {
  // Check if we already have the data in state
  const existingRows = dateSheets[dsExamId]?.[key];
  
  if (existingRows && existingRows.length > 0) {
    // Data already loaded, no need to fetch again
    console.log('Using cached date sheet data');
    return;
  }
  
  // Only fetch if we don't have data (fallback)
  const rows = await getDateSheetData(cls.classID, cls.sectionID, dsExamId, selectedTermId);
  setDateSheets(prev => ({
    ...prev,
    [dsExamId]: { ...(prev[dsExamId] || {}), [key]: rows },
  }));
};
const deleteSingleAssessment = async (examId, classID, sectionID, termId) => {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');
    
    // Find the selected exam to get the selectExam value
    const selectedExam = filtered.find(ex => ex.id === examId);
    const selectExamValue = selectedExam ? selectedExam.selectExam : examId;
    
    const params = new URLSearchParams({
      classID: String(classID),
      sectionID: String(sectionID),
      termID: String(termId),
      examID: String(selectExamValue)
    });
    
    console.log("Deleting single assessment with params:", {
      classID,
      sectionID,
      termID: termId,
      examID: selectExamValue
    });
    
    const response = await fetch(
      buildUrl(`/api/deletesingleassessment?${params.toString()}`),
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );
    
    const data = await response.json();
    console.log("Delete API Response:", data);
    
    return { success: response.ok, data };
  } catch (error) {
    console.error("Error deleting single assessment:", error);
    return { success: false, error };
  }
};
useEffect(() => {
  if (terms && terms.length > 0 && !selectedTermId) {
    // Select the first term by default
    const firstTerm = terms[0];
    setTerm(firstTerm.term);
    setSelectedTermId(firstTerm.id);
    // Fetch exams for the first term
    getExamsByTerm(firstTerm.id);
  }
}, [terms]);
  return (
    <>
      <style>{EXAM_CSS}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-file-pen"></i>
          </div>
          <div>
            <div className="page-title">Examination</div>
            <div className="page-sub">Manage exams, date sheets, syllabus, question bank &amp; results</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Examination module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* ── Module tabs ── */}
      <div className="exam-tabs-row">
        <button className={`exam-tab${tab === 'setup' ? ' active' : ''}`} onClick={() => setTab('setup')}>
          <i className="fa-solid fa-gear"></i> Exam Setup
        </button>
        <button className={`exam-tab${tab === 'datesheet' ? ' active' : ''}`} onClick={() => setTab('datesheet')}>
          <i className="fa-solid fa-calendar-days"></i> Date Sheet
        </button>
        <button className={`exam-tab${tab === 'syllabus' ? ' active' : ''}`} onClick={() => setTab('syllabus')}>
          <i className="fa-solid fa-book-open"></i> Syllabus
        </button>
        <button className={`exam-tab${tab === 'results' ? ' active' : ''}`} onClick={() => setTab('results')}>
          <i className="fa-solid fa-chart-bar"></i> Results
        </button>
      </div>

      {/* ── Exam Setup ── */}
      {tab === 'setup' && (
        <>

<div className="exam-term-chips">
  {terms.map((t) => (
    <button
      key={t.id}
      className={`exam-term-chip${selectedTermId === t.id ? ' active' : ''}`}
      onClick={() => {
        setTerm(t.term);
        setSelectedTermId(t.id);
        getExamsByTerm(t.id);
      }}
    >
      {t.term}
    </button>
  ))}
</div>
          <div className="exam-action-bar">
            <Tooltip text="Create a new exam for this term">
              <button className="exam-add-btn" onClick={openAdd}>
                <i className="fa-solid fa-plus"></i> Add Exam
              </button>
            </Tooltip>
            <div style={{ display: 'flex', gap: 8 }}>
              <Tooltip text="Download a PDF report of all exams in this term">
                <button className="export-btn pdf" onClick={() => setReportReq({ scope: 'all', name: 'All Exams' })}>
                  <i className="fa-solid fa-file-pdf"></i> PDF
                </button>
              </Tooltip>
              <Tooltip text="Download a Word report of all exams in this term">
                <button className="export-btn word" onClick={() => setReportReq({ scope: 'all', name: 'All Exams' })}>
                  <i className="fa-brands fa-microsoft"></i> Word
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="section-card" style={{ animation: 'fadeSlide .25s ease both' }}>
            <div className="exam-table-head">
              <div className="exam-th">S. No.</div>
              <div className="exam-th">Exam Name</div>
              <div className="exam-th" style={{ textAlign: 'center' }}>Status</div>
              <div className="exam-th"></div>
              <div className="exam-th"></div>
              <div className="exam-th" style={{ textAlign: 'right' }}>Detail</div>
            </div>

            {filtered.length === 0 ? (
              <div className="no-data" style={{ padding: 28 }}>
                No exams in this term yet. Click <strong>+ Add Exam</strong> to create one.
              </div>
            ) : (
              filtered.map((ex, i) => {
                const st  = getExamStatus(ex);
                const dur = calcDuration(ex.from, ex.to);
                const isOpen = openExamId === ex.id;
                return (
                  <div key={ex.id} className="exam-row-wrap">
                    <div className={`exam-row${isOpen ? ' open' : ''}`} onClick={() => setOpenExamId(isOpen ? null : ex.id)}>
                      <div className="exam-td sno"><span className="sno-hash">#</span>&nbsp;{i + 1}</div>
                      <div className="exam-td name" style={{ gap: 10 }}>
                        <div className="exam-name-icon"><i className="fa-solid fa-file-pen"></i></div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{ex.name}</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            {ex.classes.length} Class{ex.classes.length !== 1 ? 'es' : ''} · {formatDate(ex.to || '—')}
                          </div>
                        </div>
                      </div>
                      <div className="exam-td" style={{ justifyContent: 'center' }}>
                        <span className={`exam-status-badge ${st.cls}`}>
                          <i className={`fa-solid ${st.icon}`}></i> {st.label}
                        </span>
                      </div>
                      <div className="exam-td" onClick={e => e.stopPropagation()}>
                        <Tooltip text={`Edit ${ex.name}`}>
                          <button className="exam-edit-btn" onClick={() => openEdit(ex)}>
                            <i className="fa-solid fa-pen-to-square"></i> Edit
                          </button>
                        </Tooltip>
                      </div>
                      <div className="exam-td" onClick={e => e.stopPropagation()} style={{ gap: 6 }}>
                        <Tooltip text={`Download PDF for ${ex.name}`}>
                          <button className="export-btn pdf" onClick={() => setReportReq({ scope: ex.id, name: ex.name })}>
                            <i className="fa-solid fa-file-pdf"></i> PDF
                          </button>
                        </Tooltip>
                        <Tooltip text={`Download Word for ${ex.name}`}>
                          <button className="export-btn word" onClick={() => setReportReq({ scope: ex.id, name: ex.name })}>
                            <i className="fa-brands fa-microsoft"></i> Word
                          </button>
                        </Tooltip>
                      </div>
                      <div className="exam-td" style={{ justifyContent: 'flex-end', gap: 8 }} onClick={e => e.stopPropagation()}>
                     <Tooltip text={`Delete ${ex.name}`}>
  <button
    className="exam-del-btn"
    onClick={() => setConfirmDel(ex)}
  >
    <i className="fa-solid fa-trash"></i>
  </button>
</Tooltip>
                        <Tooltip text={isOpen ? 'Hide exam details' : 'Show exam details'}>
                          <button className={`exam-expand-btn${isOpen ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setOpenExamId(isOpen ? null : ex.id); }}>
                            <i className="fa-solid fa-chevron-down"></i>
                          </button>
                        </Tooltip>
                      </div>
                    </div>

                    <div className={`exam-detail${isOpen ? ' open' : ''}`} style={{ maxHeight: isOpen ? 400 : 0 }}>
                      <div style={{ padding: '16px 20px 18px', background: 'linear-gradient(135deg,rgba(30,58,138,.02),rgba(30,58,138,.05))' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-light)' }}>
                          <div className="exam-detail-item">
                            <div className="exam-detail-icon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}>
                              <i className="fa-solid fa-file-pen"></i>
                            </div>
                            <div>
                              <div className="exam-detail-label">Exam Name</div>
                              <div className="exam-detail-val">{ex.name}</div>
                            </div>
                          </div>
                          <div className="exam-detail-item">
                            <div className="exam-detail-icon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}>
                              <i className="fa-solid fa-users-rectangle"></i>
                            </div>
                            <div>
                              <div className="exam-detail-label">Classes ({ex.classes.length})</div>
                             <div className="exam-detail-val classes-list">
  {ex.classes.map(c => (
    <span key={c.classID} className="exam-class-pill">
      {c.gradeName} - {c.sectionName}
    </span>
  ))}
</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                          <div className="exam-detail-item">
                            <div className="exam-detail-icon" style={{ background: 'rgba(124,58,237,.1)', color: '#7C3AED' }}>
                              <i className="fa-solid fa-hourglass-half"></i>
                            </div>
                            <div>
                              <div className="exam-detail-label">Duration</div>
<div className="exam-detail-val">
  {calcDuration(ex.from, ex.to)}
</div>                            </div>
                          </div>
                          <div className="exam-detail-item">
                            <div className="exam-detail-icon" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}>
                              <i className="fa-regular fa-calendar-plus"></i>
                            </div>
                            <div>
                              <div className="exam-detail-label">Start Date</div>
                              <div className="exam-detail-val">{formatDate(ex.from)}</div>
                            </div>
                          </div>
                          <div className="exam-detail-item">
                            <div className="exam-detail-icon" style={{ background: 'rgba(220,38,38,.08)', color: '#DC2626' }}>
                              <i className="fa-regular fa-calendar-xmark"></i>
                            </div>
                            <div>
                              <div className="exam-detail-label">End Date</div>
                              <div className="exam-detail-val">{formatDate(ex.to)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── Date Sheet ── */}
   {tab === 'datesheet' && (
  <>
    <div className="exam-term-chips">
      {terms.map(t => (
        <button
          key={t.id}
          className={`exam-term-chip${selectedTermId === t.id ? ' active' : ''}`}
          onClick={() => {
            setTerm(t.term);
            setSelectedTermId(t.id);
            getExamsByTerm(t.id);
          }}
        >
          {t.term}
        </button>
      ))}
    </div>

    {filtered.length > 0 && (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-file-pen" style={{ color: 'var(--brand-primary)' }}></i> Select Exam
          <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {filtered.map(ex => (
            <button
              key={ex.id}
              className={`ds-exam-btn${dsExamId === ex.id ? ' active' : ''}`}
              onClick={() => dsPickExam(ex.id)}
            >
              <i className="fa-solid fa-file-pen"></i> {ex.name}
            </button>
          ))}
        </div>
      </div>
    )}

    {dsCurrentExam && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <Tooltip text={`Download date sheet PDF for all classes in ${dsCurrentExam.name}`}>
          <button className="export-btn pdf" onClick={() => setDsReportReq({ classKey: 'all', name: `All Classes — ${dsCurrentExam.name}` })}>
            <i className="fa-solid fa-file-pdf"></i> PDF
          </button>
        </Tooltip>
        <Tooltip text={`Download date sheet in Word for ${dsCurrentExam.name}`}>
          <button className="export-btn word" onClick={() => setDsReportReq({ classKey: 'all', name: `All Classes — ${dsCurrentExam.name}` })}>
            <i className="fa-brands fa-microsoft"></i> Word
          </button>
        </Tooltip>
      </div>
    )}

    <div id="dsClassesPanel">
      {!dsCurrentExam ? (
        <div className="ds-empty" style={{ marginTop: 4 }}>
          <i className="fa-solid fa-hand-pointer" style={{ display: 'block', fontSize: 22, marginBottom: 10, color: 'var(--border-med)' }}></i>
          {filtered.length === 0 ? 'No exams in this term yet. Add one from Exam Setup.' : 'Select an exam above to view its classes'}
        </div>
      ) : examClasses.length === 0 ? (
        <div className="ds-empty">No classes assigned to this exam.<br />Edit the exam in Exam Setup to assign classes.</div>
      ) : (
        <div className="section-card" style={{ animation: 'fadeSlide .25s ease both', overflow: 'visible' }}>
          <div className="ds-table-head">
            <div className="ds-th">S. No.</div>
            <div className="ds-th">Class Name</div>
            <div className="ds-th">Section</div>
            <div className="ds-th">Status</div>
            <div className="ds-th">Edit</div>
            <div className="ds-th">Reports</div>
            <div className="ds-th" style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {examClasses.map((cls, i) => {
            console.log('Rendering class row:', cls);
            const key = `cls_${dsExamId}_${cls.sectionID}_${i}`;
            const dsRows = dsExamSheets[key] || [];
            const hasDates = dsRows.length > 0;
            const isOpen = dsOpenKey === key;
            const className = `${cls.gradeName} - ${cls.sectionName}`;

            return (
              <div key={key} className="ds-row-wrap">
<div
  className={`ds-row${isOpen ? ' open' : ''}`}
  onClick={() => {
    const next = isOpen ? null : key;
    setDsOpenKey(next);
    if (next) dsLoadClassDateSheet(key, cls);
  }}
>                  <div className="ds-td" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    <span style={{ color: 'var(--brand-primary)', fontSize: 10 }}>#</span>&nbsp;{i + 1}
                  </div>
                  <div className="ds-td cls-name">
                    <div className="ds-cls-icon"><i className="fa-solid fa-users"></i></div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{className}</span>
                  </div>
                  <div className="ds-td" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{cls.sectionName}</div>
                  <div className="ds-td">
                    {hasDates
                      ? <span className="ds-has-badge"><i className="fa-solid fa-circle-check"></i> {dsRows.length} Subject{dsRows.length !== 1 ? 's' : ''}</span>
                      : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No date sheet</span>}
                  </div>
                  <div className="ds-td" onClick={e => e.stopPropagation()}>
                   <Tooltip text={`Edit date sheet for ${className}`}>
  <span>
    <button className="ds-edit-btn" onClick={() => dsOpenEdit(key, className, cls.classID, cls.sectionID)}>
      <i className="fa-solid fa-pen-to-square"></i> Edit
    </button>
  </span>
</Tooltip>
                  </div>
                  <div className="ds-td ds-actions-cell" onClick={e => e.stopPropagation()}>
                    <Tooltip text={`Download basic date sheet PDF for ${className}`}>
                      <button className="ds-report-btn" onClick={() => setDsReportReq({ classKey: key, name: className })}>
                        <i className="fa-solid fa-file-pdf"></i> Basic PDF
                      </button>
                    </Tooltip>
<Tooltip text={`Copy ${className}'s date sheet to other classes (only missing subjects)`}>
  <button className="ds-copy-row-btn" onClick={() => {
    if (!hasDates) { 
      toast('No date sheet to copy', 'warning'); 
      return; 
    }
    setDsConfirmCopy({
      examId: dsExamId, 
      sourceKey: key,
      count: examClasses.length - 1,
      examName: dsCurrentExam.name,
      sourceClassName: className,
      sourceRows: dsRows
    });
  }}>
    <i className="fa-regular fa-copy"></i> Copy
  </button>
</Tooltip>
                  </div>
                  <div className="ds-td ds-actions-cell" style={{ justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <Tooltip text={`Delete date sheet for ${className}`}>
  <button 
    className="ds-del-btn" 
    onClick={() => setDsConfirmDel({ 
      examId: dsExamId, 
      classKey: key, 
      className: className,
      classID: cls.classID,    // ← Add this
      sectionID: cls.sectionID  // ← Add this
    })}
  >
    <i className="fa-solid fa-trash"></i>
  </button>
</Tooltip>
                    <Tooltip text={isOpen ? 'Hide date sheet details' : 'Show date sheet details'}>
                     <button
  className={`ds-expand-btn${isOpen ? ' open' : ''}`}
  onClick={e => {
    e.stopPropagation();
    const next = isOpen ? null : key;
    setDsOpenKey(next);
    if (next) dsLoadClassDateSheet(key, cls);
  }}
>
  <i className="fa-solid fa-chevron-down"></i>
</button>
                    </Tooltip>
                  </div>
                </div>

                <div className={`ds-detail${isOpen ? ' open' : ''}`}>
                  <div className="ds-detail-inner">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                        <i className="fa-solid fa-calendar-days" style={{ color: 'var(--brand-primary)', marginRight: 5 }}></i>
                        Date Sheet — {className}
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div className="ds-subj-table-head">
                        <div className="ds-subj-th">#</div>
                        <div className="ds-subj-th">Subject</div>
                        <div className="ds-subj-th">Date</div>
                        <div className="ds-subj-th">Time From</div>
                        <div className="ds-subj-th">Time To</div>
                      </div>
                      {hasDates
                        ? dsRows.map((s, si) => (
                            <div key={si} className="ds-subj-row">
                              <div className="ds-subj-td" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                <span style={{ color: 'var(--brand-primary)', fontSize: 10 }}>#</span>&nbsp;{si + 1}
                              </div>
                              <div className="ds-subj-td name">
                                <div className="ds-subj-icon"><i className="fa-solid fa-book-open"></i></div>{s.subject}
                              </div>
                              <div className="ds-subj-td">{s.date || '—'}</div>
                              <div className="ds-subj-td">{s.timeFrom || '—'}</div>
                              <div className="ds-subj-td">{s.timeTo || '—'}</div>
                            </div>
                          ))
                        : <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No subjects yet. Click <strong>Edit</strong> to add subjects.</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </>
)}
      {/* ── Syllabus ── */}
      {tab === 'syllabus' && (
        <>
          <div className="exam-term-chips">
 {terms.map(t => (
               <button
          key={t.id}
          className={`exam-term-chip${selectedTermId === t.id ? ' active' : ''}`}
          onClick={() => {
            setTerm(t.term);
            setSelectedTermId(t.id);
            getExamsByTerm(t.id);
          }}
        >
          {t.term}
        </button>
            ))}

          </div>

          {filtered.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-book-open" style={{ color: 'var(--brand-primary)' }}></i> Select Exam
                <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {filtered.map(ex => (
                  <button
                    key={ex.id}
                    className={`ds-exam-btn${sylExamId === ex.id ? ' active' : ''}`}
                    onClick={() => sylPickExam(ex.id)}
                  >
                    <i className="fa-solid fa-book-open"></i> {ex.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {sylCurrentExam && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
              <Tooltip text={`Download syllabus PDF for all classes in ${sylCurrentExam.name}`}>
                <button className="export-btn pdf" onClick={() => setSylReportReq({ classKey: 'all', name: `All Classes — ${sylCurrentExam.name}` })}>
                  <i className="fa-solid fa-file-pdf"></i> PDF
                </button>
              </Tooltip>
              <Tooltip text={`Download syllabus in Word for ${sylCurrentExam.name}`}>
                <button className="export-btn word" onClick={() => setSylReportReq({ classKey: 'all', name: `All Classes — ${sylCurrentExam.name}` })}>
                  <i className="fa-brands fa-microsoft"></i> Word
                </button>
              </Tooltip>
            </div>
          )}

         <div id="sylClassesPanel">
  {!sylCurrentExam ? (
    <div className="ds-empty" style={{ marginTop: 4 }}>
      <i className="fa-solid fa-hand-pointer" style={{ display: 'block', fontSize: 22, marginBottom: 10, color: 'var(--border-med)' }}></i>
      {filtered.length === 0 ? 'No exams in this term yet. Add one from Exam Setup.' : 'Select an exam above to view its classes'}
    </div>
  ) : examClasses.length === 0 ? (
    <div className="ds-empty">No classes assigned to this exam.<br />Edit the exam in Exam Setup to assign classes.</div>
  ) : (
    <div className="section-card" style={{ animation: 'fadeSlide .25s ease both', overflow: 'visible' }}>
      <div className="syl-table-head">
        <div className="syl-th">S. No.</div>
        <div className="syl-th">Class Name</div>
        <div className="syl-th">Section</div>
        <div className="syl-th">Status</div>
        <div className="syl-th">Edit</div>
        <div className="syl-th">Report</div>
        <div className="syl-th" style={{ textAlign: 'right' }}>Actions</div>
      </div>

      {examClasses.map((cls, i) => {
        const key    = `scls_${sylExamId}_${cls.sectionID}_${i}`;
        const data   = sylExamData[key] || [];
        const hasSyl = data.length > 0;
        const ovSt   = sylClassStatus(data);
        const isOpen = sylOpenKey === key;
        const className = `${cls.gradeName} - ${cls.sectionName}`;
 console.log(examClasses,"examclases");
        return (
          <div key={key} className="syl-row-wrap">
<div
  className={`syl-row${isOpen ? ' open' : ''}`}
  onClick={() => {
    const next = isOpen ? null : key;
    setSylOpenKey(next);
    if (next) sylLoadClassSyllabus(key, cls);
  }}
>              <div className="syl-td" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                <span style={{ color: 'var(--brand-primary)', fontSize: 10 }}>#</span>&nbsp;{i + 1}
              </div>
              <div className="syl-td cls-name">
                <div className="syl-cls-icon"><i className="fa-solid fa-users"></i></div>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{className}</span>
              </div>
              <div className="syl-td" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{cls.sectionName}</div>
              <div className="syl-td">
                <span className={`syl-status-badge ${ovSt.cls}`}>
                  <i className={`fa-solid ${ovSt.icon}`}></i> {ovSt.label}
                </span>
              </div>
              <div className="syl-td" onClick={e => e.stopPropagation()}>
                <Tooltip text={`Edit syllabus for ${className}`}>
<button
  className="syl-edit-btn"
  onClick={() => {
    getSyllabusSubjects(cls.classID , cls.sectionID);
    sylOpenEdit(key, className, cls.classID, cls.sectionID);
  }}
>                    <i className="fa-solid fa-pen-to-square"></i> Edit
                  </button>
                </Tooltip>
              </div>
              <div className="syl-td" onClick={e => e.stopPropagation()}>
                <Tooltip text={`Download syllabus PDF for ${className}`}>
                  <button className="syl-report-btn" onClick={() => setSylReportReq({ classKey: key, name: className })}>
                    <i className="fa-solid fa-file-pdf"></i> Report
                  </button>
                </Tooltip>
              </div>
              <div className="syl-td" style={{ gap: 6, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                <Tooltip text={`Delete syllabus for ${className}`}>
<button className="syl-del-btn" onClick={() => setSylConfirmDel({ examId: sylExamId, classKey: key, className, classID: cls.classID, sectionID: cls.sectionID })}>                    <i className="fa-solid fa-trash"></i>
                  </button>
                </Tooltip>
                <Tooltip text={isOpen ? 'Hide syllabus details' : 'Show syllabus details'}>
                  <button className={`syl-expand-btn${isOpen ? ' open' : ''}`} onClick={e => {
  e.stopPropagation();
  const next = isOpen ? null : key;
  setSylOpenKey(next);
  if (next) sylLoadClassSyllabus(key, cls);
}}>
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className={`syl-detail${isOpen ? ' open' : ''}`}>
              <div className="syl-detail-inner">
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  <i className="fa-solid fa-book-open" style={{ color: 'var(--brand-primary)', marginRight: 5 }}></i>
                  Syllabus — {className}
                </div>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div className="syl-subj-table-head">
                    <div className="syl-subj-th">#</div>
                    <div className="syl-subj-th">Subject</div>
                    <div className="syl-subj-th">Summary</div>
                    <div className="syl-subj-th">Status</div>
                  </div>
                  {hasSyl ? data.map((s, si) => {
                    const plainAll = (s.content || '').replace(/<[^>]+>/g, '').trim();
                    const plain    = plainAll ? plainAll.substring(0, 60) + (plainAll.length > 60 ? '…' : '') : '—';
                    const added    = plainAll.length > 0;
                    return (
                      <div key={si} className="syl-subj-row">
                        <div className="syl-subj-td" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                          <span style={{ color: 'var(--brand-primary)', fontSize: 10 }}>#</span>&nbsp;{si + 1}
                        </div>
                        <div className="syl-subj-td name">
                          <div className="syl-subj-icon"><i className="fa-solid fa-book-open"></i></div>{s.subject}
                        </div>
                        <div className="syl-subj-td"><span className="syl-summary-text">{plain}</span></div>
                        <div className="syl-subj-td">
                          <span className={`syl-subj-status ${added ? 'completed' : 'pending'}`}>
                            <span className="dot"></span>{added ? 'Added' : 'Not Added'}
                          </span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                      No syllabus yet. Click <strong>Edit</strong> to add.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>
        </>
      )}

      {tab === 'results' && (
        <>
          {/* ── Level-1 sub-tabs ── */}
          <div className="res-sub-tabs">
            {[
              { k:'resultsetup',        l:'Result Setup' },
              { k:'singleassessment',   l:'Single Assessment Result' },
              { k:'combinedassessment', l:'Combined Assessment Result' },
              { k:'resulthistory',      l:'Result History' },
            ].map(it => (
              <button
                key={it.k}
                className={`res-sub-tab${rsTab === it.k ? ' active' : ''}`}
                onClick={() => setRsTab(it.k)}
              >
                {it.l}
              </button>
            ))}
          </div>

          {/* ── Result Setup sub-panel ── */}
          {rsTab === 'resultsetup' && (
            <>
              {/* Level-2 inner tabs */}
              <div className="rs-l2-tabs">
                <button className={`rs-l2-tab${rsL2 === 'setup' ? ' active' : ''}`}        onClick={() => setRsL2('setup')}>Result Setup</button>
                <button className={`rs-l2-tab${rsL2 === 'cardoptions' ? ' active' : ''}`} onClick={() => setRsL2('cardoptions')}>Result Card Options</button>
              </div>

              {rsL2 === 'setup' && (
                <>
                  {/* Top action row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
                    <button className="export-btn pdf" onClick={() => setRsReportReq(true)}>
                      <i className="fa-solid fa-file-pdf"></i> PDF
                    </button>
                    <button className="rs-edit-btn" onClick={() => setRsModalOpen(true)}>
                      <i className="fa-solid fa-pen-to-square"></i> Edit
                    </button>
                  </div>

                  {/* Grade Card */}
                  <div className="rs-card">
                    <div className="rs-card-head">
                      <div className="rs-card-icon"><i className="fa-solid fa-chart-bar"></i></div>
                      <span className="rs-card-title">Grade</span>
                    </div>
                    <div className="rs-grades-cols">
                      <div className="rs-grades-col sno">Sr.no</div>
                      <div className="rs-grades-col grade">Grade</div>
                      <div className="rs-grades-col pct">Percentage</div>
                      <div className="rs-grades-col cmt">Comment</div>
                    </div>
                    {rsGrades.length ? rsGrades.map((g, i) => (
                      <div key={g.id} className="rs-grade-row">
                        <div className="rs-grades-col sno">{i + 1}</div>
                        <div className="rs-grades-col grade">
                          <span className="rs-grade-chip" style={{ background: RS_GRADE_COLORS[g.grade] || '#1E3A8A' }}>{g.grade}</span>
                        </div>
                        <div className="rs-grades-col pct">
                          <span className="rs-pct-pill">{(RS_COND_MAP[g.cond] || '≥') + ' ' + g.pct}</span>
                        </div>
                        <div className="rs-grades-col cmt">{g.comment}</div>
                      </div>
                    )) : <div className="rs-empty">No grades configured</div>}
                  </div>

                  {/* Signature Card */}
                  <div className="rs-card">
                    <div className="rs-card-head">
                      <div className="rs-card-icon"><i className="fa-solid fa-signature"></i></div>
                      <span className="rs-card-title">Signature</span>
                    </div>
                    <div className="rs-sigs-cols">
                      <div className="rs-sigs-col sno">Sr.no</div>
                      <div className="rs-sigs-col name">Name</div>
                      <div className="rs-sigs-col desig">Designation</div>
                      <div className="rs-sigs-col sig">Signature</div>
                    </div>
                    {rsSigs.length ? rsSigs.map((s, i) => (
                      <div key={s.id} className="rs-sig-row">
                        <div className="rs-sigs-col sno">{i + 1}</div>
                        <div className="rs-sigs-col name">{s.name}</div>
                        <div className="rs-sigs-col desig">{s.desig}</div>
                        <div className="rs-sigs-col sig">
                          {s.img
                            ? <img src={s.img} alt="" style={{ maxHeight: 36, maxWidth: 100, objectFit: 'contain' }} />
                            : <div className="rs-sig-initial">{(s.name || '?').charAt(0).toUpperCase()}</div>}
                        </div>
                      </div>
                    )) : <div className="rs-empty">No signatures added</div>}
                  </div>

                  {/* Final Remarks Card */}
                  <div className="rs-card">
                    <div className="rs-card-head">
                      <div className="rs-card-icon"><i className="fa-solid fa-comment-dots"></i></div>
                      <span className="rs-card-title">Final Remarks</span>
                    </div>
                    <div className="rs-rem-cols">
                      <div className="rs-rem-col sno">Sr.no</div>
                      <div className="rs-rem-col total">Total Marks</div>
                      <div className="rs-rem-col pct">Percentage</div>
                      <div className="rs-rem-col text">Remarks</div>
                    </div>
                    {rsRemarks.length ? rsRemarks.map((r, i) => (
                      <div key={r.id} className="rs-rem-row">
                        <div className="rs-rem-col sno">{i + 1}</div>
                        <div className="rs-rem-col total">Total Marks</div>
                        <div className="rs-rem-col pct">
                          <span className="rs-pct-pill">{(RS_COND_MAP[r.cond] || '≥') + ' ' + r.pct}</span>
                        </div>
                        <div className="rs-rem-col text">{r.text}</div>
                      </div>
                    )) : <div className="rs-empty">No remarks configured</div>}
                  </div>

                  {/* Absent Handling Card */}
                  <div className="rs-card" style={{ marginTop: 16 }}>
                    <div className="rs-card-head">
                      <div className="rs-card-icon"><i className="fa-solid fa-user-xmark"></i></div>
                      <span className="rs-card-title">Absent Subject Handling</span>
                    </div>
                    <div className="rs-absent-summary">
                      <div className="rs-abs-icon" style={{
                        background: rsAbsentMode === 'zero' ? 'rgba(217,119,6,.1)' : 'rgba(30,64,175,.1)',
                        color:      rsAbsentMode === 'zero' ? '#B45309'              : '#1E40AF',
                      }}>
                        <i className={`fa-solid ${rsAbsentMode === 'zero' ? 'fa-calculator' : 'fa-circle-minus'}`}></i>
                      </div>
                      <div className="rs-abs-body">
                        <div className="rs-abs-title">
                          {rsAbsentMode === 'zero'
                            ? 'Count Absent Subjects as Zero Marks'
                            : 'Exclude Absent Subjects from Total Marks'}
                        </div>
                        <div
                          className="rs-abs-desc"
                          dangerouslySetInnerHTML={{
                            __html: rsAbsentMode === 'zero'
                              ? 'Absent subjects are scored as 0 and included in the full total. Card shows <strong>AB / 0</strong>.'
                              : 'Absent subjects are removed from the total. Student is assessed on attended subjects only. Card shows <strong>AB</strong>.',
                          }}
                        />
                      </div>
                      <span className={`rs-abs-badge${rsAbsentMode === 'zero' ? ' zero' : ''}`}>
                        {rsAbsentMode === 'zero' ? 'AB / 0' : 'AB'}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {rsL2 === 'cardoptions' && (
                <>
                  {/* ── Template selection ── */}
                  <div className="rct-grid">
                    {RC_TEMPLATES.map(t => {
                      const sel = rcTemplate === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`rct-card${sel ? ' selected' : ''}`}
                          style={{
                            '--rct-accent':       t.accent,
                            '--rct-accent-light': t.accentLight,
                            '--rct-accent-bg':    t.accentBg,
                          }}
                          onClick={() => setRcTemplate(t.id)}
                        >
                          <div className={`rct-check${sel ? '' : ' hollow'}`} onClick={e => { e.stopPropagation(); setRcTemplate(t.id); }}>
                            {sel && <i className="fa-solid fa-check"></i>}
                          </div>
                          <div className="rct-preview"><TemplateHero id={t.id} /></div>
                          <div className="rct-body">
                            <div className="rct-title-row">
                              <div className="rct-title">{t.name}</div>
                              {t.badge && (
                                <span className={`rct-badge ${t.badge.cls}`}>{t.badge.label}</span>
                              )}
                            </div>
                            <div className="rct-desc">{t.desc}</div>
                            <div className="rct-pages">
                              <div className="rct-pages-row">
                                <span><i className="fa-solid fa-file" style={{ color: '#1E40AF' }}></i> Single Assessment</span>
                                <span style={{ color: t.pages.singleCol || '#1E40AF', fontWeight: 700 }}>{t.pages.single}</span>
                              </div>
                              <div className="rct-pages-row">
                                <span><i className="fa-solid fa-layer-group" style={{ color: '#7C3AED' }}></i> Combined Assessment</span>
                                <span style={{ color: t.pages.combinedCol, fontWeight: 700 }}>{t.pages.combined}</span>
                              </div>
                            </div>
                            <div className="rct-tags">
                              {t.tags.map((tg, ti) => (
                                <span key={ti} className="rct-tag">
                                  <i className={`fa-solid ${tg.i}`}></i> {tg.label}
                                </span>
                              ))}
                            </div>
                            <Tooltip text="Preview this result card template">
                              <button
                                type="button"
                                className="rct-preview-btn"
                                onClick={e => { e.stopPropagation(); setRcPreviewId(t.id); }}
                              >
                                <i className="fa-solid fa-eye"></i> Preview
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Visibility Options ── */}
                  <div className="rs-card" style={{ marginTop: 16 }}>
                    <div className="rs-card-head">
                      <div className="rs-card-icon"><i className="fa-solid fa-sliders"></i></div>
                      <div style={{ flex: 1 }}>
                        <div className="rs-card-title">Visibility Options</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                          Choose what appears on the generated result card for parents and students.
                        </div>
                      </div>
                    </div>
                    <div style={{ padding: '18px 20px' }}>
                      <div className="rco-group-label">
                        <span className="rco-group-bar"></span>
                        <span>General</span>
                      </div>
                      <div className="rco-grid">
                        {rcoGeneral.map((item, idx) => (
                          <div key={item.label} className="rco-row">
                            <span className="rco-row-lbl">
                              <i className={`fa-solid ${item.icon}`} style={{ color: '#1E40AF', width: 14 }}></i>
                              {item.label}
                            </span>
                            <Tooltip text={item.on ? `Hide "${item.label}" on result card` : `Show "${item.label}" on result card`}>
                              <button
                                className={`rco-toggle${item.on ? ' on' : ''}`}
                                onClick={() => setRcoGeneral(g => g.map((it, i) => i === idx ? { ...it, on: !it.on } : it))}
                                aria-pressed={item.on}
                              >
                                <span className="rco-dot"></span>
                              </button>
                            </Tooltip>
                          </div>
                        ))}
                      </div>

                      <div className="rco-group-label" style={{ marginTop: 18 }}>
                        <span className="rco-group-bar"></span>
                        <span>Signatures &amp; Remarks</span>
                      </div>
                      <div className="rco-grid">
                        {rcoSig.map((item, idx) => (
                          <div key={item.label} className="rco-row">
                            <span className="rco-row-lbl">
                              <i className={`fa-solid ${item.icon}`} style={{ color: '#1E40AF', width: 14 }}></i>
                              {item.label}
                            </span>
                            <Tooltip text={item.on ? `Hide "${item.label}" on result card` : `Show "${item.label}" on result card`}>
                              <button
                                className={`rco-toggle${item.on ? ' on' : ''}`}
                                onClick={() => setRcoSig(g => g.map((it, i) => i === idx ? { ...it, on: !it.on } : it))}
                                aria-pressed={item.on}
                              >
                                <span className="rco-dot"></span>
                              </button>
                            </Tooltip>
                          </div>
                        ))}
                      </div>

                      <div className="rco-foot">
                        <div className="rco-foot-hint">
                          <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF', marginRight: 5 }}></i>
                          Changes apply to both Classic and Insight templates.
                        </div>
                        <button className="rco-save-btn" onClick={() => toast('Preferences saved!', 'success')}>
                          <i className="fa-solid fa-floppy-disk"></i> Save Preferences
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
{rsTab === 'singleassessment'   && (() => {
  const resCurrentExam = resExamId ? filtered.find(e => e.id === resExamId) : null;
  const resExamData    = resCurrentExam ? (resultData[resExamId] || {}) : {};
// Add this function to delete single assessment data

  const buildDefaultClass = () => ({
    released: false,
    totalMarks: { ...RES_DEFAULT_TOTALS },
    students: freshStudents(),
  });

  const calcOverall = (cd, st) => {
    const absSet = {};
    (st.absentSubjects || []).forEach(s => { absSet[s] = true; });
    const tot = st.absent
      ? Object.values(cd.totalMarks).reduce((a, b) => a + b, 0)
      : (rsAbsentMode === 'zero'
          ? Object.values(cd.totalMarks).reduce((a, b) => a + b, 0)
          : RES_SUBJECTS.reduce((a, s) => absSet[s] ? a : a + (cd.totalMarks[s] || 0), 0));
    const obt = st.absent ? 0 : RES_SUBJECTS.reduce((a, s) => a + (absSet[s] ? 0 : (st.obtained[s] || 0)), 0);
    const pct = tot && !st.absent ? Math.round((obt / tot) * 10000) / 100 : 0;
    const grade = (!st.absent && obt > 0) ? rcGetGrade(obt, tot) : null;
    return { tot, obt, pct, grade };
  };

 const togglePublish = (key, className, currentlyReleased, cls) => {
  setResConfirmPublish({ key, className, released: currentlyReleased, cls });
};
// Add this function to fetch visibility data for an exam
const getExamVisibility = async (examId, termId) => {
  try {
    const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');
    
    // Find the selected exam to get the selectExam value
    const selectedExam = filtered.find(ex => ex.id === examId);
    const selectExamValue = selectedExam ? selectedExam.selectExam : examId;
    
    const params = new URLSearchParams({
      termID: String(termId),
      examID: String(selectExamValue),
      branchID: String(branchID)
    });
    
    console.log("Fetching visibility for:", {
      termID: termId,
      examID: selectExamValue,
      branchID: branchID
    });
    
    const response = await fetch(
      buildUrl(`/api/sauploadmarksGetvisibility?${params.toString()}`),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );
    
    const data = await response.json();
    console.log("Visibility API Response:", data);
    
    return data;
  } catch (error) {
    console.error("Error fetching exam visibility:", error);
    return null;
  }
};
  // Single assessment ke liye exam select karne par classes API se load
  const resPickExam = async (id) => {
  setResExamId(id);
  setResOpenKey(null);
  setExamClasses([]);
  
  const selectedExam = filtered.find(ex => ex.id === id);
  if (selectedExam) {
    const selectExamId = selectedExam.selectExam;
    const termID = selectedExam.termID;
    
    // Get classes
    const classes = await getExamClasses(selectExamId, termID);
    setExamClasses(classes);
    
    // 📌 Call the visibility API
    try {
      const branchID = sessionStorage.getItem('branchID');
      const token = sessionStorage.getItem('token');
      
      const params = new URLSearchParams({
        termID: String(termID),
        examID: String(selectExamId),
        branchID: String(branchID)
      });
      
      const response = await fetch(
        buildUrl(`/api/sauploadmarksGetvisibility?${params.toString()}`),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          }
        }
      );
      
      const data = await response.json();
      console.log("Visibility API Response:", data);
      
      // Store visibility data if needed
      // setVisibilityData(data);
      
    } catch (error) {
      console.error("Error fetching visibility:", error);
    }
  }
};

  return (
    <>
      {/* Term chips — API se */}
      <div className="exam-term-chips">
        {terms.map(t => (
          <button
            key={t.id}
            className={`exam-term-chip${selectedTermId === t.id ? ' active' : ''}`}
            onClick={() => {
              setTerm(t.term);
              setSelectedTermId(t.id);
              getExamsByTerm(t.id);
              setResExamId(null);
              setResOpenKey(null);
              setExamClasses([]);
            }}
          >
            {t.term}
          </button>
        ))}
      </div>

      {/* Exam buttons — API se (filtered) */}
      {filtered.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-chart-bar" style={{ color: 'var(--brand-primary)' }}></i> Select Exam
            <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {filtered.map(ex => (
              <button
                key={ex.id}
                className={`ds-exam-btn${resExamId === ex.id ? ' active' : ''}`}
                onClick={() => resPickExam(ex.id)}
              >
                <i className="fa-solid fa-chart-bar"></i> {ex.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Classes panel — examClasses (API) se */}
      <div>
        {!resCurrentExam ? (
          <div className="ds-empty" style={{ marginTop: 4 }}>
            <i className="fa-solid fa-hand-pointer" style={{ display: 'block', fontSize: 22, marginBottom: 10, color: 'var(--border-med)' }}></i>
            {filtered.length === 0 ? 'No exams in this term yet. Add one from Exam Setup.' : 'Select an exam above to view classes'}
          </div>
        ) : examClasses.length === 0 ? (
          <div className="ds-empty">No classes assigned. Edit the exam in Exam Setup.</div>
        ) : (
          <div className="section-card" style={{ animation: 'fadeSlide .25s ease both', overflow: 'visible' }}>
            <div className="res-table-head">
              <div className="res-th">S. No.</div>
              <div className="res-th">Class Name</div>
              <div className="res-th">Section</div>
              <div className="res-th">Status</div>
              <div className="res-th">Publish</div>
              <div className="res-th">Total Marks</div>
              <div className="res-th" style={{ textAlign: 'right' }}>Actions</div>
            </div>
            {examClasses.map((cls, i) => {
              const key    = `rcls_${resExamId}_${cls.sectionID}_${i}`;
              const cd     = resExamData[key] || buildDefaultClass();
              const isOpen = resOpenKey === key;
              const isRel  = cd.released;
              const className = `${cls.gradeName} - ${cls.sectionName}`;
              return (
                <div key={key} className="res-row-wrap">
                  <div
                    className={`res-row${isOpen ? ' open' : ''}`}
onClick={() => {
  const next = isOpen ? null : key;
  setResOpenKey(next);
  if (next) loadResClassData(key, cls);
}}                  >
                    <div className="res-td" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                      <span style={{ color: 'var(--brand-primary)', fontSize: 10 }}>#</span>&nbsp;{i + 1}
                    </div>
                    <div className="res-td cls-name">
                      <div className="ds-cls-icon"><i className="fa-solid fa-users"></i></div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{className}</span>
                    </div>
                    <div className="res-td" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{cls.sectionName}</div>
                    <div className="res-td">
                      <span className={`res-released-badge${isRel ? ' released' : ' pending'}`}>
                        <i className={`fa-solid ${isRel ? 'fa-circle-check' : 'fa-clock'}`}></i>
                        {isRel ? 'Released' : 'Not Released'}
                      </span>
                    </div>
<div className="res-td" onClick={e => e.stopPropagation()}>
  <Tooltip text={isRel ? 'Unpublish this class result' : 'Publish this class result'}>
    <button
      className={`res-publish-btn${isRel ? ' released' : ''}`}
      onClick={e => { e.stopPropagation(); togglePublish(key, className, isRel, cls); }}
    >
      <i className={`fa-solid ${isRel ? 'fa-eye-slash' : 'fa-paper-plane'}`}></i>
      {isRel ? 'Unpublish' : 'Publish Result'}
    </button>
  </Tooltip>
</div>
                    <div className="res-td" onClick={e => e.stopPropagation()}>
                   <Tooltip text="Edit total marks for each subject">
  <button
    className="res-marks-btn"
    onClick={async () => {
      const fetchedSubjects = await getSyllabusSubjects(
  cls.classID,
  cls.sectionID
);

const saSubjects = await fetchSASubjects(
  cls.classID,
  cls.sectionID,
  resExamId
);
console.log("fetchedSubjects", fetchedSubjects);
console.log("saSubjects", saSubjects);

const mergedSubjects = fetchedSubjects.map(subject => {
  const match = saSubjects.find(
    s => Number(s.subjectID) === Number(subject.subjectID)
  );
console.log("match", match);

  return {
    ...subject,
    id: match?.id || 0,           // ← yeh add karo
    totalMarks: match?.totalMarks || "0"
  };
});
console.log("mergedSubjects", mergedSubjects);

setResTotalMarksCtx({
    selectExam: resCurrentExam?.selectExam || 0,  // ← add this
  examId: resExamId,
  key,
  className: cls.className,
  classID: cls.classID,
  sectionID: cls.sectionID,
  subjects: mergedSubjects
});
    }}
  >
    <i className="fa-solid fa-pen-to-square"></i> Total Marks
  </button>
</Tooltip>
                    </div>
                    <div className="res-td" style={{ justifyContent: 'flex-end', gap: 5 }} onClick={e => e.stopPropagation()}>
                      <Tooltip text="Download class result report"><button
                        className="res-download-btn"
                        onClick={e => { e.stopPropagation(); setResClassReportReq({ examId: resExamId, key, className }); }}
                      >
                        <i className="fa-solid fa-file-arrow-down"></i>
                      </button></Tooltip>
                      <Tooltip text="Delete class data"><button
                        className="ds-del-btn"
                        onClick={e => { e.stopPropagation(); setResConfirmDelete({ examId: resExamId, key, className }); }}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button></Tooltip>
                      <button
                        className={`ds-expand-btn${isOpen ? ' open' : ''}`}
onClick={e => { 
  e.stopPropagation(); 
  const next = isOpen ? null : key;
  setResOpenKey(next);
  if (next) loadResClassData(key, cls);
}}                      >
                        <i className="fa-solid fa-chevron-down"></i>
                      </button>
                    </div>
                  </div>

                  {/* Expanded student table */}
                  <div className={`res-detail${isOpen ? ' open' : ''}`}>
                    <div className="res-detail-inner">
                      {resLoadingKey === key ? (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 20, marginBottom: 8, display: 'block' }}></i>
        Loading student data...
      </div>
    ) : (
<div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
                        <i className="fa-solid fa-users" style={{ color: 'var(--brand-primary)', marginRight: 5 }}></i>
                        Student Results — {className}
                      {/* Subject count from API */}
<span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
  {resStudentData[key]?.subjects?.length || 0} Subject{(resStudentData[key]?.subjects?.length || 0) !== 1 ? 's' : ''}
</span>
                      </div>    )}
                      
                      <div className="res-student-scroll">
                        <table className="res-student-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Student Name</th>
                              <th>Father Name</th>
                              <th style={{ textAlign: 'center' }}>Subjects</th>
                              <th>Progress</th>
                              <th>Status</th>
                              <th style={{ textAlign: 'center' }}>Grade</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                           {(() => {
  const apiStudents = resStudentData[key]?.students || [];
  const apiMarks    = resStudentData[key]?.marks    || [];
  const apiSubjects = resStudentData[key]?.subjects  || [];
  const apiRankings = resStudentData[key]?.rankings  || [];
  const totalMarksSum = apiSubjects[0]?.totalMarksSum 
    ? Number(apiSubjects[0].totalMarksSum) 
    : 0;
  const subjCount = apiSubjects.length;

  if (!apiStudents.length) {
    return (
      <tr>
        <td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          No students found for this class.
        </td>
      </tr>
    );
  }

  return apiStudents.map((st, si) => {
    const marksEntry = apiMarks.find(m => m.studentID === st.id);
    const rankEntry  = apiRankings.find(r => r.studentID === st.id);
    const obtMarks   = marksEntry ? Number(marksEntry.obtainedMarks) : 0;
    const pct        = totalMarksSum > 0 ? Math.round((obtMarks / totalMarksSum) * 10000) / 100 : 0;
    const grade      = (obtMarks > 0 && totalMarksSum > 0) ? rcGetGrade(obtMarks, totalMarksSum) : null;
    const gradeBg    = grade ? (RS_GRADE_COLORS[grade.grade] || '#1E3A8A') : null;
    const hasMarks   = obtMarks > 0;
    const stStatus   = hasMarks ? 'Complete' : 'Incomplete';
    const stStatusCls  = hasMarks ? 'complete' : 'incomplete';
    const stStatusIcon = hasMarks ? 'fa-circle-check' : 'fa-circle-half-stroke';
    const progW = totalMarksSum > 0 ? Math.min(100, Math.round((obtMarks / totalMarksSum) * 100)) : 0;
    const progColor = hasMarks ? '#16A34A' : '#E2E8F0';

    return (
      <tr key={st.id}>
        <td style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{si + 1}</td>
        <td style={{ minWidth: 120 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 12.5 }}>
            {st.studentName}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
            {st.registrationNumber || '—'}
          </div>
        </td>
        <td style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 100 }}>
          {st.fatherName}
        </td>
        <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
          {subjCount}
        </td>
        <td style={{ minWidth: 110 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progW}%`, background: progColor, borderRadius: 3, transition: 'width .3s' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: progColor, flexShrink: 0 }}>
              {obtMarks}/{totalMarksSum || '—'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {pct > 0 ? `${pct}%` : 'No marks'}
          </div>
        </td>
        <td>
          <span className={`res-st-badge ${stStatusCls}`}>
            <i className={`fa-solid ${stStatusIcon}`}></i> {stStatus}
          </span>
        </td>
        <td style={{ textAlign: 'center' }}>
          {grade ? (
            <span className="res-grade-chip" style={{ background: gradeBg }}>{grade.grade}</span>
          ) : '—'}
        </td>
        <td>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
            <Tooltip text="Update marks for this student">
              <button
                className="res-action-btn"
               onClick={async () => {
  const subjects = await getSyllabusSubjects(cls.classID, cls.sectionID);
  console.log('subjects for marks modal:', subjects);
  setResUpdateCtx({ 
    examId: resExamId, 
    key, 
    studentId: st.id,
    subjects: subjects || []
  });
}}
              >
                <i className="fa-solid fa-pen-to-square"></i> Marks
              </button>
            </Tooltip>
            <Tooltip text="Add or edit remarks for this student">
              <button
                className="res-action-btn remarks"
                onClick={() => setResRemarksCtx({ examId: resExamId, key, studentId: st.id })}
              >
                <i className="fa-solid fa-comment-dots"></i> Remarks
              </button>
            </Tooltip>
            <Tooltip text="View this student's result card">
              <button
                className="res-action-btn view"
                onClick={() => setResCardCtx({ examId: resExamId, key, studentId: st.id, className })}
              >
                <i className="fa-solid fa-eye"></i> Card
              </button>
            </Tooltip>
          </div>
        </td>
      </tr>
    );
  });
})()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
})()}
          {rsTab === 'combinedassessment' && (() => {
            // Filter
            const filtered = cbrFilterClass
              ? cbrResults.filter(r => r.cls === cbrFilterClass)
              : cbrResults;

            // Group by base name (strip the " — Grade X" suffix)
            const groupName = cr => cr.name.replace(/\s*—\s*(Grade\s*\d|Class\s*\w).*$/i, '').trim();
            const groupMap = new Map();
            filtered.forEach(cr => {
              const gn = groupName(cr);
              if (!groupMap.has(gn)) {
                groupMap.set(gn, { name: gn, items: [], mainExam: cr.mainExam, subExams: cr.subExams, created: cr.created, published: 0 });
              }
              const g = groupMap.get(gn);
              g.items.push(cr);
              if (cr.published) g.published += 1;
            });
            const groups = [...groupMap.values()];

            const distinctClasses = new Set(filtered.map(r => r.cls)).size;

            return (
              <>
                {/* Inner tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                  <button className="cbr-tab active" type="button">
                    <i className="fa-solid fa-list-check"></i> Created
                  </button>
                  <Tooltip text="Create a new combined assessment result">
                    <button
                      className="cbr-tab"
                      type="button"
                      onClick={() => setCbrCreateOpen(true)}
                    >
                      <i className="fa-solid fa-plus"></i> Create New
                    </button>
                  </Tooltip>
                </div>

                {/* Filter row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <select
                    className="rs-input"
                    style={{ maxWidth: 220, padding: '7px 12px', fontSize: 12.5 }}
                    value={cbrFilterClass}
                    onChange={e => setCbrFilterClass(e.target.value)}
                  >
                    <option value="">All Classes</option>
                    {CBR_CLASS_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {filtered.length} result{filtered.length !== 1 ? 's' : ''} across {distinctClasses} class{distinctClasses !== 1 ? 'es' : ''}
                  </div>
                </div>

                {/* Groups list */}
                {!groups.length ? (
                  <div className="ds-empty" style={{ padding: '40px 20px' }}>
                    <i className="fa-solid fa-folder-open" style={{ display: 'block', fontSize: 28, marginBottom: 12, color: 'var(--border-med)' }}></i>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: 'var(--text-primary)' }}>No Combined Results</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Click <strong>Create New</strong> to build your first combined assessment result.</div>
                  </div>
                ) : groups.map(grp => {
                  const isActive = cbrActiveGroup === grp.name;
                  const totalCls = grp.items.length;
                  const pubCount = grp.published;
                  const allPub  = pubCount === totalCls;
                  const nonePub = pubCount === 0;
                  const statusTxt = allPub ? 'All Published' : nonePub ? 'Not Published' : `${pubCount}/${totalCls} Published`;
                  const statusCol = allPub ? '#16A34A' : nonePub ? '#D97706' : '#1E40AF';
                  const statusBg  = allPub ? 'rgba(22,163,74,.1)' : nonePub ? 'rgba(217,119,6,.1)' : 'rgba(30,64,175,.1)';

                  return (
                    <div key={grp.name} className={`cbr-group${isActive ? ' active' : ''}`}>
                      <div
                        className="cbr-group-head"
                        onClick={() => setCbrActiveGroup(isActive ? null : grp.name)}
                      >
                        <div className="cbr-group-icon"><i className="fa-solid fa-layer-group"></i></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cbr-group-name">{grp.name}</div>
                          <div className="cbr-group-meta">
                            <span><i className="fa-solid fa-book-open" style={{ color: '#1E40AF', fontSize: 9, marginRight: 3 }}></i>{grp.mainExam}</span>
                            <span style={{ color: 'var(--text-muted)' }}>·</span>
                            {grp.subExams.map(s => (
                              <span key={s} className="cbr-sub-chip">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="cbr-group-side">
                          <span className="cbr-status" style={{ background: statusBg, color: statusCol }}>{statusTxt}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            <i className="fa-solid fa-users" style={{ marginRight: 3, fontSize: 9, color: '#1E40AF' }}></i>
                            {totalCls} Class{totalCls > 1 ? 'es' : ''}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{grp.created}</span>
                        </div>
                        <i
                          className={`fa-solid fa-chevron-${isActive ? 'up' : 'down'}`}
                          style={{ marginLeft: 6, fontSize: 12, color: isActive ? '#1E40AF' : 'var(--text-muted)' }}
                        ></i>
                      </div>

                      {/* Class rows */}
                      {isActive && (
                        <div className="cbr-group-body">
                          <div className="cbr-group-body-label">
                            {totalCls} Class{totalCls > 1 ? 'es' : ''}
                          </div>
                          {grp.items.map((cr, ci) => {
                            const isOpen = cbrOpenKey === cr.id;
                            return (
                              <div key={cr.id} className="cbr-class-card">
                                <div
                                  className={`cbr-class-row${isOpen ? ' open' : ''}`}
                                  onClick={() => setCbrOpenKey(isOpen ? null : cr.id)}
                                >
                                  <div className="cbr-cls-sno">#{ci + 1}</div>
                                  <div className="cbr-cls-name">
                                    <div className="ds-cls-icon"><i className="fa-solid fa-users"></i></div>
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cr.cls}</div>
                                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Section {cr.section} · {cr.students.length} students</div>
                                    </div>
                                  </div>
                                  <div>
                                    <span className={`res-released-badge ${cr.published ? 'released' : 'pending'}`}>
                                      <i className={`fa-solid ${cr.published ? 'fa-circle-check' : 'fa-clock'}`}></i>
                                      {cr.published ? 'Published' : 'Not Published'}
                                    </span>
                                  </div>
                                  <div className="cbr-cls-actions" onClick={e => e.stopPropagation()}>
                                    <Tooltip text={cr.published ? 'Unpublish this combined result' : 'Publish this combined result'}>
                                      <button
                                        className={`res-publish-btn${cr.published ? ' released' : ''}`}
                                        onClick={e => { e.stopPropagation(); setCbrConfirmPublish({ classId: cr.id, className: cr.cls, published: cr.published }); }}
                                      >
                                        <i className={`fa-solid ${cr.published ? 'fa-eye-slash' : 'fa-paper-plane'}`}></i>
                                        {cr.published ? 'Unpublish' : 'Publish'}
                                      </button>
                                    </Tooltip>
                                    <Tooltip text="Download combined result report"><button
                                      className="res-download-btn"
                                     
                                      onClick={e => { e.stopPropagation(); setCbrReportReq({ classId: cr.id, className: cr.cls }); }}
                                    >
                                      <i className="fa-solid fa-file-arrow-down"></i>
                                    </button></Tooltip>
                                    <Tooltip text="Delete combined result"><button
                                      className="ds-del-btn"
                                     
                                      onClick={e => { e.stopPropagation(); setCbrConfirmDelete({ classId: cr.id, className: cr.cls }); }}
                                    >
                                      <i className="fa-solid fa-trash"></i>
                                    </button></Tooltip>
                                    <button
                                      className={`ds-expand-btn${isOpen ? ' open' : ''}`}
                                      onClick={e => { e.stopPropagation(); setCbrOpenKey(isOpen ? null : cr.id); }}
                                    >
                                      <i className="fa-solid fa-chevron-down"></i>
                                    </button>
                                  </div>
                                </div>

                                {/* Student table */}
                                {isOpen && (
                                  <div className="cbr-class-detail">
                                    <div className="cbr-table-wrap">
                                      <table className="cbr-student-table">
                                        <thead>
                                          <tr>
                                            <th>#</th>
                                            <th>Roll</th>
                                            <th>Student / Father</th>
                                            <th style={{ textAlign: 'center' }}>Main<br /><span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>Obt / Total</span></th>
                                            {(cr.students[0]?.subs || []).map(sb => (
                                              <th key={sb.name} colSpan={2} className="cbr-sub-th">
                                                <span>{sb.name}</span>
                                                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 500 }}>Orig / Conv</span>
                                              </th>
                                            ))}
                                            <th style={{ textAlign: 'center' }}>Grand<br /><span style={{ fontSize: 9, fontWeight: 500, color: 'var(--text-muted)' }}>Obt / Total</span></th>
                                            <th style={{ textAlign: 'center' }}>%</th>
                                            <th style={{ textAlign: 'center' }}>Grade</th>
                                            <th style={{ textAlign: 'center' }}>Pos.</th>
                                            <th>Card</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {cr.students.map((st, si) => {
                                            const grCol = RS_GRADE_COLORS[st.grade] || '#475569';
                                            const pctCol = st.pct >= 80 ? '#16A34A' : st.pct >= 60 ? '#D97706' : '#DC2626';
                                            return (
                                              <tr key={st.rollNo}>
                                                <td style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{si + 1}</td>
                                                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.rollNo}</td>
                                                <td>
                                                  <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text-primary)' }}>{st.name}</div>
                                                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{st.father}</div>
                                                </td>
                                                <td style={{ textAlign: 'center', fontSize: 11.5 }}>
                                                  <strong style={{ color: '#1E40AF' }}>{st.mainObt}</strong>
                                                  <span style={{ color: 'var(--text-muted)' }}> / {st.mainTotal}</span>
                                                </td>
                                                {st.subs.map(sb => (
                                                  <React.Fragment key={sb.name}>
                                                    <td className="cbr-sub-cell" style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                                                      {sb.subObt}/{sb.origT}
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: '#7C3AED' }}>
                                                      {sb.conv}/{sb.weight}
                                                    </td>
                                                  </React.Fragment>
                                                ))}
                                                <td style={{ textAlign: 'center', fontSize: 11.5 }}>
                                                  <strong style={{ color: '#16A34A' }}>{st.grandObt}</strong>
                                                  <span style={{ color: 'var(--text-muted)' }}> / {st.grandTotal}</span>
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 800, color: pctCol }}>{st.pct}%</td>
                                                <td style={{ textAlign: 'center' }}>
                                                  <span className="res-grade-chip" style={{ background: grCol }}>{st.grade}</span>
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: '#1E40AF' }}>{st.rank}</td>
                                                <td>
                                                  <Tooltip text="View combined result card">
                                                    <button
                                                      className="res-action-btn view"
                                                      onClick={() => setCbrCardCtx({ groupId: grp.name, classId: cr.id, studentRollNo: st.rollNo })}
                                                    >
                                                      <i className="fa-solid fa-eye"></i> Card
                                                    </button>
                                                  </Tooltip>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
          {rsTab === 'resulthistory' && (() => {
            const q = rhSearchQ.trim().toLowerCase();
            const filtered = RH_INITIAL_STUDENTS.filter(st => {
              if (q) {
                const hit = (
                  st.name.toLowerCase().includes(q) ||
                  st.rollNo.toLowerCase().includes(q) ||
                  st.father.toLowerCase().includes(q) ||
                  st.admission.toLowerCase().includes(q) ||
                  st.cls.toLowerCase().includes(q)
                );
                if (!hit) return false;
              }
              if (rhFilterSession && st.session !== rhFilterSession) return false;
              if (rhFilterClass   && st.cls     !== rhFilterClass)   return false;
              if (rhFilterSection && !st.cls.endsWith(`Section ${rhFilterSection}`)) return false;
              if (rhFilterExam    && !st.results.some(r => r.type === rhFilterExam)) return false;
              return true;
            });

            const distinctClasses = new Set(filtered.map(s => s.cls)).size;

            const studentCardSummary = st => {
              const pcts = st.results.map(r => r.pct);
              const avgPct = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0;
              const best   = pcts.length ? Math.max(...pcts) : 0;
              const trend  = pcts.length >= 2 ? (pcts[pcts.length - 1] > pcts[0] ? 'up' : pcts[pcts.length - 1] < pcts[0] ? 'down' : 'flat') : 'flat';
              const grade  = rcGetGrade(avgPct, 100);
              return { avgPct, best, trend, grade: grade ? grade.grade : '—' };
            };

            // ── Student detail view ──
            if (rhActiveStudent) {
              const st = rhActiveStudent;
              const { avgPct, best, grade: avgGrade } = studentCardSummary(st);
              const worst = st.results.length ? Math.min(...st.results.map(r => r.pct)) : 0;
              const initials = st.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
              const attCol  = st.attendance >= 90 ? '#16A34A' : st.attendance >= 75 ? '#D97706' : '#DC2626';
              const avgCol  = avgPct >= 80 ? '#16A34A' : avgPct >= 60 ? '#1E40AF' : '#D97706';
              const worstCol = worst >= 60 ? '#D97706' : '#DC2626';
              return (
                <>
                  {/* Back button */}
                  <button
                    type="button"
                    onClick={() => setRhActiveStudent(null)}
                    className="rh-back-btn"
                  >
                    <i className="fa-solid fa-arrow-left"></i> All Students
                  </button>

                  {/* Student header card */}
                  <div className="rh-profile-card">
                    <div className="rh-banner">
                      <div className="rh-banner-avatar">{initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{st.name}</div>
                        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>{st.father} · {st.cls}</div>
                        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', marginTop: 3 }}>
                          Roll: {st.rollNo} · Adm: {st.admission} · Session: {st.session}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{avgGrade}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 3 }}>Overall</div>
                      </div>
                    </div>
                    <div className="rh-kpi-strip">
                      {[
                        { label:'Exams',    val: st.results.length,       icon:'fa-clipboard-list', col:'#1E40AF' },
                        { label:'Average',  val: `${avgPct}%`,             icon:'fa-chart-line',     col: avgCol },
                        { label:'Best',     val: `${best}%`,               icon:'fa-star',           col:'#16A34A' },
                        { label:'Worst',    val: `${worst}%`,              icon:'fa-arrow-down',     col: worstCol },
                        { label:'Attend.',  val: `${st.attendance}%`,      icon:'fa-calendar-check', col: attCol  },
                      ].map((kpi, i, arr) => (
                        <div
                          key={kpi.label}
                          style={{
                            textAlign: 'center',
                            padding: '14px 8px',
                            borderRight: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
                          }}
                        >
                          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 5 }}>
                            <i className={`fa-solid ${kpi.icon}`} style={{ marginRight: 3, color: kpi.col }}></i>{kpi.label}
                          </div>
                          <div style={{ fontSize: 20, fontWeight: 900, color: kpi.col }}>{kpi.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    // Compute subject averages across single assessments
                    const subjTotals = {};
                    const subjCounts = {};
                    st.results.filter(r => r.type === 'single' && r.subjects).forEach(r => {
                      Object.entries(r.subjects).forEach(([s, v]) => {
                        subjTotals[s] = (subjTotals[s] || 0) + v;
                        subjCounts[s] = (subjCounts[s] || 0) + 1;
                      });
                    });
                    const subjAvgs = Object.keys(subjTotals)
                      .map(s => ({ subj: s, avg: Math.round(subjTotals[s] / subjCounts[s] * 10) / 10 }))
                      .sort((a, b) => b.avg - a.avg);
                    const strongest = subjAvgs[0];
                    const weakest   = subjAvgs[subjAvgs.length - 1];

                    return (
                      <div className="rh-two-col">
                        {/* ── Left column ── */}
                        <div>
                          {/* Exam History */}
                          <div className="rh-history-card">
                            <div className="rh-history-head">
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fa-solid fa-clock-rotate-left" style={{ color: '#1E40AF' }}></i> Exam History
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.results.length} record{st.results.length !== 1 ? 's' : ''}</span>
                            </div>
                            <div>
                              {st.results.map((r, idx) => {
                                const isCombined = r.type === 'combined';
                                const pctCol = r.pct >= 80 ? '#16A34A' : r.pct >= 60 ? '#1E40AF' : r.pct >= 50 ? '#D97706' : '#DC2626';
                                const grade = rcGetGrade(r.pct, 100);
                                const gradeCol = RS_GRADE_COLORS[grade ? grade.grade : 'F'] || '#475569';
                                const rankSfx = r.rank === 1 ? 'st' : r.rank === 2 ? 'nd' : r.rank === 3 ? 'rd' : 'th';
                                return (
                                  <div key={idx} className="rh-timeline-row">
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isCombined ? '#7C3AED' : '#1E40AF', flexShrink: 0, marginTop: 6 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                                        {r.exam}
                                        <span style={{
                                          fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999,
                                          background: isCombined ? 'rgba(124,58,237,.1)' : 'rgba(30,64,175,.1)',
                                          color: isCombined ? '#7C3AED' : '#1E40AF',
                                        }}>
                                          {isCombined ? 'Combined' : 'Single'}
                                        </span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 5, background: 'rgba(30,64,175,.07)', color: '#1E40AF' }}>
                                          <i className="fa-solid fa-users" style={{ fontSize: 8 }}></i>{st.cls}
                                        </span>
                                        <span style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600,
                                          padding: '1px 7px', borderRadius: 5,
                                          background: r.year === st.session ? 'rgba(22,163,74,.08)' : 'rgba(217,119,6,.08)',
                                          color: r.year === st.session ? '#16A34A' : '#D97706',
                                        }}>
                                          <i className="fa-regular fa-calendar" style={{ fontSize: 8 }}></i>
                                          {r.year === '2025-26' ? '2025–2026' : r.year === '2024-25' ? '2024–2025' : r.year}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                          <i className="fa-regular fa-calendar" style={{ marginRight: 3 }}></i>{r.date}
                                        </span>
                                      </div>
                                    </div>
                                    <div style={{ minWidth: 90, flex: 1, maxWidth: 160 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10, color: 'var(--text-muted)' }}>
                                        <span>Score</span>
                                        <span style={{ fontWeight: 700, color: pctCol }}>{r.pct}%</span>
                                      </div>
                                      <div style={{ height: 6, background: 'var(--border-light)', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${Math.min(100, r.pct)}%`, background: pctCol, borderRadius: 3 }} />
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'center', width: 38, flexShrink: 0 }}>
                                      <div style={{ fontSize: 16, fontWeight: 900, color: gradeCol }}>{grade ? grade.grade : '—'}</div>
                                    </div>
                                    <div style={{ textAlign: 'center', width: 40, flexShrink: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)' }}>{r.rank}{rankSfx}</div>
                                      <div style={{ fontSize: 8.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Pos.</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                                      <Tooltip text="View result card">
                                        <button
                                          className="res-action-btn view"
                                          onClick={() => setRhCardCtx({ student: st, result: r })}
                                          style={{ padding: '6px 11px', fontSize: 11 }}
                                        >
                                          <i className="fa-solid fa-eye"></i> View
                                        </button>
                                      </Tooltip>
                                      <Tooltip text="Download result card report">
                                        <button
                                          className="res-download-btn"
                                          onClick={() => setRhReportReq({ student: st, type: 'card', result: r })}
                                          style={{ width: 30, height: 30 }}
                                        >
                                          <i className="fa-solid fa-download"></i>
                                        </button>
                                      </Tooltip>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Performance Trend chart */}
                          <div className="rh-trend-card">
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <i className="fa-solid fa-chart-column" style={{ color: '#1E40AF' }}></i> Performance Trends
                            </div>
                            <div className="rh-trend-scroll">
                              <div className="rh-trend-bars">
                                {st.results.map((r, i) => {
                                  const col = r.pct >= 80 ? '#16A34A' : r.pct >= 60 ? '#1E40AF' : r.pct >= 50 ? '#D97706' : '#DC2626';
                                  const h = Math.max(8, Math.round(r.pct));
                                  return (
                                    <div key={i} className="rh-trend-item">
                                      <div className="rh-trend-pct" style={{ color: col }}>{r.pct}%</div>
                                      <div className="rh-trend-track">
                                        <div className="rh-trend-fill" style={{ height: `${h}%`, background: col }} />
                                      </div>
                                      <div className="rh-trend-lbl">{r.exam}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── Right column ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {/* Subject Performance */}
                          {subjAvgs.length > 0 && (
                            <div className="rh-side-card">
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fa-solid fa-book-open" style={{ color: '#1E40AF' }}></i> Subject Performance
                              </div>
                              {subjAvgs.slice(0, 6).map(s => {
                                const w = Math.min(100, Math.round((s.avg / 20) * 100));
                                const col = s.avg >= 18 ? '#16A34A' : s.avg >= 14 ? '#1E40AF' : s.avg >= 10 ? '#D97706' : '#DC2626';
                                return (
                                  <div key={s.subj} className="rh-subj-row">
                                    <div className="rh-subj-name">{s.subj}</div>
                                    <div className="rh-subj-bar">
                                      <div style={{ height: '100%', width: `${w}%`, background: col, borderRadius: 4 }} />
                                    </div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: col, width: 36, textAlign: 'right' }}>{s.avg}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Academic Insights */}
                          {strongest && (
                            <div className="rh-side-card">
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fa-solid fa-lightbulb" style={{ color: '#D97706' }}></i> Academic Insights
                              </div>
                              <div className="rh-insight rh-insight--good">
                                <i className="fa-solid fa-trophy"></i>
                                <div>
                                  <div className="rh-insight-title">Strongest Subject</div>
                                  <div className="rh-insight-sub">{strongest.subj} (avg: {strongest.avg})</div>
                                </div>
                              </div>
                              {weakest && weakest !== strongest && (
                                <div className="rh-insight rh-insight--warn">
                                  <i className="fa-solid fa-arrow-up-right-dots"></i>
                                  <div>
                                    <div className="rh-insight-title">Needs Attention</div>
                                    <div className="rh-insight-sub">{weakest.subj} (avg: {weakest.avg})</div>
                                  </div>
                                </div>
                              )}
                              {st.attendance < 80 && (
                                <div className="rh-insight rh-insight--bad">
                                  <i className="fa-solid fa-triangle-exclamation"></i>
                                  <div>
                                    <div className="rh-insight-title">Attendance Alert</div>
                                    <div className="rh-insight-sub">Attendance below 80% — {st.attendance}%</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Downloads & Reports */}
                          <div className="rh-side-card">
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <i className="fa-solid fa-download" style={{ color: '#1E40AF' }}></i> Downloads &amp; Reports
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {[
                                { key:'history',    label:'Full Academic History', icon:'fa-file-invoice',   desc:'All exam results across classes & sessions', col:'#1E40AF', bg:'rgba(30,64,175,.07)' },
                                { key:'progress',   label:'Progress Report',        icon:'fa-chart-line',     desc:'Performance trend & subject improvement',    col:'#7C3AED', bg:'rgba(124,58,237,.07)' },
                                { key:'comparison', label:'Comparison Report',      icon:'fa-code-compare',   desc:'Exam vs exam comparison & grade movement',   col:'#D97706', bg:'rgba(217,119,6,.07)' },
                                { key:'attendance', label:'Attendance Summary',     icon:'fa-calendar-check', desc:'Monthly attendance breakdown & status',      col:'#16A34A', bg:'rgba(22,163,74,.07)' },
                              ].map(item => (
                                <div key={item.key} className="rh-report-card">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                                    <div style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, color: item.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                                      <i className={`fa-solid ${item.icon}`}></i>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</div>
                                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{item.desc}</div>
                                    </div>
                                  </div>
                                  <Tooltip text={`Download ${item.label}`}>
                                    <button
                                      className="rh-report-btn"
                                      style={{ '--acc': item.col }}
                                      onClick={() => setRhReportReq({ student: st, type: item.key })}
                                    >
                                      <i className="fa-solid fa-download" style={{ fontSize: 10 }}></i> Download
                                    </button>
                                  </Tooltip>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            }

            return (
              <>
                {/* Universal search (with live dropdown) */}
                <div className="rh-search-shell">
                  <div className="rh-search-wrap">
                    <i className="fa-solid fa-magnifying-glass rh-search-icon"></i>
                    <input
                      type="text"
                      placeholder="Search by student name, roll number, father name, admission, class…"
                      value={rhSearchQ}
                      onChange={e => setRhSearchQ(e.target.value)}
                      onFocus={() => setRhSearchFocused(true)}
                      onBlur={() => setTimeout(() => setRhSearchFocused(false), 150)}
                      autoComplete="off"
                    />
                    {rhSearchQ && (
                      <button
                        className="rh-search-clear"
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => setRhSearchQ('')}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>

                  {q && rhSearchFocused && (
                    <div className="rh-search-drop">
                      {filtered.length === 0 ? (
                        <div className="rh-search-empty">
                          <i className="fa-solid fa-magnifying-glass" style={{ display: 'block', fontSize: 20, marginBottom: 8, opacity: .4 }}></i>
                          No students found
                        </div>
                      ) : filtered.map(st => {
                        const pcts = st.results.map(r => r.pct);
                        const avgPct = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0;
                        const initials = st.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
                        return (
                          <div
                            key={st.id}
                            className="rh-search-row"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setRhSearchFocused(false);
                              setRhActiveStudent(st);
                            }}
                          >
                            <div className="rh-search-avatar">{initials}</div>
                            <div className="rh-search-meta">
                              <div className="rh-search-name">{st.name}</div>
                              <div className="rh-search-sub">{st.father} · {st.cls} · {st.rollNo}</div>
                            </div>
                            <div className="rh-search-side">
                              <div className="rh-search-count">{st.results.length} Result{st.results.length !== 1 ? 's' : ''}</div>
                              <div className="rh-search-avg">Avg {avgPct}%</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18, alignItems: 'center' }}>
                  <select className="rh-filter" value={rhFilterSession} onChange={e => setRhFilterSession(e.target.value)}>
                    <option value="">All Sessions</option>
                    {RH_SESSIONS.map(s => <option key={s} value={s}>{s === '2025-26' ? '2025–2026' : s === '2024-25' ? '2024–2025' : s}</option>)}
                  </select>
                  <select className="rh-filter" value={rhFilterClass} onChange={e => setRhFilterClass(e.target.value)}>
                    <option value="">All Classes</option>
                    {CBR_CLASS_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="rh-filter" value={rhFilterSection} onChange={e => setRhFilterSection(e.target.value)}>
                    <option value="">All Sections</option>
                    {RH_SECTIONS.map(s => <option key={s} value={s}>Section {s}</option>)}
                  </select>
                  <select className="rh-filter" value={rhFilterExam} onChange={e => setRhFilterExam(e.target.value)}>
                    <option value="">All Exams</option>
                    {RH_EXAM_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                  <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    Showing <strong>{filtered.length}</strong> student{filtered.length !== 1 ? 's' : ''} across {distinctClasses} class{distinctClasses !== 1 ? 'es' : ''}
                  </div>
                </div>

                {/* Grid */}
                {!filtered.length ? (
                  <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-user-magnifying-glass" style={{ fontSize: 32, display: 'block', marginBottom: 12 }}></i>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>No students found</div>
                    Try adjusting your search or filters.
                  </div>
                ) : (
                  <div className="rh-grid">
                    {filtered.map(st => {
                      const { avgPct, best, trend, grade } = studentCardSummary(st);
                      const gradeCol = RS_GRADE_COLORS[grade] || '#1E40AF';
                      const barCol   = avgPct >= 80 ? '#16A34A' : avgPct >= 60 ? '#D97706' : '#DC2626';
                      const attCol   = st.attendance >= 90 ? '#16A34A' : st.attendance >= 75 ? '#D97706' : '#DC2626';
                      const attBg    = st.attendance >= 90 ? 'rgba(22,163,74,.07)' : st.attendance >= 75 ? 'rgba(217,119,6,.07)' : 'rgba(220,38,38,.07)';
                      const trendCol = trend === 'up' ? '#16A34A' : trend === 'down' ? '#DC2626' : '#64748B';
                      const trendLbl = trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable';
                      const initials = st.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

                      return (
                        <div
                          key={st.id}
                          className="rh-card"
                          onClick={() => setRhActiveStudent(st)}
                        >
                          <div className="rh-card-accent" style={{ background: `linear-gradient(90deg,#1E3A8A,${barCol})` }} />
                          <div className="rh-card-head">
                            <div className="rh-avatar">{initials}</div>
                            <div className="rh-id">
                              <div className="rh-name">{st.name}</div>
                              <div className="rh-father">{st.father}</div>
                              <div className="rh-cls">{st.cls} · {st.rollNo}</div>
                            </div>
                            <div className="rh-grade">
                              <div style={{ fontSize: 22, fontWeight: 900, color: gradeCol, lineHeight: 1 }}>{grade}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>Avg</div>
                            </div>
                          </div>
                          <div className="rh-kpis">
                            <div className="rh-kpi">
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#1E40AF' }}>{avgPct}%</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Avg</div>
                            </div>
                            <div className="rh-kpi" style={{ background: 'rgba(22,163,74,.07)' }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}>{best}%</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Best</div>
                            </div>
                            <div className="rh-kpi" style={{ background: attBg }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: attCol }}>{st.attendance}%</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Att.</div>
                            </div>
                          </div>
                          <div className="rh-bar">
                            <div style={{ width: `${Math.min(100, avgPct)}%`, background: barCol }} />
                          </div>
                          <div className="rh-foot">
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.results.length} Result{st.results.length !== 1 ? 's' : ''}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: trendCol, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <i className={`fa-solid ${trend === 'up' ? 'fa-arrow-trend-up' : trend === 'down' ? 'fa-arrow-trend-down' : 'fa-minus'}`}></i>
                              {trendLbl}
                            </span>
                            <span style={{ fontSize: 11, color: '#1E40AF', fontWeight: 700 }}>View →</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </>
      )}

      {/* ── Add / Edit modal ── */}
      <ExamModal
        data={editing}
        onClose={() => setEditing(null)}
  onSave={handleSaveExam}
        toast={toast}
          selectedTermId={selectedTermId}  // Add this line

      />

      {/* ── Delete confirm (Academics-style) ── */}
{confirmDel && (
  <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setConfirmDel(null); }}>
    <div className="confirm-dialog">
      <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }} />
      <div className="confirm-hero">
        <div className="confirm-ring">
          <div className="confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
            <i className="fa-solid fa-trash"></i>
          </div>
        </div>
      </div>
      <div className="confirm-body">
        <div className="confirm-title">Delete Exam?</div>
        <div
          className="confirm-msg"
          dangerouslySetInnerHTML={{
            __html: `You are about to delete <strong>${confirmDel.name}</strong> and its associated data for <strong>${confirmDel.classes.length}</strong> class${confirmDel.classes.length !== 1 ? 'es' : ''}.`,
          }}
        />
        <div className="confirm-hint">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>This action cannot be undone.</span>
        </div>
      </div>
      <div className="confirm-footer">
        <Tooltip text="Cancel and close">
          <button className="confirm-btn confirm-btn--cancel" onClick={() => setConfirmDel(null)}>Cancel</button>
        </Tooltip>
        <Tooltip text="Yes, Delete (confirm)">
          <button 
            className="confirm-btn confirm-btn--confirm" 
            onClick={() => handleDeleteExam(confirmDel)}
          >
            Yes, Delete
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
)}
      {/* ── Report style picker (Academics-style) ── */}
      {reportReq && (
        <ExamReportPicker
          req={reportReq}
          exams={exams}
          term={term}
          onClose={() => setReportReq(null)}
          toast={toast}
        />
      )}

      {/* ── Date Sheet — edit modal ── */}
      {dsEditing && (
        <DsEditModal
          ctx={dsEditing}
          onClose={() => setDsEditing(null)}
          onSave={dsSaveEdit}
          toast={toast}
        />
      )}

      {/* ── Date Sheet — delete confirm (Academics-style) ── */}
    {dsConfirmDel && (
  <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setDsConfirmDel(null); }}>
    <div className="confirm-dialog">
      <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }} />
      <div className="confirm-hero">
        <div className="confirm-ring">
          <div className="confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
            <i className="fa-solid fa-trash"></i>
          </div>
        </div>
      </div>
      <div className="confirm-body">
        <div className="confirm-title">Delete Date Sheet</div>
        <div
          className="confirm-msg"
          dangerouslySetInnerHTML={{
            __html: `Are you sure you want to delete the date sheet for <strong>${dsConfirmDel.className}</strong>?`,
          }}
        />
        <div className="confirm-hint">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <span>This action cannot be undone. All subject schedule data will be lost.</span>
        </div>
      </div>
      <div className="confirm-footer">
        <Tooltip text="Cancel and close">
          <button className="confirm-btn confirm-btn--cancel" onClick={() => setDsConfirmDel(null)}>Cancel</button>
        </Tooltip>
        <Tooltip text="Yes, Delete (confirm)">
          <button 
            className="confirm-btn confirm-btn--confirm" 
            onClick={() => dsRunDelete(dsConfirmDel)}
          >
            Yes, Delete
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
)}

      {/* ── Date Sheet — copy confirm (primary blue) ── */}
{dsConfirmCopy && (
  <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setDsConfirmCopy(null); }}>
    <div className="confirm-dialog">
      <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#1E3A8A,#1E40AF,#1E3A8A)' }} />
      <div className="confirm-hero" style={{ background: 'linear-gradient(180deg,rgba(30,58,138,.04),transparent)' }}>
        <div className="confirm-ring">
          <div className="confirm-icon-wrap" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF', boxShadow: '0 8px 24px rgba(30,58,138,.2)' }}>
            <i className="fa-regular fa-copy"></i>
          </div>
        </div>
      </div>
      <div className="confirm-body">
        <div className="confirm-title">Copy to All Classes</div>
        <div
          className="confirm-msg"
          dangerouslySetInnerHTML={{
            __html: `Copy date sheet subjects from <strong>${dsConfirmCopy.sourceClassName}</strong> to all <strong>${dsConfirmCopy.count} other class${dsConfirmCopy.count !== 1 ? 'es' : ''}</strong> in <strong>${dsConfirmCopy.examName}</strong>?<br/><br/>
            <span style="font-size: 11px; color: var(--text-muted);">⚠️ Only subjects that don't already exist in each class will be copied. Existing subjects will be preserved.</span>`,
          }}
        />
        <div className="confirm-hint" style={{ background: 'rgba(30,58,138,.06)', borderColor: 'rgba(30,58,138,.18)', color: '#1E3A8A' }}>
          <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF' }}></i>
          <span>This will add missing subjects without overwriting existing ones.</span>
        </div>
      </div>
      <div className="confirm-footer">
        <Tooltip text="Cancel and close">
          <button className="confirm-btn confirm-btn--cancel" onClick={() => setDsConfirmCopy(null)}>Cancel</button>
        </Tooltip>
        <Tooltip text="Confirm copy (add missing subjects only)">
          <button className="confirm-btn confirm-btn--confirm primary-style" onClick={dsRunCopy}>Yes, Copy Missing</button>
        </Tooltip>
      </div>
    </div>
  </div>
)}

      {/* ── Date Sheet — report picker (Academics-style) ── */}
      {dsReportReq && (
        <DsReportPicker
          req={dsReportReq}
          ex={dsCurrentExam}
          dateSheets={dateSheets}
          term={dsTerm}
          onClose={() => setDsReportReq(null)}
          toast={toast}
        />
      )}

      {/* ── Syllabus — edit modal ── */}
     {sylEditing && (
  <SylEditModal
  ctx={sylEditing}
  onClose={() => setSylEditing(null)}
  onSave={sylSaveEdit}
  toast={toast}
  subjects={subjects}
    examId={sylCurrentExam?.selectExam} 
  term={selectedTermId}
  fetchSubjectSyllabus={getExamSyllabusBySubject}
/>
)}
      {/* ── Syllabus — delete confirm ── */}
      {sylConfirmDel && (
        <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setSylConfirmDel(null); }}>
          <div className="confirm-dialog">
            <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }} />
            <div className="confirm-hero">
              <div className="confirm-ring">
                <div className="confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
                  <i className="fa-solid fa-trash"></i>
                </div>
              </div>
            </div>
            <div className="confirm-body">
              <div className="confirm-title">Delete Syllabus</div>
              <div
                className="confirm-msg"
                dangerouslySetInnerHTML={{
                  __html: `Are you sure you want to delete the syllabus for <strong>${sylConfirmDel.className}</strong>?`,
                }}
              />
              <div className="confirm-hint">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>This action cannot be undone. All syllabus data will be lost.</span>
              </div>
            </div>
            <div className="confirm-footer">
              <Tooltip text="Cancel and close"><button className="confirm-btn confirm-btn--cancel" onClick={() => setSylConfirmDel(null)}>Cancel</button></Tooltip>
              <Tooltip text="Yes, Delete (confirm)"><button className="confirm-btn confirm-btn--confirm" onClick={() => sylRunDelete(sylConfirmDel)}>Yes, Delete</button></Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* ── Syllabus — report picker ── */}
      {sylReportReq && (
        <SylReportPicker
          req={sylReportReq}
          ex={sylCurrentExam}
          syllabusData={syllabusData}
          term={sylTerm}
          onClose={() => setSylReportReq(null)}
          toast={toast}
        />
      )}

      {/* ── Result Setup — edit modal ── */}
      {rsModalOpen && (
        <ResultSetupModal
          grades={rsGrades}
          sigs={rsSigs}
          remarks={rsRemarks}
          absentMode={rsAbsentMode}
          onSave={({ grades, sigs, remarks, absentMode }) => {
            setRsGrades(grades);
            setRsSigs(sigs);
            setRsRemarks(remarks);
            setRsAbsentMode(absentMode);
            setRsModalOpen(false);
            toast('Result setup saved successfully', 'success');
          }}
          onClose={() => setRsModalOpen(false)}
          toast={toast}
        />
      )}

      {/* ── Template preview popup ── */}
      {rcPreviewId && (
        <TemplatePreviewModal
          templateId={rcPreviewId}
          rcoGeneral={rcoGeneral}
          rcoSig={rcoSig}
          rsSigs={rsSigs}
          rsAbsentMode={rsAbsentMode}
          onClose={() => setRcPreviewId(null)}
          onSelect={id => {
            setRcTemplate(id);
            setRcPreviewId(null);
            const names = { classic: 'Classic', insight: 'Insight', portfolio: 'Portfolio' };
            toast(`${names[id] || id} Result Card selected.`, 'success');
          }}
        />
      )}

      {/* ── Result Setup — report picker ── */}
      {rsReportReq && (
        <ResultSetupReportPicker
          grades={rsGrades}
          sigs={rsSigs}
          remarks={rsRemarks}
          absentMode={rsAbsentMode}
          onClose={() => setRsReportReq(null)}
          toast={toast}
        />
      )}

      {/* ── Single Assessment — Update Marks modal ── */}
   {resUpdateCtx && (() => {
  // API students se dhundo
  const apiStudents = resStudentData[resUpdateCtx.key]?.students || [];
  const apiSubjects = resStudentData[resUpdateCtx.key]?.subjects || [];
  const apiMarks    = resStudentData[resUpdateCtx.key]?.marks    || [];
  
  const st = apiStudents.find(s => s.id === resUpdateCtx.studentId);
  if (!st) return null;

  // Modal ke liye compatible student object banao
  const marksEntry = apiMarks.find(m => m.studentID === st.id);
  const modalStudent = {
    id: st.id,
    name: st.studentName,
    father: st.fatherName,
    rollNo: st.registrationNumber || '—',
    obtained: {},
    absentSubjects: [],
    absent: false,
    manualRemarks: {},
    finalRemarks: '',
  };

  // cd object banao subjects se
  const totalMarksObj = {};
  apiSubjects.forEach(s => {
    if (s.subjectName) totalMarksObj[s.subjectName] = Number(s.totalMarks || 0);
  });
  const modalCd = {
    released: false,
    totalMarks: Object.keys(totalMarksObj).length ? totalMarksObj : { ...RES_DEFAULT_TOTALS },
    students: [modalStudent],
  };

  return (
    <ResultUpdateMarksModal
      cd={modalCd}
      student={modalStudent}
      subjects={subjects}
      onClose={() => setResUpdateCtx(null)}
      onSave={payload => {
        toast('Marks saved!', 'success');
        setResUpdateCtx(null);
      }}
      absentMode={rsAbsentMode}
      toast={toast}
    />
  );
})()}
      {/* ── Result History — report picker (Colorful / Colorless) ── */}
      {rhReportReq && (
        <RhReportPicker
          req={rhReportReq}
          onClose={() => setRhReportReq(null)}
          toast={toast}
        />
      )}

      {/* ── Result History — per-exam Card viewer ── */}
      {rhCardCtx && (() => {
        const { student, result } = rhCardCtx;
        const mainObt = Math.round((result.pct / 100) * 200);
        const cardStudent = {
          id: student.id,
          rollNo: student.rollNo,
          name: student.name,
          father: student.father,
          obtained: cbrDeriveSubjectMarks(mainObt),
          absentSubjects: [],
          attendance: `${student.attendance}%`,
        };
        if (result.type === 'combined') {
          // Stub a minimal combined breakdown so the Combined view renders meaningfully
          const mainTotal = 200;
          const subBreakdown = [{ name: 'Sub Exam', origT: 100, subObt: Math.round(result.pct), weight: 20, conv: Math.round(((result.pct) / 100) * 20 * 100) / 100 }];
          const grandTotal = mainTotal + 20;
          const grandObt   = Math.round((mainObt + subBreakdown[0].conv) * 100) / 100;
          cardStudent._combined = {
            grandTotal, grandObt,
            ovPct: result.pct,
            mainExName: result.exam,
            mainTotal, mainObt,
            subBreakdown,
            rank: 1, rankSfx: 'st',
          };
        }
        const cardRd = { totalMarks: { ...RES_DEFAULT_TOTALS } };
        const cardEx = { name: result.exam, classes: [student.cls] };
        return (
          <ResultCardViewer
            student={cardStudent}
            rd={cardRd}
            ex={cardEx}
            template={rcTemplate}
            rcoGeneral={rcoGeneral}
            rcoSig={rcoSig}
            rsSigs={rsSigs}
            rsAbsentMode={rsAbsentMode}
            onClose={() => setRhCardCtx(null)}
            toast={toast}
            initialMode={result.type === 'combined' ? 'combined' : 'single'}
          />
        );
      })()}

      {/* ── Combined Assessment — Class report picker ── */}
      {cbrReportReq && (() => {
        const cr = cbrResults.find(g => g.id === cbrReportReq.classId);
        if (!cr) return null;
        return (
          <CbrClassReportPicker
            cr={cr}
            onClose={() => setCbrReportReq(null)}
            toast={toast}
          />
        );
      })()}

      {/* ── Combined Assessment — Create New modal ── */}
      {cbrCreateOpen && (
        <CbrCreateModal
          exams={exams}
          onClose={() => setCbrCreateOpen(false)}
          onCreate={results => {
            setCbrResults(prev => [...results, ...prev]);
            toast(`Created ${results.length} combined result${results.length !== 1 ? 's' : ''}`, 'success');
            setCbrCreateOpen(false);
          }}
          toast={toast}
        />
      )}

      {/* ── Combined Assessment — Card viewer ── */}
      {cbrCardCtx && (() => {
        const grp = cbrResults.find(g => g.id === cbrCardCtx.classId);
        if (!grp) return null;
        const st = grp.students.find(s => s.rollNo === cbrCardCtx.studentRollNo);
        if (!st) return null;
        const rankNum = parseInt(st.rank, 10) || 1;
        const rankSfx = (st.rank.match(/[a-z]+$/i) || ['th'])[0];
        const cardStudent = {
          id: st.rollNo,
          rollNo: st.rollNo,
          name: st.name,
          father: st.father,
          obtained: cbrDeriveSubjectMarks(st.mainObt),
          absentSubjects: [],
          attendance: '—',
          _combined: {
            grandTotal:   st.grandTotal,
            grandObt:     st.grandObt,
            ovPct:        st.pct,
            mainExName:   grp.mainExam,
            mainTotal:    st.mainTotal,
            mainObt:      st.mainObt,
            subBreakdown: st.subs,
            rank:         rankNum,
            rankSfx:      rankSfx,
          },
        };
        const cardRd = { totalMarks: { ...RES_DEFAULT_TOTALS } };
        const cardEx = { name: grp.mainExam, classes: [grp.cls] };
        return (
          <ResultCardViewer
            student={cardStudent}
            rd={cardRd}
            ex={cardEx}
            template={rcTemplate}
            rcoGeneral={rcoGeneral}
            rcoSig={rcoSig}
            rsSigs={rsSigs}
            rsAbsentMode={rsAbsentMode}
            onClose={() => setCbrCardCtx(null)}
            toast={toast}
            initialMode="combined"
          />
        );
      })()}

      {/* ── Combined Assessment — Publish confirm ── */}
      {cbrConfirmPublish && (
        <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setCbrConfirmPublish(null); }}>
          <div className="confirm-dialog">
            <div className="confirm-glow" style={{ background: cbrConfirmPublish.published
              ? 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)'
              : 'linear-gradient(90deg,#1E3A8A,#1E40AF,#1E3A8A)' }} />
            <div className="confirm-hero">
              <div className="confirm-ring">
                <div className="confirm-icon-wrap" style={{
                  background: cbrConfirmPublish.published ? 'rgba(220,38,38,.1)' : 'rgba(30,58,138,.1)',
                  color: cbrConfirmPublish.published ? '#DC2626' : '#1E40AF',
                }}>
                  <i className={`fa-solid ${cbrConfirmPublish.published ? 'fa-eye-slash' : 'fa-paper-plane'}`}></i>
                </div>
              </div>
            </div>
            <div className="confirm-body">
              <div className="confirm-title">{cbrConfirmPublish.published ? 'Unpublish Combined Result?' : 'Publish Combined Result?'}</div>
              <div className="confirm-msg" dangerouslySetInnerHTML={{
                __html: cbrConfirmPublish.published
                  ? `Hide the combined result for <strong>${cbrConfirmPublish.className}</strong> from students and parents?`
                  : `Release the combined result for <strong>${cbrConfirmPublish.className}</strong> to students and parents?`,
              }} />
              <div className="confirm-hint">
                <i className="fa-solid fa-circle-info"></i>
                <span>{cbrConfirmPublish.published
                  ? 'Students and parents will lose access to this combined result card.'
                  : 'Once published, this combined result will be visible on the student portal.'}
                </span>
              </div>
            </div>
            <div className="confirm-footer">
              <Tooltip text="Cancel and close"><button className="confirm-btn confirm-btn--cancel" onClick={() => setCbrConfirmPublish(null)}>Cancel</button></Tooltip>
              <Tooltip text={cbrConfirmPublish.published ? 'Confirm unpublish' : 'Confirm publish'}>
                <button
                  className={`confirm-btn confirm-btn--confirm${cbrConfirmPublish.published ? '' : ' primary-style'}`}
                  onClick={() => {
                    const { classId, published } = cbrConfirmPublish;
                    setCbrResults(prev => prev.map(g => g.id === classId ? { ...g, published: !g.published } : g));
                    toast(published ? 'Combined result unpublished' : 'Combined result published!', 'success');
                    setCbrConfirmPublish(null);
                  }}
                >
                  {cbrConfirmPublish.published ? 'Yes, Unpublish' : 'Yes, Publish'}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* ── Combined Assessment — Delete confirm ── */}
      {cbrConfirmDelete && (
        <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setCbrConfirmDelete(null); }}>
          <div className="confirm-dialog">
            <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }} />
            <div className="confirm-hero">
              <div className="confirm-ring">
                <div className="confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
                  <i className="fa-solid fa-trash"></i>
                </div>
              </div>
            </div>
            <div className="confirm-body">
              <div className="confirm-title">Delete Combined Result</div>
              <div className="confirm-msg" dangerouslySetInnerHTML={{
                __html: `Delete the combined result for <strong>${cbrConfirmDelete.className}</strong>?`,
              }} />
              <div className="confirm-hint">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>This removes the combined result and its weights. This cannot be undone.</span>
              </div>
            </div>
            <div className="confirm-footer">
              <Tooltip text="Cancel and close"><button className="confirm-btn confirm-btn--cancel" onClick={() => setCbrConfirmDelete(null)}>Cancel</button></Tooltip>
              <Tooltip text="Confirm delete">
                <button
                  className="confirm-btn confirm-btn--confirm"
                  onClick={() => {
                    setCbrResults(prev => prev.filter(g => g.id !== cbrConfirmDelete.classId));
                    toast('Combined result deleted', 'info');
                    setCbrConfirmDelete(null);
                  }}
                >
                  Yes, Delete
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Assessment — Class report picker ── */}
      {resClassReportReq && (() => {
        const cd = resultData[resClassReportReq.examId]?.[resClassReportReq.key];
        const ex = exams.find(e => e.id === resClassReportReq.examId);
        if (!cd || !ex) return null;
        return (
          <ClassReportPicker
            cd={cd}
            ex={ex}
            className={resClassReportReq.className}
            term={resTerm}
            absentMode={rsAbsentMode}
            onClose={() => setResClassReportReq(null)}
            toast={toast}
          />
        );
      })()}

      {/* ── Single Assessment — Final Remarks modal ── */}
   {resRemarksCtx && (() => {
  const apiStudents = resStudentData[resRemarksCtx.key]?.students || [];
  const st = apiStudents.find(s => s.id === resRemarksCtx.studentId);
  if (!st) return null;

  const modalStudent = {
    id: st.id,
    name: st.studentName,
    father: st.fatherName,
    rollNo: st.registrationNumber || '—',
    obtained: {},
    absentSubjects: [],
    absent: false,
    finalRemarks: '',
  };
  const modalCd = {
    released: false,
    totalMarks: { ...RES_DEFAULT_TOTALS },
    students: [modalStudent],
  };

  return (
    <ResultRemarksModal
      cd={modalCd}
      student={modalStudent}
      absentMode={rsAbsentMode}
      onClose={() => setResRemarksCtx(null)}
      onSave={text => {
        toast('Final remarks saved!', 'success');
        setResRemarksCtx(null);
      }}
    />
  );
})()}

      {/* ── Single Assessment — Card viewer ── */}
{/* ── Single Assessment — Card viewer ── */}
{resCardCtx && (() => {
  const cd = resultData[resCardCtx.examId]?.[resCardCtx.key]
    || { released: false, totalMarks: { ...RES_DEFAULT_TOTALS }, students: freshStudents() };
  const st = cd.students.find(s => s.id === resCardCtx.studentId);
  const ex = filtered.find(e => e.id === resCardCtx.examId);
  if (!st || !ex) return null;
  // classes ko string banao, object nahi
  const cardEx = { name: ex.name, classes: [resCardCtx.className || ''] };
  return (
    <ResultCardViewer
      student={st}
      rd={cd}
      ex={cardEx}
      template={rcTemplate}
      rcoGeneral={rcoGeneral}
      rcoSig={rcoSig}
      rsSigs={rsSigs}
      rsAbsentMode={rsAbsentMode}
      onClose={() => setResCardCtx(null)}
      toast={toast}
    />
  );
})()}

      {/* ── Single Assessment — Total Marks edit modal ── */}
     {/* ── Single Assessment — Total Marks edit modal ── */}
{resTotalMarksCtx && (() => {
  const cd = resultData[resTotalMarksCtx.examId]?.[resTotalMarksCtx.key]
    || { released: false, totalMarks: { ...RES_DEFAULT_TOTALS }, students: freshStudents() };
  return (
    <ResultTotalMarksModal
      cd={cd}
subjects={resTotalMarksCtx.subjects}
      className={resTotalMarksCtx.className}
      resTotalMarksCtx={resTotalMarksCtx}
      selectedTermId={selectedTermId}
      onClose={() => setResTotalMarksCtx(null)}
      onSave={newTotals => {
        setResultData(prev => {
          const next = { ...prev };
          const examMap = { ...(next[resTotalMarksCtx.examId] || {}) };
          const oldCd = examMap[resTotalMarksCtx.key] || cd;
          examMap[resTotalMarksCtx.key] = { ...oldCd, totalMarks: { ...newTotals } };
          next[resTotalMarksCtx.examId] = examMap;
          return next;
        });
        toast('Total marks saved!', 'success');
        setResTotalMarksCtx(null);
      }}
    />
  );
})()}

      {/* ── Single Assessment — Delete class confirm ── */}
{resConfirmDelete && (() => {
  // Find the selected exam to get the termID
  const selectedExam = filtered.find(e => e.id === resConfirmDelete.examId);
  const termId = selectedExam?.termID || selectedTermId;
  
  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setResConfirmDelete(null); }}>
      <div className="confirm-dialog">
        <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }} />
        <div className="confirm-hero">
          <div className="confirm-ring">
            <div className="confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
              <i className="fa-solid fa-trash"></i>
            </div>
          </div>
        </div>
        <div className="confirm-body">
          <div className="confirm-title">Delete Class Result</div>
          <div className="confirm-msg" dangerouslySetInnerHTML={{
            __html: `Delete all result data for <strong>${resConfirmDelete.className}</strong>?`,
          }} />
          <div className="confirm-hint">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>This will clear total marks, student marks and the release flag. This cannot be undone.</span>
          </div>
        </div>
        <div className="confirm-footer">
          <Tooltip text="Cancel and close">
            <button className="confirm-btn confirm-btn--cancel" onClick={() => setResConfirmDelete(null)}>Cancel</button>
          </Tooltip>
          <Tooltip text="Confirm delete">
            <button
              className="confirm-btn confirm-btn--confirm"
              onClick={async () => {
                try {
                  // Find the class data from examClasses
                  const classData = examClasses.find(c => 
                    `${c.gradeName} - ${c.sectionName}` === resConfirmDelete.className
                  );
                  
                  if (classData) {
                    // Call the delete API
                    const result = await deleteSingleAssessment(
                      resConfirmDelete.examId,
                      classData.classID,
                      classData.sectionID,
                      termId
                    );
                    
                    if (result.success) {
                      // Remove from local state
                      setResultData(prev => {
                        const next = { ...prev };
                        if (next[resConfirmDelete.examId]) {
                          const examMap = { ...next[resConfirmDelete.examId] };
                          delete examMap[resConfirmDelete.key];
                          next[resConfirmDelete.examId] = examMap;
                        }
                        return next;
                      });
                      
                      toast('Class result deleted successfully!', 'success');
                    } else {
                      toast('Failed to delete class result. Please try again.', 'error');
                    }
                  }
                } catch (error) {
                  console.error('Delete error:', error);
                  toast('Error deleting class result', 'error');
                }
                setResConfirmDelete(null);
              }}
            >
              Yes, Delete
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
})()}
{resConfirmPublish && (() => {
  const { key, className, released, cls } = resConfirmPublish;
  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setResConfirmPublish(null); }}>
      <div className="confirm-dialog">
        <div className="confirm-glow" style={{ background: released
          ? 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)'
          : 'linear-gradient(90deg,#1E3A8A,#1E40AF,#1E3A8A)' }} />
        <div className="confirm-hero" style={{ background: released
          ? 'linear-gradient(180deg,rgba(220,38,38,.04),transparent)'
          : 'linear-gradient(180deg,rgba(30,58,138,.04),transparent)' }}>
          <div className="confirm-ring">
            <div className="confirm-icon-wrap" style={{
              background: released ? 'rgba(220,38,38,.1)' : 'rgba(30,58,138,.1)',
              color: released ? '#DC2626' : '#1E40AF',
            }}>
              <i className={`fa-solid ${released ? 'fa-eye-slash' : 'fa-paper-plane'}`}></i>
            </div>
          </div>
        </div>
        <div className="confirm-body">
          <div className="confirm-title">{released ? 'Unpublish Result?' : 'Publish Result?'}</div>
          <div className="confirm-msg" dangerouslySetInnerHTML={{
            __html: released
              ? `Hide the result for <strong>${className}</strong> from students and parents?`
              : `Release the result for <strong>${className}</strong> to students and parents?`,
          }} />
          <div className="confirm-hint" style={released ? undefined : {
            background: 'rgba(30,58,138,.06)', borderColor: 'rgba(30,58,138,.18)', color: '#1E3A8A',
          }}>
            <i className={`fa-solid ${released ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} style={released ? undefined : { color: '#1E40AF' }}></i>
            <span>{released
              ? 'Students and parents will lose access to this result card.'
              : 'Once published, this result will be visible on the student portal.'}
            </span>
          </div>
        </div>
        <div className="confirm-footer">
          <Tooltip text="Cancel and close">
            <button className="confirm-btn confirm-btn--cancel" onClick={() => setResConfirmPublish(null)}>Cancel</button>
          </Tooltip>
          <Tooltip text={released ? 'Confirm unpublish' : 'Confirm publish'}>
            <button
              className={`confirm-btn confirm-btn--confirm${released ? '' : ' primary-style'}`}
              onClick={handleConfirmPublish}
            >
              {released ? 'Yes, Unpublish' : 'Yes, Publish'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
})()}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="examination"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADD / EDIT EXAM MODAL — verbatim from HTML #examModalOverlay
   ═══════════════════════════════════════════════════════════════════ */
function ExamModal({ data, onClose, onSave, toast, selectedTermId }) {
  const isEdit = !!data?.id || !!(data?.classes && data.classes.some(c => c.id));
  
  const [name, setName] = useState('');
  const [allClasses, setAllClasses] = useState([]);
  const [classes, setCls] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [dropOpen, setDropOpen] = useState(false);
  const [originalClassIds, setOriginalClassIds] = useState(new Set());
  
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  
  // Track original classes for deletion detection
  useEffect(() => {
    if (data && data.classes && data.classes.length) {
      const originalIds = new Set(data.classes.map(c => String(c.sectionID)));
      setOriginalClassIds(originalIds);
    } else if (data && data.id && !data.classes?.length) {
      // If editing but no classes in data, fetch from API or use empty
      setOriginalClassIds(new Set());
    } else {
      setOriginalClassIds(new Set());
    }
  }, [data]);
  
  useEffect(() => {
    if (data) {
      setName(data.name || '');
      setFrom(data.from ? data.from.split('T')[0] : '');
      setTo(data.to ? data.to.split('T')[0] : '');
      
      if (data.classes && data.classes.length) {
        setCls(data.classes);
        const originalIds = new Set(data.classes.map(c => String(c.sectionID)));
        setOriginalClassIds(originalIds);
      } else {
        setCls([]);
        setOriginalClassIds(new Set());
      }
      
      setSearch('');
      setDropOpen(false);
      
      getClasses(data.classes || []);
    }
  }, [data]);
  
  useEffect(() => {
    if (!dropOpen) return;
    
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    };
    
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [dropOpen]);
  
  async function getClasses(preselected) {
    try {
      const branchID = sessionStorage.getItem('branchID');
      const empID = sessionStorage.getItem('employee_ID');
      const token = sessionStorage.getItem('token');
      
      const response = await fetch(
        buildUrl(`/api/getclassesbybranchinexamination?branchID=${branchID}&empID=${empID}`),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          }
        }
      );
      
      const json = await response.json();
      
      const mapped = (json.data || json || []).map(item => ({
        classID: item.gradeID,
        sectionID: item.sectionID,
        sectionName: item.sectionName || '',
        gradeName: item.name || item.gradeName || '',
        className: `${item.name} - ${item.sectionName}`
      }));
      
      setAllClasses(mapped);
      
      if (preselected && preselected.length) {
        const normalized = preselected
          .map(pc => {
            const sid = pc?.sectionID ?? pc?.classID ?? pc;
            const match = mapped.find(m => String(m.sectionID) === String(sid));
            if (match) {
              return {
                ...match,
                id: pc?.id ?? 0,
                selectExam: pc?.selectExam
              };
            }
            return {
              classID: pc?.gradeID,
              sectionID: sid,
              sectionName: pc?.sectionName || '',
              gradeName: pc?.gradeName || '',
              className: pc?.className || `${pc?.gradeName || ''} - ${pc?.sectionName || ''}`,
              id: pc?.id ?? 0,
              selectExam: pc?.selectExam
            };
          })
          .filter(Boolean);
        
        setCls(normalized);
      } else {
        setCls([]);
      }
    } catch (error) {
      console.log("Could not load classes", error);
    }
  }
  
  const removeCls = (c) =>
    setCls(arr => arr.filter(x => String(x.sectionID) !== String(c.sectionID)));
  
  const toggleCls = (c) =>
    setCls(arr =>
      arr.some(x => String(x.sectionID) === String(c.sectionID))
        ? arr.filter(x => String(x.sectionID) !== String(c.sectionID))
        : [...arr, c]
    );
  
  const submit = async () => {
    if (!name.trim()) {
      toast('Enter exam name', 'warning');
      return;
    }
    if (!classes.length) {
      toast('Select classes', 'warning');
      return;
    }
    
    const branchID = sessionStorage.getItem('branchID');
    const token = sessionStorage.getItem('token');
    const currentClassIds = new Set(classes.map(c => String(c.sectionID)));
    
    // Determine which classes were removed
    const removedClassIds = [];
    if (isEdit && originalClassIds.size > 0) {
      for (const oldId of originalClassIds) {
        if (!currentClassIds.has(oldId)) {
          removedClassIds.push(oldId);
        }
      }
    }
    
    // Delete removed classes
    if (removedClassIds.length > 0) {
      try {
        const deletePromises = removedClassIds.map(async (sectionId) => {
          // Find the original class object to get its ID
          const removedClass = data.classes?.find(c => String(c.sectionID) === sectionId);
          if (removedClass && removedClass.id) {
            const deleteUrl = buildUrl(`/api/deletesingleaddexam?id=${removedClass.id}`);
            const response = await fetch(deleteUrl, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "*/*"
              }
            });
            return response.json();
          }
          return null;
        });
        
        await Promise.all(deletePromises);
        console.log(`Deleted ${removedClassIds.length} class(es)`);
      } catch (error) {
        console.log("Error deleting classes:", error);
      }
    }
    
    // Prepare payloads for insert and update
    const insertPayloads = [];
    const updatePayloads = [];
    
    for (const c of classes) {
      const existingClass = data?.classes?.find(
        existing => String(existing.sectionID) === String(c.sectionID)
      );
      
      const payload = {
        action: existingClass && existingClass.id ? "update" : "insert",
        id: existingClass?.id || 0,
        branchID: Number(branchID),
        classID: String(c.classID),
        sectionID: String(c.sectionID),
        sectionName: '',
        gradeName: '',
        examName: name.trim(),
        selectExam: String(data?.selectExam || c.selectExam || '0'),
        termID: String(selectedTermId),
        termName: '',
        dateFrom: from ? new Date(from).toISOString() : '',
        dateTo: to ? new Date(to).toISOString() : '',
        createdOn: new Date().toISOString()
      };
      
      if (existingClass && existingClass.id) {
        updatePayloads.push(payload);
      } else {
        insertPayloads.push(payload);
      }
    }
    
    // Combine all payloads
    const allPayloads = [...insertPayloads, ...updatePayloads];
    
    if (allPayloads.length === 0) {
      toast('No changes to save', 'info');
      onClose();
      return;
    }
    
    // Call onSave with all payloads
    onSave({ 
      payloads: allPayloads, 
      name: name.trim(), 
      from, 
      to, 
      classes: [...classes],
      deletedCount: removedClassIds.length
    });
  };
  
  if (!data) return null;
  
  const dropOptions = allClasses.filter(c =>
    !search ||
    c.className.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="exam-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="exam-modal">
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className={`fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-plus'}`}></i></div>
            <div>
              <div className="exam-modal-title">{isEdit ? 'Edit Exam' : 'Add Exam'}</div>
              <div className="exam-modal-sub">
                {isEdit ? 'Update exam details' : 'Create a new examination for selected classes'}
              </div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        
        <div className="exam-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
              <label className="form-label">Select Classes <span className="req-star">*</span></label>
              <div className="exam-class-select-wrap" ref={wrapRef} onClick={() => { setDropOpen(true); inputRef.current?.focus(); }}>
                {classes.map(c => (
                  <span key={c.sectionID} className="exam-class-tag">
                    {c.className}
                    <button
                      className="exam-class-tag-x"
                      onClick={e => {
                        e.stopPropagation();
                        removeCls(c);
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  className="exam-class-input"
                  type="text"
                  placeholder="Search classes..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setDropOpen(true); }}
                  autoComplete="off"
                />
              </div>
              <div className={`exam-class-dropdown${dropOpen ? ' open' : ''}`}>
                {dropOptions.length === 0 ? (
                  <div className="exam-class-option" style={{ color: 'var(--text-muted)', cursor: 'default' }}>No matches</div>
                ) : (
                  dropOptions.map(c => (
                    <div
                      key={c.sectionID}
                      className={`exam-class-option${
                        classes.some(x => String(x.sectionID) === String(c.sectionID)) ? ' selected' : ''
                      }`}
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleCls(c);
                      }}
                    >
                      {c.className}
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Exam Name <span className="req-star">*</span></label>
              <div className="exam-name-field">
                <i className="fa-solid fa-file-signature exam-field-icon"></i>
                <input className="form-input" type="text" placeholder="e.g. 1st Term Exam" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Start Date</label>
              <div className="exam-date-field">
                <i className="fa-regular fa-calendar exam-field-icon"></i>
                <input className="form-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">End Date</label>
              <div className="exam-date-field">
                <i className="fa-regular fa-calendar-check exam-field-icon"></i>
                <input className="form-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="exam-modal-footer">
          <Tooltip text="Cancel and close">
            <button className="exam-cancel-btn" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          </Tooltip>
          <Tooltip text={isEdit ? 'Save exam' : 'Submit new exam'}>
            <button className="exam-submit-btn" onClick={submit}>
              <i className="fa-solid fa-check"></i> {isEdit ? 'Save' : 'Submit'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════
   REPORT STYLE PICKER — opens new tab with the chosen-style PDF
   ═══════════════════════════════════════════════════════════════════ */
function ExamReportPicker({ req, exams, term, onClose, toast }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');

  const isAll  = req.scope === 'all';
  const target = isAll ? null : exams.find(e => e.id === req.scope);
  const name   = isAll ? `${term} Term — All Exams` : (target?.name || 'Exam Report');
  const dlLabel = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${format === 'pdf' ? 'PDF' : 'Word'}`;

  const generate = () => {
    if (format === 'word') {
      toast('Word export coming soon', 'info');
    } else {
      generateExamReport({ req, exams, term, target }, style === 'color');
    }
    onClose();
  };

  return (
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title">Download Report</div>
              <div className="rp-sub">{name} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips">
                    <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Full color with brand palette, highlights &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('bw'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips-bw">
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Printer-friendly grayscale, no background fills</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row">
            <button
              className={`rp-format-pill${format === 'pdf' ? ' selected-pdf' : ''}`}
              onClick={() => setFormat('pdf')}
            >
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button
              className={`rp-format-pill${format === 'word' ? ' selected-word' : ''}`}
              onClick={() => setFormat('word')}
            >
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Generate and download the report"><button className="rp-btn go" onClick={generate}><i className="fa-solid fa-download"></i><span>{dlLabel}</span></button></Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DATE SHEET — EDIT MODAL (subjects entry rows)
   ═══════════════════════════════════════════════════════════════════ */
function DsEditModal({ ctx, onClose, onSave, toast }) {
  const [rows, setRows] = useState(ctx.rows);
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState(null);

  const updateRow = (idx, key, val) => setRows(rs => rs.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  const addRow = () => setRows(rs => [...rs, { subject: '', date: '', timeFrom: '', timeTo: '' }]);
  const requestRemove = idx => setPendingRemoveIdx(idx);
const confirmRemove = async () => {
  if (pendingRemoveIdx == null) return;

  const row = rows[pendingRemoveIdx];

  try {
    const token = sessionStorage.getItem('token');
    const branchID = sessionStorage.getItem('branchID');

    const requestPayload = {
      id: row.id,
      branchID: Number(branchID),
      classID: Number(ctx.classID),
      sectionID: Number(ctx.sectionID),
      examID: Number(ctx.examId),
      termID: ctx.termID,
          subjectName: row.subject,      // ← Add subject name
      date: row.date,                // ← Add date
      timeFrom: row.timeFrom,        // ← Add timeFrom
      timeTo: row.timeTo,
      action: "delete"
    };

    const res = await fetch(buildUrl('/api/datesheetcrud'), {
      method: 'POST',   // (if backend supports DELETE, better; otherwise POST is fine)
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    const data = await res.json();

    if (!res.ok) {
      toast('Failed to delete subject', 'error');
      return;
    }

    // UI se remove only after success
    setRows(rs => rs.filter((_, i) => i !== pendingRemoveIdx));
    setPendingRemoveIdx(null);

    toast('Subject deleted successfully', 'success');

  } catch (err) {
    console.error(err);
    toast('Error deleting subject', 'error');
  }
};
const save = () => {
  const payload = {
    ...ctx,
    rows: rows.map(r => ({
      id: r.id || 0,  // ← Add this line to preserve the ID
      subject: (r.subject || '').trim(),
      date: r.date || '',
      timeFrom: r.timeFrom || '',
      timeTo: r.timeTo || '',
    })),
  };
  onSave(payload);
};
  return (
    <div className="exam-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="exam-modal ds-edit-modal">
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-calendar-days"></i></div>
            <div>
              <div className="exam-modal-title">Edit Date Sheet</div>
              <div className="exam-modal-sub">{ctx.className} — {rows.length} subject{rows.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="exam-modal-body ds-edit-body">
          {rows.length === 0 && (
            <div className="ds-edit-empty">
              <i className="fa-regular fa-calendar-plus"></i>
              <div>No subjects added yet.</div>
              <div className="ds-edit-empty-sub">Click <strong>Add Subject</strong> to start building the date sheet.</div>
            </div>
          )}

          {rows.map((r, idx) => (
            <div key={idx} className="ds-edit-card">
              <div className="ds-edit-card-head">
                <div className="ds-edit-num">{idx + 1}</div>
                <div className="ds-edit-card-title">
                  {r.subject?.trim() || <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>New subject</span>}
                </div>
                <Tooltip text="Remove subject"><button className="ds-edit-card-remove" onClick={() => requestRemove(idx)}>
                  <i className="fa-solid fa-trash"></i>
                </button></Tooltip>
              </div>

              <div className="ds-edit-fields">
                <div className="ds-edit-field ds-edit-field-wide">
                  <label>Subject</label>
                  <input
                    className="ds-edit-input"
                    placeholder="e.g. Mathematics"
                    list={`dsSubList-${idx}`}
                    value={r.subject}
                    onChange={e => updateRow(idx, 'subject', e.target.value)}
                  />
                 <datalist id={`dsSubList-${idx}`}>
  {(ctx.subjects || []).map(s => <option key={s.subjectID || s} value={s.subjectName || s} />)}
</datalist>
                </div>
                <div className="ds-edit-field">
                  <label>Date</label>
                  <input className="ds-edit-input" type="date" value={r.date} onChange={e => updateRow(idx, 'date', e.target.value)} />
                </div>
                <div className="ds-edit-field">
                  <label>Time From</label>
                  <input className="ds-edit-input" type="time" value={dsTimeToInput(r.timeFrom)} onChange={e => updateRow(idx, 'timeFrom', dsTimeFromInput(e.target.value))} />
                </div>
                <div className="ds-edit-field">
                  <label>Time To</label>
                  <input className="ds-edit-input" type="time" value={dsTimeToInput(r.timeTo)} onChange={e => updateRow(idx, 'timeTo', dsTimeFromInput(e.target.value))} />
                </div>
              </div>
            </div>
          ))}

          <button className="ds-edit-add" onClick={addRow}>
            <i className="fa-solid fa-plus"></i> Add Subject
          </button>
        </div>

        <div className="exam-modal-footer">
          <Tooltip text="Cancel and close"><button className="exam-cancel-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i> Cancel</button></Tooltip>
          <Tooltip text="Save Date Sheet"><button className="exam-submit-btn" onClick={save}><i className="fa-solid fa-check"></i> Save Date Sheet</button></Tooltip>
        </div>
      </div>

      {/* nested remove-row confirm (Academics-style) */}
      {pendingRemoveIdx != null && (
        <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setPendingRemoveIdx(null); }}>
          <div className="confirm-dialog">
            <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }} />
            <div className="confirm-hero">
              <div className="confirm-ring">
                <div className="confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
                  <i className="fa-solid fa-xmark"></i>
                </div>
              </div>
            </div>
            <div className="confirm-body">
              <div className="confirm-title">Remove Subject</div>
              <div
                className="confirm-msg"
                dangerouslySetInnerHTML={{
                  __html: rows[pendingRemoveIdx]?.subject?.trim()
                    ? `Are you sure you want to remove <strong>${rows[pendingRemoveIdx].subject.trim()}</strong> from the date sheet?`
                    : 'Are you sure you want to remove this subject row?',
                }}
              />
              <div className="confirm-hint">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>This subject will be deleted from the date sheet.</span>
              </div>
            </div>
            <div className="confirm-footer">
              <Tooltip text="Cancel and close"><button className="confirm-btn confirm-btn--cancel" onClick={() => setPendingRemoveIdx(null)}>Cancel</button></Tooltip>
              <Tooltip text="Yes, Remove (confirm)"><button className="confirm-btn confirm-btn--confirm" onClick={confirmRemove}>Yes, Remove</button></Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DATE SHEET — REPORT PICKER + BUILDER (A4 portrait)
   ═══════════════════════════════════════════════════════════════════ */
function DsReportPicker({ req, ex, dateSheets, term, onClose, toast }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');
  if (!ex) return null;

  const dlLabel = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${format === 'pdf' ? 'PDF' : 'Word'}`;

  const generate = () => {
    if (format === 'word') {
      toast('Word export coming soon', 'info');
    } else {
      generateDateSheetReport({ ex, dateSheets, term, classKey: req.classKey }, style === 'color');
    }
    onClose();
  };

  return (
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title">Download Report</div>
              <div className="rp-sub">{req.name} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips">
                    <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Full color with brand palette, highlights &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('bw'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips-bw">
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Printer-friendly grayscale, no background fills</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row">
            <button className={`rp-format-pill${format === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFormat('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${format === 'word' ? ' selected-word' : ''}`} onClick={() => setFormat('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Generate and download the report"><button className="rp-btn go" onClick={generate}><i className="fa-solid fa-download"></i><span>{dlLabel}</span></button></Tooltip>
        </div>
      </div>
    </div>
  );
}

function generateDateSheetReport({ ex, dateSheets, term, classKey }, isColor) {
  const isAll = classKey === 'all';
  const dsData = dateSheets[ex.id] || {};
  let targetIdxs = [];
  if (isAll) {
    targetIdxs = ex.classes.map((_, i) => i);
  } else {
    const idx = parseInt(String(classKey).split('_').pop(), 10);
    targetIdxs = [isNaN(idx) ? 0 : idx];
  }

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  /* Two coordinated palettes:
     • Colorful: brand blue header, blue-tinted accent rows.
     • Colorless: dedicated LOW-INK layout — white header, light gray
       borders, NO row striping (rowEv = white), no colored accent.
     The colorless header markup keeps the existing "light text on header"
     inline styles; we then inject a `.cl-doc-header` override style that
     recolors them to dark gray + transparent backgrounds, so the result
     is genuinely printer-friendly without rewriting every nested span. */
  const aColor = isColor ? '#1E40AF' : '#374151';
  const aBg    = isColor ? '#EFF6FF' : '#FFFFFF';
  const aBdr   = isColor ? '#BFDBFE' : '#D1D5DB';
  const tMuted = isColor ? '#64748B' : '#4B5563';
  const rowEv  = isColor ? '#F8FAFF' : '#FFFFFF';
  const hBg    = isColor ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%)' : '#FFFFFF';

  const classBlocks = targetIdxs.map(i => {
    const cls = ex.classes[i];
    if (!cls) return '';
    const key  = `cls_${ex.id}_${i}`;
    const rows = dsData[key] || [];
    const rowsHtml = rows.length
      ? rows.map((s, si) => `
        <tr style="background:${si % 2 === 0 ? '#fff' : rowEv}">
          <td style="padding:8px 12px;font-size:11.5px;font-weight:700;color:#0F172A;border-bottom:1px solid ${aBdr}">${si + 1}</td>
          <td style="padding:8px 12px;font-size:11.5px;font-weight:700;color:#0F172A;border-bottom:1px solid ${aBdr}">${s.subject}</td>
          <td style="padding:8px 12px;font-size:11.5px;color:${tMuted};border-bottom:1px solid ${aBdr}">${s.date || '—'}</td>
          <td style="padding:8px 12px;font-size:11.5px;color:${tMuted};border-bottom:1px solid ${aBdr}">${s.timeFrom || '—'}</td>
          <td style="padding:8px 12px;font-size:11.5px;color:${tMuted};border-bottom:1px solid ${aBdr}">${s.timeTo || '—'}</td>
        </tr>`).join('')
      : `<tr><td colspan="5" style="padding:12px;font-size:12px;color:${tMuted};text-align:center">No subjects added</td></tr>`;

    return `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <div style="width:7px;height:7px;border-radius:50%;background:${aColor};flex-shrink:0"></div>
          <div style="font-size:13px;font-weight:800;color:#0F172A">${cls}
            <span style="color:${tMuted};font-weight:500"> · Section A</span>
          </div>
        </div>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;border:1px solid ${aBdr}">
          <colgroup><col style="width:34px"><col><col style="width:80px"><col style="width:78px"><col style="width:78px"></colgroup>
          <thead>
            <tr style="background:${aBg}">
              <th style="padding:7px 10px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">#</th>
              <th style="padding:7px 10px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Subject</th>
              <th style="padding:7px 10px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Date</th>
              <th style="padding:7px 10px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Time From</th>
              <th style="padding:7px 10px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Time To</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }).join('');

  const reportHTML = `
    <div class="page-wrap" style="font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A">
      <div class="${isColor ? '' : 'cl-doc-header'}" style="background:${hBg};color:${isColor ? '#fff' : '#0F172A'};${isColor ? '' : 'border-bottom:1px solid ' + aBdr + ';'}border-radius:0 0 14px 14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          <div style="width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.25)">${isColor ? '🎓' : ''}</div>
          <div style="min-width:0">
            <div style="font-size:17px;font-weight:800">The Oxford System, Lahore Campus</div>
            <div style="font-size:10.5px;opacity:.75;margin-top:2px">Academic Year 2026–2027</div>
          </div>
        </div>
        <div style="text-align:right;min-width:0">
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9)">Date Sheet Report</div>
          <div style="font-size:10.5px;color:rgba(255,255,255,.65);margin-top:3px">${ex.name} · ${term} Term · Generated: ${today}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid ${aBdr}">
        ${[
          ['Term', term],
          ['Exam', ex.name],
          ['Classes', String(targetIdxs.length)],
          ['Period', `${ex.from || '—'} → ${ex.to || '—'}`],
        ].map(([k, v]) => `
          <div style="flex:1;min-width:120px;padding:10px 16px;border-right:1px solid ${aBdr};overflow-wrap:anywhere">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${tMuted};margin-bottom:2px">${k}</div>
            <div style="font-size:12.5px;font-weight:800;color:${aColor}">${v}</div>
          </div>
        `).join('')}
      </div>
      <div style="padding:16px 16px">${classBlocks || '<div style="padding:24px;text-align:center;color:' + tMuted + '">No date sheets yet.</div>'}</div>
      <div style="padding:10px 16px;background:${aBg};border-top:1px solid ${aBdr};display:flex;justify-content:space-between;font-size:10px;color:${tMuted};flex-wrap:wrap;gap:6px">
        <span>School Mentor ERP · Date Sheet Module</span>
        <span>Confidential · The Oxford System, Lahore Campus</span>
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Date Sheet — ${ex.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;overflow-x:hidden}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;font-size:12px}
@page{size:A4 portrait;margin:15mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
}
.page-wrap{width:100%;max-width:210mm;margin:0 auto;padding:0;box-sizing:border-box;overflow:hidden}
table{width:100%;table-layout:fixed}
td,th{overflow-wrap:anywhere;word-break:break-word}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
/* Colorless overrides — recolor white text + decorative fills on the header. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
${isColor ? '' : '.print-bar{background:#FFFFFF !important;border-top:1px solid #E5E7EB !important}.print-bar button{background:#FFFFFF !important;color:#0F172A !important;border:1.5px solid #0F172A !important}'}
/* Colorless overrides — recolor white text + decorative fills to a printable
   dark-on-white scheme. Marker class lives on the header div only when isColor=false. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
</style></head><body>
${reportHTML}
<div class="print-bar no-print">
  <button onclick="window.print()">${isColor ? '🖨 ' : ''}Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=960,height=820');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   SYLLABUS — EDIT MODAL (subject tabs + rich-text editor)
   ═══════════════════════════════════════════════════════════════════ */
function SylRteEditor({ html, onChange, placeholder }) {
  const ref = useRef(null);

  // Sync only when external html actually changes
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // ❗ don't overwrite while user is typing
    if (document.activeElement === el) return;

    if (el.innerHTML !== (html || '')) {
      el.innerHTML = html || '';
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className="syl-rte-editor"
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={(e) => {
        onChange(e.currentTarget.innerHTML);
      }}
    />
  );
}

function SylEditModal({ ctx, onClose, onSave, toast, subjects: externalSubjects = [], examId, term, fetchSubjectSyllabus }) {
const [localSubjects, setLocalSubjects] = useState(() => {
    if (externalSubjects && externalSubjects.length) {
      return externalSubjects.map(s => ({
        subjectID: s.subjectID,                      // ← explicitly preserve
        subjectName: s.subjectName || s.subject,
        subject: s.subjectName || s.subject,
        content: s.content || '',
        updatedAt: s.updatedAt || '—',
      }));
    }
    return [];
  });

  const [activeIdx, setActiveIdx] = useState(0);

  const loadSubjectSyllabus = async (subjectObj, idx) => {
  if (!fetchSubjectSyllabus || !subjectObj) return;

  const data = await fetchSubjectSyllabus(
    ctx.classID,
    ctx.sectionID,
    subjectObj.subjectID,
    examId,
    term
  );

  if (data && data.length) {
    const incoming = data[0];

    setLocalSubjects(ss =>
      ss.map((s, i) =>
        i === idx
          ? {
              ...s,
              id: incoming.id,
              syllabusID: incoming.syllabusID,
              content: incoming.subjectDetails || '',
              updatedAt: incoming.updatedAt || s.updatedAt
            }
          : s
      )
    );
  }
};
  const saveSubject = async (goNext = false) => {
  if (!cur) return;

  const plainText = (cur.content || '').replace(/<[^>]+>/g, '').trim();

  if (!plainText) {
    toast('Please add content first.', 'warning');
    return;
  }

  try {
    const token = sessionStorage.getItem('token');
    const branchID = sessionStorage.getItem('branchID');
const isUpdate = cur?.id > 0;

const payload = {
  id: isUpdate ? cur.id : 0,
  syllabusID: cur?.syllabusID || 0,
  imagePath: "string",
  examID: examId,
  branchID: branchID,
  classID: String(ctx.classID),
  className:  "",
  sectionID: ctx.sectionID,
  sectionName: ctx.sectionName || "",
  terms: String(term),
  termName: "",
  subjectName: String(cur.subjectID),
  subjectDisplayName: cur.subjectName,
  subjectDetails: cur.content,
  action: isUpdate ? "update" : "insert",
  imagePaths: ["string"]
};
    const response = await fetch(
      buildUrl('/api/examsyllabuscrud'),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to save syllabus');
    }

    toast('Syllabus saved successfully.', 'success');

    if (goNext) {
      const next = (activeIdx + 1) % localSubjects.length;
      setActiveIdx(next);

      if (localSubjects[next]) {
        loadSubjectSyllabus(localSubjects[next]);
      }
    } else {
      onSave(localSubjects);
    }
  } catch (err) {
    console.error(err);
    toast(err.message || 'Failed to save syllabus', 'error');
  }
};

useEffect(() => {
  if (localSubjects.length) {
    loadSubjectSyllabus(localSubjects[0], 0);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [localSubjects.length]);
  // Second useEffect — externalSubjects merge, subjectID explicitly preserve karo
  useEffect(() => {
    if (externalSubjects && externalSubjects.length) {
      const existingContent = {};
      if (ctx.subjects && ctx.subjects.length) {
        ctx.subjects.forEach(s => {
          existingContent[s.subjectName || s.subject] = { content: s.content, updatedAt: s.updatedAt };
        });
      }

      const merged = externalSubjects.map(s => ({
        subjectID: s.subjectID,                      // ← explicitly preserve
        subjectName: s.subjectName || s.subject,
        subject: s.subjectName || s.subject,
        content: existingContent[s.subjectName]?.content || s.content || '',
        updatedAt: existingContent[s.subjectName]?.updatedAt || s.updatedAt || '—',
      }));
      setLocalSubjects(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSubjects, ctx.subjects]);
  const cur = localSubjects[activeIdx] || null;
  const plainLen = (cur?.content || '').replace(/<[^>]+>/g, '').length;

  const updateContent = htmlVal => {
    setLocalSubjects(ss => ss.map((s, i) => i === activeIdx ? { ...s, content: htmlVal } : s));
  };

  const cmd = (name, val) => {
    document.execCommand(name, false, val ?? null);
    const node = document.querySelector(`#sylEditor_${activeIdx}`);
    if (node) updateContent(node.innerHTML);
  };

const saveAndNext = () => {
  saveSubject(true);
};
const save = () => {
  saveSubject(false);
};
  return (
    <div className="exam-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="exam-modal syl-edit-modal" style={{ maxWidth: 860 }}>
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-book-open"></i></div>
            <div>
              <div className="exam-modal-title">Edit Syllabus</div>
              <div className="exam-modal-sub">{ctx.className} — {localSubjects.length} subject{localSubjects.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="exam-modal-body" style={{ paddingTop: 18 }}>
          {/* Subject tabs */}
          <div className="syl-subj-tabs">
         {localSubjects.map((s, i) => (
  <button
    key={s.subjectID || i}
    className={`syl-subj-tab${i === activeIdx ? ' active' : ''}`}
    onClick={() => {
        console.log('clicked subject:', s);   // subjectID dikh raha hai ya nahi

      setActiveIdx(i);
      loadSubjectSyllabus(s, i);
    }}
  >
    {s.subjectName}
  </button>
))}
          </div>

          {cur && (
            <div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>
                  {cur.subjectName} — Syllabus Content
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Status is auto-calculated based on content.</div>
              </div>

              <div className="syl-rte-wrap">
                <div className="syl-rte-toolbar">
                  <Tooltip text="Undo"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('undo')}><i className="fa-solid fa-rotate-left"></i></button></Tooltip>
                  <Tooltip text="Redo"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('redo')}><i className="fa-solid fa-rotate-right"></i></button></Tooltip>
                  <div className="syl-tb-divider"></div>
                  <select className="syl-tb-select" onMouseDown={e => e.preventDefault()} onChange={e => { cmd('fontSize', e.target.value); e.target.selectedIndex = 0; }}>
                    <option>Size</option>
                    <option value="1">Small</option>
                    <option value="3">Normal</option>
                    <option value="4">Large</option>
                    <option value="5">X-Large</option>
                  </select>
                  <div className="syl-tb-divider"></div>
                  <Tooltip text="Bold"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('bold')}><b>B</b></button></Tooltip>
                  <Tooltip text="Underline"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('underline')}><u>U</u></button></Tooltip>
                  <Tooltip text="Italic"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('italic')}><i>I</i></button></Tooltip>
                  <div className="syl-tb-divider"></div>
                  <Tooltip text="Bullet List"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('insertUnorderedList')}><i className="fa-solid fa-list-ul"></i></button></Tooltip>
                  <Tooltip text="Numbered List"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('insertOrderedList')}><i className="fa-solid fa-list-ol"></i></button></Tooltip>
                  <div className="syl-tb-divider"></div>
                  <Tooltip text="Align Left"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('justifyLeft')}><i className="fa-solid fa-align-left"></i></button></Tooltip>
                  <Tooltip text="Align Center"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('justifyCenter')}><i className="fa-solid fa-align-center"></i></button></Tooltip>
                  <Tooltip text="Align Right"><button className="syl-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => cmd('justifyRight')}><i className="fa-solid fa-align-right"></i></button></Tooltip>
                </div>

        <SylRteEditor
  key={`${activeIdx}-${cur?.id}`}   // ✅ stable key
  html={cur?.content || ''}
  onChange={updateContent}
  placeholder="Enter syllabus content here..."
/>
                <div id={`sylEditor_${activeIdx}`} style={{ display: 'none' }} />
                <div className="syl-rte-char-count">Characters: {plainLen}</div>
              </div>
            </div>
          )}
        </div>

        <div className="exam-modal-footer">
          <Tooltip text="Discard changes and close">
            <button className="exam-cancel-btn" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i> Close
            </button>
          </Tooltip>
          <Tooltip text="Save and move to the next class">
           <button
  className="exam-cancel-btn"
  style={{ borderColor: '#1E40AF', color: '#1E40AF' }}
  onClick={saveAndNext}
>
  <i className="fa-solid fa-arrow-right"></i>
  Save & Next
</button>

          </Tooltip>
          <Tooltip text="Save and close">

<button
  className="exam-submit-btn"
  onClick={save}
>
  <i className="fa-solid fa-check"></i>
  Save & Close
</button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   SYLLABUS — REPORT PICKER + BUILDER (A4 portrait)
   ═══════════════════════════════════════════════════════════════════ */
function SylReportPicker({ req, ex, syllabusData, term, onClose, toast }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');
  if (!ex) return null;

  const dlLabel = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${format === 'pdf' ? 'PDF' : 'Word'}`;

  const generate = () => {
    if (format === 'word') {
      toast('Word export coming soon', 'info');
    } else {
      generateSyllabusReport({ ex, syllabusData, term, classKey: req.classKey }, style === 'color');
    }
    onClose();
  };

  return (
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title">Download Syllabus Report</div>
              <div className="rp-sub">{req.name} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips">
                    <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Full color with brand palette, highlights &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('bw'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips-bw">
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Printer-friendly grayscale, no background fills</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row">
            <button className={`rp-format-pill${format === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFormat('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${format === 'word' ? ' selected-word' : ''}`} onClick={() => setFormat('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Generate and download the report"><button className="rp-btn go" onClick={generate}><i className="fa-solid fa-download"></i><span>{dlLabel}</span></button></Tooltip>
        </div>
      </div>
    </div>
  );
}

function generateSyllabusReport({ ex, syllabusData, term, classKey }, isColor) {
  const isAll = classKey === 'all';
  const sylData = syllabusData[ex.id] || {};
  let targetIdxs = [];
  if (isAll) {
    targetIdxs = ex.classes.map((_, i) => i);
  } else {
    const idx = parseInt(String(classKey).split('_').pop(), 10);
    targetIdxs = [isNaN(idx) ? 0 : idx];
  }

  const today  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const aColor = isColor ? '#1E40AF' : '#374151';
  const aBg    = isColor ? '#EFF6FF' : '#F5F5F5';
  const aBdr   = isColor ? '#BFDBFE' : '#DDD';
  const tMuted = isColor ? '#64748B' : '#666';
  const rowEv  = isColor ? '#F8FAFF' : '#F7F7F7';
  const hBg    = isColor ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%)' : '#FFFFFF';
  const okC    = isColor ? '#16A34A' : '#333';
  const noC    = isColor ? '#D97706' : '#777';

  const classBlocks = targetIdxs.map(ci => {
    const cls  = ex.classes[ci]; if (!cls) return '';
    const key  = `scls_${ex.id}_${ci}`;
    const rows = sylData[key] || [];

    const rowsHtml = rows.length ? rows.map((s, si) => {
      const plainAll = (s.content || '').replace(/<[^>]+>/g, '').trim();
      const added    = plainAll.length > 0;
      const plain    = plainAll ? plainAll.substring(0, 80) + (plainAll.length > 80 ? '…' : '') : '—';
      const sc       = added ? okC : noC;
      return `
        <tr style="background:${si % 2 === 0 ? '#fff' : rowEv}">
          <td style="padding:8px 12px;font-size:11.5px;font-weight:700;color:#0F172A;border-bottom:1px solid ${aBdr}">${si + 1}</td>
          <td style="padding:8px 12px;font-size:11.5px;font-weight:700;color:#0F172A;border-bottom:1px solid ${aBdr}">${s.subject}</td>
          <td style="padding:8px 12px;font-size:11px;color:${tMuted};border-bottom:1px solid ${aBdr}">${plain}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${aBdr}">
            <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:${sc}22;color:${sc};border:1px solid ${sc}55">
              ${added ? 'Added' : 'Not Added'}
            </span>
          </td>
          <td style="padding:8px 12px;font-size:11px;color:${tMuted};border-bottom:1px solid ${aBdr}">${s.updatedAt || '—'}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="5" style="padding:12px;text-align:center;font-size:12px;color:${tMuted}">No syllabus added</td></tr>`;

    return `
      <div style="margin-bottom:20px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
          <div style="width:7px;height:7px;border-radius:50%;background:${aColor};flex-shrink:0"></div>
          <div style="font-size:13px;font-weight:800;color:#0F172A">${cls}
            <span style="color:${tMuted};font-weight:500"> · Section A</span>
          </div>
        </div>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;border:1px solid ${aBdr}">
          <colgroup><col style="width:34px"><col style="width:90px"><col><col style="width:80px"><col style="width:78px"></colgroup>
          <thead>
            <tr style="background:${aBg}">
              <th style="padding:7px 12px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">#</th>
              <th style="padding:7px 12px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Subject</th>
              <th style="padding:7px 12px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Syllabus Summary</th>
              <th style="padding:7px 12px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Status</th>
              <th style="padding:7px 12px;font-size:10px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid ${aBdr}">Updated</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }).join('');

  const reportHTML = `
    <div class="page-wrap" style="font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A">
      <div class="${isColor ? '' : 'cl-doc-header'}" style="background:${hBg};color:${isColor ? '#fff' : '#0F172A'};border-radius:0 0 14px 14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          <div style="width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.25)">📚</div>
          <div style="min-width:0">
            <div style="font-size:17px;font-weight:800">The Oxford System, Lahore Campus</div>
            <div style="font-size:10.5px;opacity:.75;margin-top:2px">Academic Year 2026–2027</div>
          </div>
        </div>
        <div style="text-align:right;min-width:0">
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9)">Syllabus Report</div>
          <div style="font-size:10.5px;color:rgba(255,255,255,.65);margin-top:3px">${ex.name} · ${term} Term · Generated: ${today}</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid ${aBdr}">
        ${[
          ['Term', term],
          ['Exam', ex.name],
          ['Classes', String(targetIdxs.length)],
        ].map(([k, v]) => `
          <div style="flex:1;min-width:120px;padding:10px 16px;border-right:1px solid ${aBdr};overflow-wrap:anywhere">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${tMuted};margin-bottom:2px">${k}</div>
            <div style="font-size:12.5px;font-weight:800;color:${aColor}">${v}</div>
          </div>
        `).join('')}
      </div>
      <div style="padding:16px 16px">${classBlocks || '<div style="padding:24px;text-align:center;color:' + tMuted + '">No syllabus yet.</div>'}</div>
      <div style="padding:10px 16px;background:${aBg};border-top:1px solid ${aBdr};display:flex;justify-content:space-between;font-size:10px;color:${tMuted};flex-wrap:wrap;gap:6px">
        <span>School Mentor ERP · Syllabus Module</span>
        <span>Confidential · The Oxford System, Lahore Campus</span>
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Syllabus — ${ex.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;overflow-x:hidden}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;font-size:12px}
@page{size:A4 portrait;margin:15mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
}
.page-wrap{width:100%;max-width:210mm;margin:0 auto;padding:0;box-sizing:border-box;overflow:hidden}
table{width:100%;table-layout:fixed}
td,th{overflow-wrap:anywhere;word-break:break-word}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
/* Colorless overrides — recolor white text + decorative fills on the header. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
${isColor ? '' : '.print-bar{background:#FFFFFF !important;border-top:1px solid #E5E7EB !important}.print-bar button{background:#FFFFFF !important;color:#0F172A !important;border:1.5px solid #0F172A !important}'}
/* Colorless overrides — recolor white text + decorative fills to a printable
   dark-on-white scheme. Marker class lives on the header div only when isColor=false. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
</style></head><body>
${reportHTML}
<div class="print-bar no-print">
  <button onclick="window.print()">${isColor ? '🖨 ' : ''}Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=960,height=820');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   RESULT CARD OPTIONS — TEMPLATE HERO MOCKS + PREVIEW POPUP
   ═══════════════════════════════════════════════════════════════════ */
function TemplateHero({ id, large = false }) {
  const h = large ? 220 : 110;
  const pad = large ? '20px 22px' : '12px 14px';

  if (id === 'classic') {
    return (
      <div style={{ height: h, background: 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 55%,#2563EB 100%)', padding: pad, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <div style={{ width: large ? 38 : 22, height: large ? 38 : 22, borderRadius: 5, background: 'rgba(255,255,255,.25)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: large ? 9 : 5, borderRadius: 3, background: 'rgba(255,255,255,.95)', width: '75%', marginBottom: 4 }} />
            <div style={{ height: large ? 5 : 3, borderRadius: 2, background: 'rgba(255,255,255,.4)', width: '48%' }} />
          </div>
          <div style={{ width: large ? 36 : 20, height: large ? 36 : 20, borderRadius: '50%', background: 'rgba(255,255,255,.2)', border: '1.5px solid rgba(255,255,255,.35)' }} />
        </div>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 8 }}>
          {[0,1,2].map(i => <div key={i} style={{ height: large ? 5 : 3, borderRadius: 2, background: 'rgba(255,255,255,.5)' }} />)}
        </div>
        <div style={{ position: 'relative', background: 'rgba(255,255,255,.1)', borderRadius: 4, overflow: 'hidden' }}>
          {[0,1,2].map(rowI => (
            <div key={rowI} style={{ display: 'flex', gap: 4, padding: large ? '6px 9px' : (rowI === 0 ? '3px 5px' : '2px 5px'), background: rowI === 0 ? 'rgba(255,255,255,.12)' : 'transparent', borderBottom: rowI < 2 ? '1px solid rgba(255,255,255,.06)' : 'none' }}>
              <div style={{ height: large ? 4 : 2.5, borderRadius: 1, background: `rgba(255,255,255,${rowI === 0 ? 0.7 : 0.5})`, flex: 2 }} />
              <div style={{ height: large ? 4 : 2.5, borderRadius: 1, background: `rgba(255,255,255,${rowI === 0 ? 0.5 : 0.35})`, flex: 1 }} />
              <div style={{ height: large ? 4 : 2.5, borderRadius: 1, background: `rgba(255,255,255,${rowI === 0 ? 0.5 : 0.35})`, flex: 1 }} />
              <div style={{ height: large ? 4 : 2.5, borderRadius: 1, background: `rgba(255,255,255,${rowI === 0 ? 0.5 : 0.35})`, flex: 1 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === 'insight') {
    return (
      <div style={{ height: h, background: 'linear-gradient(150deg,#0F1F55 0%,#1E3A8A 50%,#1E40AF 100%)', padding: pad, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: -15, left: -15, width: 60, height: 60, borderRadius: '50%', background: 'rgba(124,58,237,.2)' }} />
        <div style={{ position: 'absolute', top: -10, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(6,182,212,.15)' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: large ? 36 : 20, height: large ? 36 : 20, borderRadius: '50%', background: 'rgba(255,255,255,.18)', border: '1.5px solid rgba(255,255,255,.35)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: large ? 9 : 5, borderRadius: 3, background: 'rgba(255,255,255,.9)', width: '70%', marginBottom: 4 }} />
            <div style={{ height: large ? 5 : 3, borderRadius: 2, background: 'rgba(255,255,255,.4)', width: '46%' }} />
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <div style={{ width: large ? 36 : 20, height: large ? 30 : 16, borderRadius: 3, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)' }} />
            <div style={{ width: large ? 36 : 20, height: large ? 30 : 16, borderRadius: 3, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)' }} />
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: large ? 6 : 3, marginBottom: 6 }}>
          {[
            { w: 90, c: 'rgba(34,197,94,.8)' },
            { w: 75, c: 'rgba(59,130,246,.85)' },
            { w: 100, c: 'rgba(124,58,237,.9)' },
            { w: 60, c: 'rgba(245,158,11,.85)' },
          ].map((b, bi) => (
            <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: large ? 50 : 28, height: large ? 4 : 2.5, borderRadius: 1, background: 'rgba(255,255,255,.3)' }} />
              <div style={{ flex: 1, height: large ? 9 : 5, borderRadius: 3, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${b.w}%`, background: b.c, borderRadius: 3 }} />
              </div>
              <div style={{ width: large ? 28 : 16, fontSize: large ? 10 : 7, color: 'rgba(255,255,255,.7)', textAlign: 'right' }}>{b.w}%</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: large ? 5 : 3, background: 'linear-gradient(90deg,#7C3AED,#1E40AF,#06B6D4)', borderRadius: 2 }} />
      </div>
    );
  }

  // portfolio
  return (
    <div style={{ height: h, background: 'linear-gradient(150deg,#1A0533 0%,#2D1B69 40%,#1A3A5C 100%)', padding: pad, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -10, width: 70, height: 70, borderRadius: '50%', background: 'rgba(217,119,6,.2)' }} />
      <div style={{ position: 'absolute', bottom: -15, left: 10, width: 50, height: 50, borderRadius: '50%', background: 'rgba(6,182,212,.15)' }} />
      <div style={{ position: 'relative', display: 'flex', gap: 5, height: large ? 170 : 86 }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: 4, padding: 5, border: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ height: large ? 32 : 18, background: 'linear-gradient(135deg,rgba(217,119,6,.7),rgba(180,83,9,.6))', borderRadius: 2, marginBottom: 4, display: 'flex', alignItems: 'center', padding: '0 4px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,.6)', marginRight: 3 }} />
            <div style={{ height: 2.5, flex: 1, background: 'rgba(255,255,255,.7)', borderRadius: 1 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, marginBottom: 3 }}>
            <div style={{ height: 2, background: 'rgba(255,255,255,.4)', borderRadius: 1 }} />
            <div style={{ height: 2, background: 'rgba(255,255,255,.4)', borderRadius: 1 }} />
          </div>
          <div style={{ height: large ? 60 : 30, background: 'rgba(255,255,255,.06)', borderRadius: 2, padding: '2px 3px' }}>
            {[1, .8, 1, .7].map((w, i) => (
              <div key={i} style={{ height: 2, background: `rgba(255,255,255,${[0.5,0.35,0.35,0.25][i]})`, borderRadius: 1, marginBottom: 2, width: `${w*100}%` }} />
            ))}
          </div>
          <div style={{ marginTop: 3, display: 'flex', gap: 2 }}>
            <div style={{ flex: 1, height: 8, background: 'rgba(34,197,94,.4)', borderRadius: 2 }} />
            <div style={{ flex: 1, height: 8, background: 'rgba(59,130,246,.4)', borderRadius: 2 }} />
            <div style={{ flex: 1, height: 8, background: 'rgba(245,158,11,.4)', borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: 4, padding: 5, border: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ height: 12, background: 'rgba(6,182,212,.25)', borderRadius: 2, marginBottom: 4 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { w: 85, c: 'rgba(34,197,94,.6)' },
              { w: 100, c: 'rgba(124,58,237,.6)' },
              { w: 70, c: 'rgba(6,182,212,.6)' },
              { w: 90, c: 'rgba(245,158,11,.6)' },
            ].map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 20, height: 3, background: 'rgba(255,255,255,.3)', borderRadius: 1 }} />
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${b.w}%`, background: b.c, borderRadius: 2 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 3 }}>
            <div style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(217,119,6,.4)' }} />
            <div style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(6,182,212,.3)' }} />
            <div style={{ width: 16, height: 16, borderRadius: 3, background: 'rgba(124,58,237,.3)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ClassicResultCard({ rcoGeneral, rcoSig, rsSigs, rsAbsentMode, mode = 'single', student, rd: rdProp, ex: exProp }) {
  const opt = {};
  rcoGeneral.forEach(o => { opt[o.label] = o.on; });
  rcoSig.forEach(o => { opt[o.label] = o.on; });

  const st = student || SAMPLE_RC_STUDENT;
  const rd = rdProp  || SAMPLE_RC_RD;
  const ex = exProp  || SAMPLE_RC_EX;
  const isCombined = mode === 'combined';
  const cb = isCombined ? SAMPLE_RC_COMBINED : null;

  // Color palette (Color version)
  const accent     = '#1E40AF';
  const accentBg   = '#EFF6FF';
  const accentBdr  = '#BFDBFE';
  const hdrBg      = 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%)';
  const hdrBar     = 'linear-gradient(90deg,#1E3A8A,#2563EB,#93C5FD)';
  const textPri    = '#0F172A';
  const textSec    = '#1E40AF';
  const textMut    = '#64748B';
  const rowAlt     = '#F8FAFF';
  const successCol = '#16A34A';
  const warnCol    = '#D97706';

  const schoolName = 'The Oxford System, Lahore Campus';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const absentSet = {};
  (st.absentSubjects || []).forEach(s => { absentSet[s] = true; });

  const useZeroMode = rsAbsentMode === 'zero';
  const subjects = RES_SUBJECTS.slice(0, 10);

  const totalAll = subjects.reduce((a, s) => (useZeroMode || !absentSet[s]) ? a + (rd.totalMarks[s] ?? 20) : a, 0);
  const obtAll   = subjects.reduce((a, s) => absentSet[s] ? a : a + (st.obtained[s] || 0), 0);
  const ovPct    = isCombined ? cb.ovPct : (totalAll ? Math.min(100, Math.round((obtAll / totalAll) * 10000) / 100) : 0);
  const ovGrade  = rcGetGrade(obtAll, totalAll);
  const finalRem = rcGetFinalRemarks(ovPct);

  const position = opt['Show Position in Class'] ? '1st / 1' : '—';

  const hasSubjTable = opt['Show Subject-wise Marks'] || opt['Show Total Marks'] || opt['Show Obtained Marks'];

  const absBg    = 'rgba(217,119,6,.09)';
  const absBdr   = 'rgba(217,119,6,.25)';
  const absCol   = '#B45309';
  const absRowBg = 'rgba(251,191,36,.06)';

  const gradeChipColor = g => {
    if (!g) return '#475569';
    if (g.grade === 'A+') return '#16A34A';
    if (g.grade === 'A')  return '#15803D';
    if (g.grade === 'B')  return '#1D4ED8';
    if (g.grade === 'C')  return '#B45309';
    return '#B91C1C';
  };

  const thBase = {
    padding: '5px 7px', fontSize: 9, fontWeight: 700, color: textSec,
    textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.4px',
    borderBottom: `2px solid ${accentBdr}`,
  };
  const thCenter = { ...thBase, textAlign: 'center' };

  const sumItems = [];
  if (opt['Show Percentage'])        sumItems.push({ label: 'Overall %',        val: `${ovPct}%`,                col: accent });
  if (opt['Show Grade'])             sumItems.push({ label: 'Grade',             val: ovGrade ? ovGrade.grade : '—', col: successCol });
  if (opt['Show Position in Class']) sumItems.push({ label: 'Position in Class', val: position,                  col: warnCol });
  if (opt['Show Attendance'])        sumItems.push({ label: 'Attendance',        val: st.attendance || '—',      col: successCol });

  const initials = st.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", background: '#fff', width: '100%', maxWidth: 700, margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
      {/* Header */}
      <div style={{ background: hdrBg, padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {opt['Show School Logo'] && (
          <div style={{ width: 42, height: 42, borderRadius: 9, flexShrink: 0, border: '1.5px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCD34D' }}>
            <i className="fa-solid fa-graduation-cap" style={{ fontSize: 20 }}></i>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {opt['Show School Name'] && (
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-.01em', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {schoolName}
            </div>
          )}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>
            Result Card · Academic Year 2026–2027
          </div>
        </div>
        {opt['Show Student Photo'] && (
          <div style={{ width: 54, height: 54, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,.2)', border: '2px solid rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, color: '#fff' }}>
            {initials}
          </div>
        )}
      </div>
      <div style={{ height: 3, background: hdrBar }} />

      {/* Student info grid */}
      <div style={{ padding: '7px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 14px', borderBottom: `1px solid ${accentBdr}`, background: accentBg }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Student Name</div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: textPri, marginTop: 1 }}>{st.name}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Father Name</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: textPri, marginTop: 1 }}>{st.father}</div>
        </div>
        {opt['Show Student Roll Number'] ? (
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Roll Number</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: textPri, marginTop: 1 }}>{st.rollNo}</div>
          </div>
        ) : <div />}
        {opt['Show Class and Section'] ? (
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Class</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: textSec, marginTop: 1 }}>{ex.classes[0] || '—'} · Section A</div>
          </div>
        ) : <div />}
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Exam</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: textSec, marginTop: 1 }}>{ex.name}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Generated</div>
          <div style={{ fontSize: 10.5, color: textMut, marginTop: 1 }}>{today}</div>
        </div>
      </div>

      {/* Marks table */}
      {hasSubjTable && (
        <div style={{ padding: '6px 18px 2px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: `1px solid ${accentBdr}`, fontSize: 11 }}>
            <thead>
              <tr style={{ background: accentBg }}>
                <th style={thBase}>Sn.</th>
                {opt['Show Subject-wise Marks'] && <th style={thBase}>Subject</th>}
                {opt['Show Total Marks']        && <th style={thCenter}>Total</th>}
                {opt['Show Obtained Marks']     && <th style={thCenter}>Obtained</th>}
                {opt['Show Percentage']         && <th style={thCenter}>%</th>}
                {opt['Show Grade']              && <th style={thCenter}>Grade</th>}
                <th style={thBase}>Comment</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s, i) => {
                const isAbs = !!absentSet[s];
                const tot = rd.totalMarks[s] ?? 20;
                const obt = isAbs ? 0 : (st.obtained[s] || 0);
                const pct = (!isAbs && tot) ? Math.round((obt / tot) * 100) : 0;
                const g   = (!isAbs && obt > 0) ? rcGetGrade(obt, tot) : null;
                const mc  = isAbs ? 'Absent' : (g ? g.comment : '').slice(0, 28);
                const gcol = gradeChipColor(g);
                const bg = isAbs ? absRowBg : (i % 2 === 0 ? '#fff' : rowAlt);
                const tdBase   = { padding: '4px 7px', fontSize: 11, borderBottom: `1px solid ${accentBdr}` };
                const tdCenter = { ...tdBase, textAlign: 'center' };
                return (
                  <tr key={s} style={{ background: bg }}>
                    <td style={{ ...tdBase, fontWeight: 700, color: textPri }}>{i + 1}</td>
                    {opt['Show Subject-wise Marks'] && (
                      <td style={{ ...tdBase, fontWeight: 600, color: isAbs ? absCol : textPri }}>
                        {s}{isAbs && <span style={{ fontSize: 9, color: absCol, fontWeight: 500 }}> (Absent)</span>}
                      </td>
                    )}
                    {opt['Show Total Marks'] && (
                      <td style={tdCenter}>
                        {isAbs ? <span style={{ color: textMut, fontSize: 10 }}>—</span> : tot}
                      </td>
                    )}
                    {opt['Show Obtained Marks'] && (
                      <td style={tdCenter}>
                        {isAbs ? (
                          useZeroMode ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, background: absBg, color: absCol, border: `1px solid ${absBdr}` }}>
                              <span>AB</span><span style={{ opacity: .5, fontWeight: 400 }}>/</span><span>0</span>
                            </span>
                          ) : (
                            <span style={{ display: 'inline-block', padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, letterSpacing: '.3px', background: absBg, color: absCol, border: `1px solid ${absBdr}` }}>AB</span>
                          )
                        ) : (
                          <span style={{ fontWeight: 700, color: accent }}>{obt}</span>
                        )}
                      </td>
                    )}
                    {opt['Show Percentage'] && (
                      <td style={tdCenter}>
                        {isAbs ? <span style={{ color: textMut, fontSize: 10 }}>—</span> : (tot ? `${pct}%` : '—')}
                      </td>
                    )}
                    {opt['Show Grade'] && (
                      <td style={tdCenter}>
                        {isAbs ? <span style={{ color: textMut, fontSize: 10 }}>—</span> : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: 9.5, fontWeight: 800, background: gcol + '18', color: gcol }}>
                            {g ? g.grade : '—'}
                          </span>
                        )}
                      </td>
                    )}
                    <td style={{ ...tdBase, fontSize: 10, color: isAbs ? absCol : textMut }}><em>{mc}</em></td>
                  </tr>
                );
              })}

              {/* Grand total row */}
              <tr style={{ background: accentBg }}>
                <td colSpan={1 + (opt['Show Subject-wise Marks'] ? 1 : 0)} style={{ padding: '5px 7px', fontSize: 10.5, fontWeight: 800, color: accent, borderTop: `2px solid ${accentBdr}` }}>
                  Grand Total
                </td>
                {opt['Show Total Marks'] && (
                  <td style={{ padding: '5px 7px', textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: accent, borderTop: `2px solid ${accentBdr}` }}>
                    {totalAll}
                    {!useZeroMode && (
                      <span style={{ fontSize: 8.5, fontWeight: 500, color: textMut, display: 'block', lineHeight: 1 }}>(excl. absent)</span>
                    )}
                  </td>
                )}
                {opt['Show Obtained Marks'] && (
                  <td style={{ padding: '5px 7px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: accent, borderTop: `2px solid ${accentBdr}` }}>{obtAll}</td>
                )}
                {opt['Show Percentage'] && (
                  <td style={{ padding: '5px 7px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: successCol, borderTop: `2px solid ${accentBdr}` }}>{ovPct}%</td>
                )}
                {opt['Show Grade'] && (
                  <td style={{ padding: '5px 7px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: accent, borderTop: `2px solid ${accentBdr}` }}>
                    {ovGrade ? ovGrade.grade : '—'}
                  </td>
                )}
                <td style={{ padding: '5px 7px', fontSize: 9.5, color: textMut, borderTop: `2px solid ${accentBdr}` }}>N/A</td>
              </tr>

              {/* Sub Exam breakdown (combined only) */}
              {isCombined && cb && (
                <>
                  <tr style={{ background: 'rgba(30,64,175,.06)' }}>
                    <td colSpan={7} style={{ padding: '5px 8px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: accent, borderTop: '1.5px solid #E2E8F0' }}>
                      <i className="fa-solid fa-layer-group" style={{ marginRight: 4 }}></i>Sub Exam Breakdown
                    </td>
                  </tr>
                  {cb.subBreakdown.map((sb, i) => {
                    const cpct = sb.origT ? Math.round((sb.subObt / sb.origT) * 100) : 0;
                    return (
                      <tr key={i} style={{ background: 'rgba(124,58,237,.05)' }}>
                        <td colSpan={1 + (opt['Show Subject-wise Marks'] ? 1 : 0)} style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, color: '#7C3AED' }}>
                          <i className="fa-solid fa-layer-group" style={{ fontSize: 9, marginRight: 4 }}></i>
                          {sb.name} <span style={{ fontSize: 9, fontWeight: 400, color: textMut }}>(Sub Exam)</span>
                        </td>
                        {opt['Show Total Marks']    && <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: 10.5, color: textMut }}>{sb.origT}</td>}
                        {opt['Show Obtained Marks'] && <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: 10.5, color: textMut }}>{sb.subObt}</td>}
                        {opt['Show Percentage']     && <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: 10, color: '#7C3AED', fontWeight: 700 }}>{cpct}%</td>}
                        {opt['Show Grade']          && <td style={{ padding: '4px 8px', textAlign: 'center', fontSize: 10, color: '#7C3AED', fontWeight: 700 }}>{sb.conv}/{sb.weight}</td>}
                        <td style={{ padding: '4px 8px', fontSize: 9.5, color: textMut }}>Converted: {sb.conv}/{sb.weight}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'rgba(22,163,74,.07)' }}>
                    <td colSpan={1 + (opt['Show Subject-wise Marks'] ? 1 : 0)} style={{ padding: '5px 8px', fontSize: 10.5, fontWeight: 800, color: successCol, borderTop: '1.5px solid rgba(22,163,74,.15)' }}>Grand Total</td>
                    {opt['Show Total Marks']    && <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: successCol }}>{cb.grandTotal}</td>}
                    {opt['Show Obtained Marks'] && <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: 12, fontWeight: 900, color: successCol }}>{cb.grandObt}</td>}
                    {opt['Show Percentage']     && <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: successCol }}>{cb.ovPct}%</td>}
                    {opt['Show Grade']          && <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: 11, fontWeight: 900, color: successCol }}>{(rcGetGrade(cb.grandObt, cb.grandTotal) || {}).grade || '—'}</td>}
                    <td style={{ padding: '5px 8px', fontSize: 9, color: textMut }}>{cb.mainExName} + sub exams</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary strip */}
      {sumItems.length > 0 && (
        <div style={{ display: 'flex', borderTop: `1px solid ${accentBdr}`, borderBottom: `1px solid ${accentBdr}`, margin: '2px 18px 0' }}>
          {sumItems.map((item, i) => (
            <div key={i} style={{ flex: 1, padding: '5px 8px', textAlign: 'center', borderRight: i < sumItems.length - 1 ? `1px solid ${accentBdr}` : 'none' }}>
              <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: textMut, marginBottom: 1 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: item.col }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Final Remarks */}
      {opt['Show Final Remarks'] && (
        <div style={{ padding: '8px 18px 6px' }}>
          <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: textMut, marginBottom: 2 }}>FINAL REMARKS</div>
          <div style={{ fontSize: 10.5, color: '#374151', lineHeight: 1.4 }}>{finalRem.slice(0, 200)}</div>
        </div>
      )}

      {/* Signatures */}
      {(opt['Show Principal Signature'] || opt['Show Parent Signature']) && rsSigs.length > 0 && (
        <div style={{ padding: '8px 18px 10px', borderTop: `1px solid ${accentBdr}`, display: 'flex', gap: 10 }}>
          {rsSigs.map(sig => (
            <div key={sig.id} style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
              <div style={{ height: 28, borderBottom: '1.5px solid #94A3B8', marginBottom: 4 }}>
                {sig.img && <img src={sig.img} alt="" style={{ maxHeight: 32, objectFit: 'contain' }} />}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: textMut }}>{sig.name}</div>
              <div style={{ fontSize: 8.5, color: textMut }}>{sig.desig}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '6px 18px', background: accentBg, borderTop: `1px solid ${accentBdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 8.5, color: textMut }}>School Mentor ERP · Examination Module</div>
        <div style={{ fontSize: 8.5, color: textMut }}>{schoolName}</div>
      </div>
    </div>
  );
}

function InsightResultCard({ rcoGeneral, rcoSig, rsSigs, rsAbsentMode, mode = 'single', student, rd: rdProp, ex: exProp }) {
  const opt = {};
  rcoGeneral.forEach(o => { opt[o.label] = o.on; });
  rcoSig.forEach(o => { opt[o.label] = o.on; });

  const st = student || SAMPLE_RC_STUDENT;
  const rd = rdProp  || SAMPLE_RC_RD;
  const ex = exProp  || SAMPLE_RC_EX;
  const isCombined = mode === 'combined';
  const cb = isCombined ? SAMPLE_RC_COMBINED : null;

  const accent     = '#1E40AF';
  const accentBg   = '#EFF6FF';
  const accentBdr  = '#BFDBFE';
  const hdrBg      = 'linear-gradient(135deg,#1E3A8A,#1E40AF)';
  const hdrBar     = 'linear-gradient(90deg,#7C3AED,#1E40AF,#38BDF8)';
  const textPri    = '#0F172A';
  const textMut    = '#64748B';
  const grn        = '#16A34A';
  const amb        = '#D97706';
  const red        = '#DC2626';
  const today      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';

  const absentSet = {};
  (st.absentSubjects || []).forEach(s => { absentSet[s] = true; });

  const useZeroMode = rsAbsentMode === 'zero';
  const subjects = RES_SUBJECTS.slice(0, 10);
  const totalAll = subjects.reduce((a, s) => (useZeroMode || !absentSet[s]) ? a + (rd.totalMarks[s] ?? 20) : a, 0);
  const obtAll   = subjects.reduce((a, s) => absentSet[s] ? a : a + (st.obtained[s] || 0), 0);
  const ovPct    = isCombined ? cb.ovPct : (totalAll ? Math.min(100, Math.round((obtAll / totalAll) * 10000) / 100) : 0);
  const ovGrade  = rcGetGrade(obtAll, totalAll);
  const finalRem = rcGetFinalRemarks(ovPct);

  const position = opt['Show Position in Class'] ? '1st / 1' : '—';

  const barPalette = ['#1E40AF','#16A34A','#D97706','#7C3AED','#DC2626','#0891B2','#EA580C','#059669','#9333EA','#B45309'];
  const subjData = subjects.map((s, i) => {
    const isAbs = !!absentSet[s];
    const tot = rd.totalMarks[s] ?? 20;
    const obt = isAbs ? 0 : (st.obtained[s] || 0);
    const pct = (!isAbs && tot) ? Math.round((obt / tot) * 100) : 0;
    const g   = (!isAbs && obt > 0) ? rcGetGrade(obt, tot) : null;
    const col = barPalette[i % barPalette.length];
    const pctCol = isAbs ? textMut : pct >= 80 ? grn : pct >= 60 ? amb : red;
    return { s, tot, obt, pct, g, isAbs, col, pctCol };
  });

  const gcol = g => {
    if (!g) return '#94A3B8';
    const m = { 'A+':'#16A34A','A':'#15803D','B':'#1D4ED8','C':'#B45309','D':'#EA580C','F':'#DC2626' };
    return m[g.grade] || '#475569';
  };

  const initials = st.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();

  const summaryItems = [];
  if (opt['Show Percentage'])        summaryItems.push({ label: 'Overall', val: `${ovPct}%`,                col: accent, bg: '#EFF6FF', bdr: '#BFDBFE' });
  if (opt['Show Grade'] && ovGrade)  summaryItems.push({ label: 'Grade',   val: ovGrade.grade,              col: grn,    bg: '#F0FDF4', bdr: '#BBF7D0' });
  if (opt['Show Position in Class']) summaryItems.push({ label: 'Position',val: position,                   col: amb,    bg: '#FFFBEB', bdr: '#FDE68A' });
  if (opt['Show Attendance'])        summaryItems.push({ label: 'Attendance', val: st.attendance || '—',    col: '#7C3AED', bg: '#FAF5FF', bdr: '#DDD8FE' });

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", background: '#fff', width: '100%', maxWidth: 700, margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
      {/* Header */}
      <div style={{ background: hdrBg, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {opt['Show School Logo'] && (
          <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,#7C3AED,#1E40AF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCD34D' }}>
            <i className="fa-solid fa-graduation-cap" style={{ fontSize: 17 }}></i>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {opt['Show School Name'] && (
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schoolName}</div>
          )}
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,.6)', marginTop: 1 }}>Insight Result Card · Academic Year 2026–2027</div>
        </div>
        {opt['Show Student Photo'] && (
          <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,.15)', border: '2px solid rgba(255,255,255,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
        )}
      </div>
      <div style={{ height: 3, background: hdrBar }} />

      {/* Student info grid */}
      <div style={{ padding: '10px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px 16px', background: accentBg, borderBottom: `1px solid ${accentBdr}` }}>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Student</div>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: textPri, marginTop: 1 }}>{st.name}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Father</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: textPri, marginTop: 1 }}>{st.father}</div>
        </div>
        {opt['Show Student Roll Number'] ? (
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Roll No.</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: textPri, marginTop: 1 }}>{st.rollNo}</div>
          </div>
        ) : <div />}
        {opt['Show Class and Section'] ? (
          <div>
            <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Class</div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: accent, marginTop: 1 }}>{ex.classes[0] || '—'} · A</div>
          </div>
        ) : <div />}
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Exam</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: accent, marginTop: 1 }}>{ex.name}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, fontWeight: 700, color: textMut, textTransform: 'uppercase', letterSpacing: '.4px' }}>Date</div>
          <div style={{ fontSize: 10.5, color: textMut, marginTop: 1 }}>{today}</div>
        </div>
      </div>

      {/* Summary pill row */}
      {summaryItems.length > 0 && (
        <div style={{ padding: '10px 20px', display: 'flex', gap: 8, borderBottom: `1px solid ${accentBdr}` }}>
          {summaryItems.map((item, i) => (
            <div key={i} style={{ flex: 1, padding: '10px 8px', textAlign: 'center', borderRadius: 10, background: item.bg, border: `1px solid ${item.bdr}` }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: item.col, lineHeight: 1 }}>{item.val}</div>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: textMut, marginTop: 3 }}>{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Combined sub-exam strip */}
      {isCombined && cb && (
        <div style={{ padding: '6px 20px', background: 'rgba(124,58,237,.07)', borderBottom: '1px solid rgba(124,58,237,.2)', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#7C3AED', flexShrink: 0, marginRight: 4 }}>
            <i className="fa-solid fa-layer-group" style={{ marginRight: 3 }}></i>Sub Exams
          </span>
          {cb.subBreakdown.map((sb, i) => (
            <span key={i} style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(124,58,237,.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,.18)', whiteSpace: 'nowrap' }}>
              {sb.name}: <strong>{sb.conv}/{sb.weight}</strong>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 800, color: grn, whiteSpace: 'nowrap' }}>
            Grand: {cb.grandObt}/{cb.grandTotal} = {cb.ovPct}%
          </span>
        </div>
      )}

      {/* Subject performance bars */}
      <div style={{ padding: '12px 20px 8px' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: textMut, marginBottom: 8 }}>
          Subject Performance
        </div>
        {subjData.map(d => (
          <div key={d.s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <div style={{ width: 100, flexShrink: 0, fontSize: 11, fontWeight: 600, color: d.isAbs ? amb : textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.s}</div>
            <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#F1F5F9', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${d.isAbs ? 0 : d.pct}%`, background: d.isAbs ? 'rgba(217,119,6,.3)' : d.col, borderRadius: 4 }} />
            </div>
            <div style={{ width: 30, textAlign: 'right', fontSize: 10.5, fontWeight: 800, color: d.isAbs ? amb : d.pctCol, flexShrink: 0 }}>
              {d.isAbs ? 'AB' : `${d.pct}%`}
            </div>
            {(opt['Show Obtained Marks'] || opt['Show Total Marks']) && (
              <div style={{ width: 36, textAlign: 'right', fontSize: 10, color: textMut, flexShrink: 0 }}>
                {d.isAbs ? '—' : `${d.obt}/${d.tot}`}
              </div>
            )}
            {opt['Show Grade'] && (
              <div style={{ width: 22, flexShrink: 0, textAlign: 'center' }}>
                {d.g && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', fontSize: 9, fontWeight: 800, background: gcol(d.g) + '15', color: gcol(d.g) }}>
                    {d.g.grade}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Grand total bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', marginTop: 4, borderTop: `1.5px solid ${accentBdr}` }}>
          <div style={{ width: 100, flexShrink: 0, fontSize: 11, fontWeight: 800, color: accent }}>Grand Total</div>
          <div style={{ flex: 1, height: 7, borderRadius: 4, background: '#EFF6FF', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.max(2, Math.round(ovPct))}%`, background: accent, borderRadius: 4 }} />
          </div>
          <div style={{ width: 30, textAlign: 'right', fontSize: 10.5, fontWeight: 800, color: accent, flexShrink: 0 }}>{ovPct}%</div>
          {(opt['Show Obtained Marks'] || opt['Show Total Marks']) && (
            <div style={{ width: 36, textAlign: 'right', fontSize: 10, fontWeight: 700, color: accent, flexShrink: 0 }}>
              {obtAll}/{totalAll}
            </div>
          )}
          {opt['Show Grade'] && <div style={{ width: 22, flexShrink: 0 }} />}
        </div>
      </div>

      {/* Final Remarks */}
      {opt['Show Final Remarks'] && (
        <div style={{ padding: '6px 20px 8px', borderTop: `1px solid ${accentBdr}` }}>
          <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: textMut, marginBottom: 4 }}>Final Remarks</div>
          <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{finalRem.slice(0, 200)}</div>
        </div>
      )}

      {/* Signatures */}
      {(opt['Show Principal Signature'] || opt['Show Parent Signature']) && rsSigs.length > 0 && (
        <div style={{ padding: '10px 20px 12px', borderTop: `1px solid ${accentBdr}`, display: 'flex', gap: 12 }}>
          {rsSigs.map(sig => (
            <div key={sig.id} style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ height: 30, borderBottom: `1px solid ${accentBdr}`, marginBottom: 5 }}>
                {sig.img && <img src={sig.img} alt="" style={{ maxHeight: 28 }} />}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: textMut }}>{sig.name}</div>
              <div style={{ fontSize: 8.5, color: textMut }}>{sig.desig}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '5px 20px', background: accentBg, borderTop: `1px solid ${accentBdr}`, display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 8.5, color: textMut }}>School Mentor ERP · Insight Result Card</div>
        <div style={{ fontSize: 8.5, color: textMut }}>{schoolName}</div>
      </div>
    </div>
  );
}

function PortfolioResultCard({ rcoGeneral, rcoSig, rsSigs, rsAbsentMode, mode = 'single', student, rd: rdProp, ex: exProp }) {
  const opt = {};
  rcoGeneral.forEach(o => { opt[o.label] = o.on; });
  rcoSig.forEach(o => { opt[o.label] = o.on; });

  const st = student || SAMPLE_RC_STUDENT;
  const rd = rdProp  || SAMPLE_RC_RD;
  const ex = exProp  || SAMPLE_RC_EX;
  const isCombined = mode === 'combined';
  const cb = isCombined ? SAMPLE_RC_COMBINED : null;

  const C = {
    p1bg:  'linear-gradient(150deg,#1A0533 0%,#2D1B69 40%,#1A3A5C 100%)',
    p1bar: 'linear-gradient(90deg,#D97706,#F59E0B,#D97706)',
    p2hdr: 'linear-gradient(135deg,#1E3A8A,#1E40AF)',
    acc:   '#D97706', accL: '#FEF3C7', accBdr: 'rgba(217,119,6,.22)',
    blu:   '#1E40AF', bluL: '#EFF6FF', bluBdr: '#BFDBFE',
    pur:   '#7C3AED', purL: '#F5F3FF', purBdr: 'rgba(124,58,237,.22)',
    grn:   '#16A34A', grnL: '#F0FDF4', grnBdr: 'rgba(22,163,74,.22)',
    red:   '#DC2626',
    textP: '#0F172A', textS: '#374151', textM: '#64748B',
    rowA:  '#fff',    rowB:  '#F8FAFF',
    bdr:   '#E2E8F0',
    sigBdr:'#CBD5E1',
    bars:  ['#1E40AF','#16A34A','#D97706','#7C3AED','#DC2626','#0891B2','#EA580C','#059669','#9333EA','#B45309'],
  };

  const today      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';

  const absentSet = {};
  (st.absentSubjects || []).forEach(s => { absentSet[s] = true; });

  const useZeroMode = rsAbsentMode === 'zero';
  const subjects = RES_SUBJECTS.slice(0, 10);
  const totalAll = subjects.reduce((a, s) => (useZeroMode || !absentSet[s]) ? a + (rd.totalMarks[s] ?? 20) : a, 0);
  const obtAll   = subjects.reduce((a, s) => absentSet[s] ? a : a + (st.obtained[s] || 0), 0);
  const ovPct    = isCombined ? cb.ovPct : (totalAll ? Math.min(100, Math.round((obtAll / totalAll) * 10000) / 100) : 0);
  const ovGrade  = rcGetGrade(obtAll, totalAll);
  const finalRem = rcGetFinalRemarks(ovPct);

  const subjData = subjects.map((s, i) => {
    const isAbs = !!absentSet[s];
    const tot = rd.totalMarks[s] ?? 20;
    const obt = isAbs ? 0 : (st.obtained[s] || 0);
    const pct = (!isAbs && tot) ? Math.round((obt / tot) * 100) : 0;
    const g   = (!isAbs && obt > 0) ? rcGetGrade(obt, tot) : null;
    const mc  = isAbs ? 'Absent' : (g ? g.comment : '').slice(0, 28);
    return { s, tot, obt, pct, g, mc, isAbs, col: C.bars[i % C.bars.length] };
  });

  const position = opt['Show Position in Class'] ? '1st' : '—';

  const gCol = g => {
    if (!g) return '#94A3B8';
    const m = { 'A+':'#16A34A','A':'#15803D','B':'#1D4ED8','C':'#B45309','D':'#EA580C','F':'#DC2626' };
    return m[g.grade] || '#475569';
  };

  const sorted = subjData.filter(d => !d.isAbs).sort((a, b) => b.pct - a.pct);
  const strengths    = sorted.slice(0, 3);
  const improvements = sorted.filter(d => d.pct < 80).slice(-3).reverse();

  const tilesEnabled = [];
  if (opt['Show Percentage'])        tilesEnabled.push({ icon: 'fa-chart-line',     label: 'Overall %', val: `${ovPct}%`,         col: C.blu, bg: C.bluL, bdr: C.bluBdr });
  if (opt['Show Grade'] && ovGrade)  tilesEnabled.push({ icon: 'fa-star',           label: 'Grade',     val: ovGrade.grade,       col: C.grn, bg: C.grnL, bdr: C.grnBdr });
  if (opt['Show Position in Class']) tilesEnabled.push({ icon: 'fa-trophy',         label: 'Position',  val: position,            col: C.acc, bg: C.accL, bdr: C.accBdr });
  if (opt['Show Attendance'])        tilesEnabled.push({ icon: 'fa-calendar-check', label: 'Attendance',val: st.attendance || '—',col: C.pur, bg: C.purL, bdr: C.purBdr });

  const initials = st.name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  const span = 1 + (opt['Show Subject-wise Marks'] ? 1 : 0);

  const thBase = { padding: '5px 8px', fontSize: 9, fontWeight: 700, color: C.blu, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: `2px solid ${C.bluBdr}` };
  const thC    = { ...thBase, textAlign: 'center' };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", background: '#fff', width: '100%', maxWidth: 700, margin: '0 auto' }}>
      {/* ── PAGE 1 ── */}
      {/* Cover header */}
      <div style={{ background: C.p1bg, padding: 0, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 220, height: 220, borderRadius: '50%', background: 'rgba(217,119,6,.12)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -20, width: 160, height: 160, borderRadius: '50%', background: 'rgba(6,182,212,.08)' }} />
        <div style={{ position: 'absolute', top: 20, left: '50%', width: 100, height: 100, borderRadius: '50%', background: 'rgba(124,58,237,.06)' }} />

        {/* Brand row */}
        <div style={{ padding: '22px 28px 14px', display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
          {opt['Show School Logo'] && (
            <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, boxShadow: '0 4px 16px rgba(0,0,0,.35)', background: 'linear-gradient(135deg,#D97706,#1E3A8A)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FCD34D' }}>
              <i className="fa-solid fa-graduation-cap" style={{ fontSize: 22 }}></i>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {opt['Show School Name'] && (
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{schoolName}</div>
            )}
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>Academic Portfolio Report &nbsp;·&nbsp; {ex.name}</div>
          </div>
          {ovGrade && (
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.1)', borderRadius: 14, padding: '10px 18px', border: '1px solid rgba(255,255,255,.2)', flexShrink: 0 }}>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#FCD34D' }}>{ovGrade.grade}</div>
              <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'rgba(255,255,255,.55)' }}>Grade</div>
            </div>
          )}
        </div>
        <div style={{ height: 3, background: C.p1bar }} />

        {/* Student banner */}
        <div style={{ padding: '16px 28px 22px', display: 'flex', alignItems: 'center', gap: 18, position: 'relative' }}>
          {opt['Show Student Photo'] && (
            <div style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,.12)', border: '3px solid rgba(255,255,255,.3)', boxShadow: '0 4px 16px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,.85)' }}>
              {initials}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-.02em', marginBottom: 6 }}>{st.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,.75)' }}>
                <i className="fa-solid fa-user" style={{ marginRight: 4, fontSize: 9, color: 'rgba(255,255,255,.5)' }}></i>{st.father}
              </span>
              {opt['Show Student Roll Number'] && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.9)', border: '1px solid rgba(255,255,255,.18)' }}>
                  <i className="fa-solid fa-hashtag" style={{ fontSize: 8.5, marginRight: 3 }}></i>{st.rollNo}
                </span>
              )}
              {opt['Show Class and Section'] && (
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,.12)', color: 'rgba(255,255,255,.9)', border: '1px solid rgba(255,255,255,.18)' }}>
                  <i className="fa-solid fa-chalkboard" style={{ fontSize: 8.5, marginRight: 3 }}></i>{ex.classes[0] || '—'} · A
                </span>
              )}
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{today}</span>
            </div>
          </div>
          {/* Overall % circle */}
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,.1)', border: '3px solid rgba(255,255,255,.25)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{ovPct}%</div>
              <div style={{ fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', letterSpacing: '.3px' }}>Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      {tilesEnabled.length > 0 && (
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.bdr}` }}>
          {tilesEnabled.map((t, i) => (
            <div key={i} style={{ flex: 1, padding: '12px 10px', textAlign: 'center', background: t.bg, borderRight: i < tilesEnabled.length - 1 ? `1px solid ${C.bdr}` : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: t.col + '15', color: t.col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, margin: '0 auto 5px' }}>
                <i className={`fa-solid ${t.icon}`}></i>
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: t.col, lineHeight: 1, marginBottom: 2 }}>{t.val}</div>
              <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.textM }}>{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Subject marks table */}
      <div style={{ padding: '14px 24px 10px' }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: C.textM, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 12, borderRadius: 2, background: C.blu }} />
          SUBJECT-WISE RESULTS
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, border: `1px solid ${C.bluBdr}` }}>
          <thead>
            <tr style={{ background: C.bluL }}>
              <th style={thBase}>#</th>
              {opt['Show Subject-wise Marks'] && <th style={thBase}>Subject</th>}
              {opt['Show Total Marks']        && <th style={thC}>Total</th>}
              {opt['Show Obtained Marks']     && <th style={thC}>Marks</th>}
              {opt['Show Percentage']         && <th style={thC}>%</th>}
              {opt['Show Grade']              && <th style={thC}>Grade</th>}
              <th style={thBase}>Remark</th>
            </tr>
          </thead>
          <tbody>
            {subjData.map((d, i) => {
              const bg = i % 2 === 0 ? C.rowA : C.rowB;
              const absC = '#B45309';
              const absBg = 'rgba(217,119,6,.08)';
              const pctC = d.isAbs ? C.textM : d.pct >= 80 ? C.grn : d.pct >= 60 ? C.acc : C.red;
              const tdBase = { padding: '5px 8px', borderBottom: `1px solid ${C.bdr}` };
              return (
                <tr key={d.s} style={{ background: bg }}>
                  <td style={{ ...tdBase, fontSize: 10.5, fontWeight: 700, color: C.textM }}>{i + 1}</td>
                  {opt['Show Subject-wise Marks'] && (
                    <td style={{ ...tdBase, fontWeight: 600, color: d.isAbs ? absC : C.textP }}>{d.s}</td>
                  )}
                  {opt['Show Total Marks'] && (
                    <td style={{ ...tdBase, textAlign: 'center', color: C.textM }}>{d.isAbs ? '—' : d.tot}</td>
                  )}
                  {opt['Show Obtained Marks'] && (
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      {d.isAbs ? (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 999, background: absBg, color: absC, border: '1px solid rgba(217,119,6,.25)' }}>AB</span>
                      ) : (
                        <strong style={{ color: C.blu }}>{d.obt}</strong>
                      )}
                    </td>
                  )}
                  {opt['Show Percentage'] && (
                    <td style={{ ...tdBase, textAlign: 'center', fontWeight: 700, color: pctC }}>{d.isAbs ? '—' : `${d.pct}%`}</td>
                  )}
                  {opt['Show Grade'] && (
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      {d.g ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: 9.5, fontWeight: 800, background: gCol(d.g) + '18', color: gCol(d.g) }}>{d.g.grade}</span>
                      ) : (
                        <span style={{ color: C.textM }}>—</span>
                      )}
                    </td>
                  )}
                  <td style={{ ...tdBase, fontSize: 10, color: d.isAbs ? absC : C.textM }}>{d.mc}</td>
                </tr>
              );
            })}
            <tr style={{ background: C.bluL }}>
              <td colSpan={span} style={{ padding: '6px 8px', fontSize: 10.5, fontWeight: 800, color: C.blu, borderTop: `2px solid ${C.bluBdr}` }}>Grand Total</td>
              {opt['Show Total Marks']    && <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 800, color: C.blu, borderTop: `2px solid ${C.bluBdr}` }}>{totalAll}</td>}
              {opt['Show Obtained Marks'] && <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 12, fontWeight: 900, color: C.blu, borderTop: `2px solid ${C.bluBdr}` }}>{obtAll}</td>}
              {opt['Show Percentage']     && <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 12, fontWeight: 900, color: C.grn, borderTop: `2px solid ${C.bluBdr}` }}>{ovPct}%</td>}
              {opt['Show Grade']          && <td style={{ padding: '6px 8px', textAlign: 'center', fontSize: 12, fontWeight: 900, color: gCol(ovGrade), borderTop: `2px solid ${C.bluBdr}` }}>{ovGrade ? ovGrade.grade : '—'}</td>}
              <td style={{ borderTop: `2px solid ${C.bluBdr}` }} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Page 1 footer */}
      <div style={{ padding: '6px 24px', background: C.bluL, borderTop: `1px solid ${C.bluBdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 8.5, color: C.textM }}>School Mentor ERP &nbsp;·&nbsp; Portfolio Report</div>
        <div style={{ fontSize: 8.5, color: C.textM }}>Page 1 of 2</div>
      </div>

      {/* ── PAGE 2 ── */}
      <div style={{ background: C.p2hdr, padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-.01em' }}>Performance Analytics</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)', marginTop: 1 }}>{st.name} &nbsp;·&nbsp; {ex.name}</div>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,.5)' }}>{schoolName}</div>
      </div>
      <div style={{ height: 3, background: C.p1bar }} />

      {/* Performance bars */}
      <div style={{ padding: '16px 24px 14px', background: '#fff', borderBottom: `1px solid ${C.bdr}` }}>
        <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: C.textM, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 3, height: 12, borderRadius: 2, background: C.acc }} />
          SUBJECT PERFORMANCE OVERVIEW
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {subjData.map(d => {
            const barW = d.isAbs ? 0 : d.pct;
            const barC = d.isAbs ? 'rgba(217,119,6,.25)' : d.col;
            const lblC = d.isAbs ? '#B45309' : (d.pct >= 80 ? C.grn : d.pct >= 60 ? C.acc : C.red);
            return (
              <div key={d.s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 110, flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: d.isAbs ? '#B45309' : C.textS, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.s}</div>
                <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#EFF6FF', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: barC, borderRadius: 5, position: 'relative' }}>
                    {barW > 5 && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(255,255,255,.25),transparent)', borderRadius: 5 }} />}
                  </div>
                </div>
                {(opt['Show Obtained Marks'] || opt['Show Total Marks']) && (
                  <div style={{ width: 36, textAlign: 'right', fontSize: 9.5, color: C.textM, flexShrink: 0 }}>
                    {d.isAbs ? '—' : `${d.obt}/${d.tot}`}
                  </div>
                )}
                <div style={{ width: 32, textAlign: 'right', fontSize: 10.5, fontWeight: 800, color: lblC, flexShrink: 0 }}>
                  {d.isAbs ? (
                    <span style={{ fontSize: 9, background: 'rgba(217,119,6,.09)', color: '#B45309', padding: '1px 5px', borderRadius: 999, border: '1px solid rgba(217,119,6,.2)' }}>AB</span>
                  ) : `${d.pct}%`}
                </div>
                {opt['Show Grade'] && (
                  <div style={{ width: 24, flexShrink: 0, textAlign: 'center' }}>
                    {d.g && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: '50%', fontSize: 9.5, fontWeight: 800, background: gCol(d.g) + '15', color: gCol(d.g) }}>{d.g.grade}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Grand total bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, paddingTop: 8, borderTop: `2px solid ${C.bluBdr}` }}>
            <div style={{ width: 110, flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: C.blu }}>Grand Total</div>
            <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#EFF6FF', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.max(2, Math.round(ovPct))}%`, background: `linear-gradient(90deg,${C.blu},${C.pur})`, borderRadius: 5 }} />
            </div>
            {(opt['Show Obtained Marks'] || opt['Show Total Marks']) && (
              <div style={{ width: 36, textAlign: 'right', fontSize: 9.5, fontWeight: 700, color: C.blu, flexShrink: 0 }}>{obtAll}/{totalAll}</div>
            )}
            <div style={{ width: 32, textAlign: 'right', fontSize: 11, fontWeight: 900, color: C.grn, flexShrink: 0 }}>{ovPct}%</div>
            {opt['Show Grade'] && <div style={{ width: 24, flexShrink: 0 }} />}
          </div>
        </div>
      </div>

      {/* Combined sub-exam strip */}
      {isCombined && cb && (
        <div style={{ padding: '10px 24px', background: 'rgba(124,58,237,.07)', borderBottom: '1px solid rgba(124,58,237,.2)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: C.pur, flexShrink: 0, marginRight: 4 }}>
            <i className="fa-solid fa-layer-group" style={{ marginRight: 4 }}></i>Sub Exam Breakdown:
          </span>
          {cb.subBreakdown.map((sb, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#fff', color: C.pur, border: '1px solid rgba(124,58,237,.2)', whiteSpace: 'nowrap' }}>
              {sb.name}: {sb.subObt}/{sb.origT} → <strong>{sb.conv}/{sb.weight}</strong>
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: C.grn, whiteSpace: 'nowrap' }}>
            Combined: {cb.grandObt}/{cb.grandTotal} = {cb.ovPct}%
          </span>
        </div>
      )}

      {/* 3-col analysis */}
      <div style={{ display: 'grid', gridTemplateColumns: opt['Show Final Remarks'] ? '1fr 1fr 1fr' : '1fr 1fr', borderBottom: `1px solid ${C.bdr}` }}>
        <div style={{ padding: '16px 20px', borderRight: `1px solid ${C.bdr}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: C.grnL, color: C.grn, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              <i className="fa-solid fa-medal"></i>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.textP }}>Top Subjects</div>
          </div>
          {strengths.map((d, i) => {
            const medals = ['🥇','🥈','🥉'];
            return (
              <div key={d.s} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, padding: '7px 10px', borderRadius: 8, background: C.grnL, border: `1px solid ${C.grnBdr}` }}>
                <div style={{ fontSize: 14, lineHeight: 1 }}>{medals[i] || ''}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textP, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.s}</div>
                  <div style={{ fontSize: 9, color: C.grn, fontWeight: 600, marginTop: 1 }}>{d.g ? `${d.g.grade} · ` : ''}{d.mc || 'Excellent work'}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: C.grn }}>{d.pct}%</div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '16px 20px', borderRight: opt['Show Final Remarks'] ? `1px solid ${C.bdr}` : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: C.accL, color: C.acc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
              <i className="fa-solid fa-bullseye"></i>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: C.textP }}>Needs Attention</div>
          </div>
          {improvements.length > 0 ? improvements.map(d => (
            <div key={d.s} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9, padding: '7px 10px', borderRadius: 8, background: C.accL, border: `1px solid ${C.accBdr}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: C.acc + '18', color: C.acc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{d.pct}%</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textP, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.s}</div>
                <div style={{ fontSize: 9, color: C.acc, fontWeight: 600, marginTop: 1 }}>Focus and improve</div>
              </div>
            </div>
          )) : (
            <div style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🌟</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.grn }}>Excellent!</div>
              <div style={{ fontSize: 10, color: C.textM, marginTop: 2 }}>All subjects above 80%</div>
            </div>
          )}
        </div>

        {opt['Show Final Remarks'] && (
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: C.purL, color: C.pur, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                <i className="fa-solid fa-quote-left"></i>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.textP }}>Final Remarks</div>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 8, background: C.purL, border: `1px solid ${C.purBdr}` }}>
              <div style={{ fontSize: 10.5, color: C.textS, lineHeight: 1.65, fontStyle: 'italic' }}>“{finalRem.slice(0, 200)}”</div>
            </div>
          </div>
        )}
      </div>

      {/* Signatures */}
      {(opt['Show Principal Signature'] || opt['Show Parent Signature']) && rsSigs.length > 0 && (
        <div style={{ padding: '14px 24px 16px', display: 'flex', gap: 16, borderBottom: `1px solid ${C.bdr}` }}>
          {rsSigs.map(sig => (
            <div key={sig.id} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 32, borderBottom: `1.5px solid ${C.sigBdr}`, marginBottom: 5 }}>
                {sig.img && <img src={sig.img} alt="" style={{ maxHeight: 30 }} />}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textM }}>{sig.name}</div>
              <div style={{ fontSize: 8.5, color: C.textM }}>{sig.desig}</div>
            </div>
          ))}
        </div>
      )}

      {/* Page 2 footer */}
      <div style={{ padding: '8px 24px', background: '#1A0533', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.45)' }}>School Mentor ERP &nbsp;·&nbsp; Portfolio Report</div>
        <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.45)' }}>Page 2 of 2 &nbsp;·&nbsp; {schoolName}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SINGLE ASSESSMENT — UPDATE MARKS MODAL
   ═══════════════════════════════════════════════════════════════════ */
function ResultUpdateMarksModal({ cd, student, onSave, onClose, absentMode, toast, subjects = [] }) {
  const [obtained, setObtained] = useState(() => ({ ...(student.obtained || {}) }));
  const [manualRemarks, setManualRemarks] = useState(() => ({ ...(student.manualRemarks || {}) }));
  const [absent, setAbsent] = useState(!!student.absent);
  const [tab, setTab] = useState(0);

  const updateObt = (subject, val) => {
    setObtained(o => ({ ...o, [subject]: val === '' ? 0 : Math.max(0, Math.min(cd.totalMarks[subject] || 0, parseFloat(val) || 0)) }));
  };
  const updateMc = (subject, val) => {
    setManualRemarks(o => ({ ...o, [subject]: val }));
  };

  const onAbsentToggle = e => {
    const checked = e.target.checked;
    setAbsent(checked);
    if (checked) {
      const zeros = {};
      subjects.forEach(s => { zeros[s] = 0; });
      setObtained(zeros);
    }
  };

  const computePayload = () => {
    const absSet = {};
    (student.absentSubjects || []).forEach(s => { absSet[s] = true; });
    const tot = absent
      ? Object.values(cd.totalMarks).reduce((a, b) => a + b, 0)
      : (absentMode === 'zero'
          ? Object.values(cd.totalMarks).reduce((a, b) => a + b, 0)
          : RES_SUBJECTS.reduce((a, s) => absSet[s] ? a : a + (cd.totalMarks[s] || 0), 0));
    const obt = absent ? 0 : RES_SUBJECTS.reduce((a, s) => a + (absSet[s] ? 0 : (obtained[s] || 0)), 0);
    const pct = tot ? (obt / tot) * 100 : 0;
    return {
      obtained,
      manualRemarks,
      absent,
      finalRemarks: rcGetFinalRemarks(pct),
    };
  };

 const saveAndNext = () => {
  toast(`Saved subject ${tab + 1}`, 'info');
  setTab(t => (t + 1) % (subjects.length || 1));
};
  const saveAndClose = () => onSave(computePayload());

const curSubjObj = subjects[tab] || {};
const curSubj    = curSubjObj.subjectName || '';
  const curTotal = cd.totalMarks[curSubj] || 0;
  const curObt   = obtained[curSubj] || 0;
  const curPct   = curTotal ? Math.round((curObt / curTotal) * 100) : 0;
  const curGrade = rcGetGrade(curObt, curTotal);

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9400, background: 'rgba(10,22,40,.58)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="exam-modal" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-pen-ruler"></i></div>
            <div>
              <div className="exam-modal-title">Update Result</div>
              <div className="exam-modal-sub">{student.name} · {student.father}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="exam-modal-body" style={{ paddingTop: 18, overflowY: 'auto' }}>
          {/* Subject tabs */}
          <div className="syl-subj-tabs">
            {subjects.map((s, i) => (
              <button
                key={s}
    className={`syl-subj-tab${tab === i ? ' active' : ''}`}
                onClick={() => setTab(i)}
              >
      {s.subjectName}
              </button>
            ))}
          </div>

          {/* Absent toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', marginBottom: 14, border: '1px solid var(--border-light)' }}>
            <i className="fa-solid fa-user-xmark" style={{ color: '#D97706', fontSize: 16 }}></i>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>Mark Student as Absent</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>If absent, all marks will be set to 0</div>
            </div>
            <label className="res-toggle-wrap">
              <input type="checkbox" checked={absent} onChange={onAbsentToggle} />
              <span className="res-toggle-slider"></span>
            </label>
          </div>

          {/* Active subject panel */}
          <div style={{ opacity: absent ? .35 : 1, pointerEvents: absent ? 'none' : 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {curSubj} — {student.name}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Total Marks</label>
                <input className="rs-input" type="number" value={curTotal} readOnly style={{ background: 'var(--bg-muted)' }} />
              </div>
              <div>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Obtained Marks</label>
                <input
                  className="rs-input"
                  type="number"
                  value={curObt}
                  min={0}
                  max={curTotal}
                  onChange={e => updateObt(curSubj, e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: 3 }}>Percentage</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1E40AF' }}>{curTotal ? `${curPct}%` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: 3 }}>Grade</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: curGrade ? (RS_GRADE_COLORS[curGrade.grade] || '#16A34A') : 'var(--text-muted)' }}>
                  {curGrade ? curGrade.grade : '—'}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)', marginBottom: 3 }}>Auto Comment</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{curGrade ? curGrade.comment : '—'}</div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Manual Comment (optional)</label>
              <input
                className="rs-input"
                type="text"
                value={manualRemarks[curSubj] || ''}
                onChange={e => updateMc(curSubj, e.target.value)}
                placeholder="Override auto comment..."
              />
            </div>
          </div>
        </div>

        <div className="exam-modal-footer">
          <Tooltip text="Close"><button className="exam-cancel-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i> Close</button></Tooltip>
          <Tooltip text="Save and move to the next subject">
            <button
              className="exam-cancel-btn"
              style={{ borderColor: '#1E40AF', color: '#1E40AF' }}
              onClick={saveAndNext}
            >
              <i className="fa-solid fa-arrow-right"></i> Next Subject
            </button>
          </Tooltip>
          <Tooltip text="Save and close"><button className="exam-submit-btn" onClick={saveAndClose}><i className="fa-solid fa-check"></i> Save &amp; Close</button></Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SINGLE ASSESSMENT — RESULT CARD VIEWER (with PDF print)
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   SINGLE ASSESSMENT — FINAL REMARKS MODAL
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   COMBINED ASSESSMENT — CREATE NEW MODAL
   ═══════════════════════════════════════════════════════════════════ */
function CbrCreateModal({ exams, onClose, onCreate, toast }) {
  const [name, setName]             = useState('');
  const [mainId, setMainId]         = useState(null);
  const [subIds, setSubIds]         = useState([]);
  const [weights, setWeights]       = useState({});
  const [fetched, setFetched]       = useState(false);
  const [commonClasses, setCommonClasses] = useState([]);
  const [classes, setClasses]       = useState([]);
  const [errorMsg, setErrorMsg]     = useState('');

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const subList = exams.filter(e => e.id !== mainId);

  const pickMain = id => {
    setMainId(id);
    setSubIds([]);
    setWeights({});
    setFetched(false);
    setCommonClasses([]);
    setClasses([]);
    setErrorMsg('');
  };

  const toggleSub = id => {
    setSubIds(prev => {
      const idx = prev.indexOf(id);
      if (idx > -1) {
        const next = [...prev]; next.splice(idx, 1);
        setWeights(w => { const n = { ...w }; delete n[id]; return n; });
        return next;
      }
      setWeights(w => ({ ...w, [id]: w[id] ?? 20 }));
      return [...prev, id];
    });
    setFetched(false);
    setCommonClasses([]);
    setClasses([]);
    setErrorMsg('');
  };

  const updateWeight = (id, val) => {
    const w = Math.max(1, parseFloat(val) || 1);
    setWeights(prev => ({ ...prev, [id]: w }));
  };

  const fetch = () => {
    if (!mainId || !subIds.length) return;
    const mainEx = exams.find(e => e.id === mainId);
    if (!mainEx || !mainEx.classes?.length) {
      setErrorMsg('No classes assigned to this exam.');
      return;
    }
    const common = mainEx.classes.filter(cls =>
      subIds.every(sid => {
        const se = exams.find(e => e.id === sid);
        return se && se.classes && se.classes.indexOf(cls) > -1;
      })
    );
    if (!common.length) {
      setErrorMsg('No common classes found between main and sub exams.');
      setFetched(false);
      setCommonClasses([]);
      setClasses([]);
      return;
    }
    setErrorMsg('');
    setFetched(true);
    setCommonClasses(common);
    setClasses(common.slice()); // pre-select all
  };

  const toggleClass = cls => {
    setClasses(prev => prev.indexOf(cls) > -1 ? prev.filter(c => c !== cls) : [...prev, cls]);
  };

  const canCreate = !!mainId && subIds.length > 0 && fetched && classes.length > 0;

  let hint = 'Select a Main Exam to continue';
  let hintColor = 'var(--text-muted)';
  if (errorMsg) {
    hint = errorMsg;
    hintColor = '#DC2626';
  } else if (!mainId) {
    hint = 'Select a Main Exam to continue';
  } else if (!subIds.length) {
    hint = 'Now select one or more Sub Exams';
  } else if (!fetched) {
    hint = 'Set weightage for each sub exam, then click Fetch Classes';
  } else if (!classes.length) {
    hint = 'Select at least one class';
    hintColor = '#D97706';
  } else {
    hint = `${classes.length} class${classes.length > 1 ? 'es' : ''} selected · Ready to create`;
    hintColor = '#16A34A';
  }

  const handleCreate = () => {
    if (!canCreate) return;
    const mainEx = exams.find(e => e.id === mainId);
    const subExs = subIds.map(sid => exams.find(e => e.id === sid)).filter(Boolean);
    const subNames = subExs.map(s => s.name);
    const today = new Date();
    const pad = n => (n < 10 ? '0' : '') + n;
    const dateStr = `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
    const resultBaseName = (name || '').trim() || 'Combined Result';

    const results = classes.map((cls, ci) => {
      // Build students for this class using SA samples
      const classStudents = RES_SAMPLE_STUDENTS.map(st => {
        const absSet = {};
        (st.absentSubjects || []).forEach(s => { absSet[s] = true; });
        const mainTotal = RES_SUBJECTS.reduce(a => a + 20, 0);
        const mainObt   = RES_SUBJECTS.reduce((a, s) => absSet[s] ? a : a + (st.obtained[s] || 0), 0);
        let sumWt = 0;
        let sumConv = 0;
        const subs = subExs.map(sex => {
          const wt    = weights[sex.id] || 20;
          const origT = 100;
          const subObt = Math.round(Math.random() * 60) + 30;
          const conv  = Math.min(wt, Math.round((subObt / origT) * wt * 100) / 100);
          sumWt   += wt;
          sumConv += conv;
          return { name: sex.name, origT, subObt, weight: wt, conv };
        });
        const grandTotal = mainTotal + sumWt;
        const grandObt   = Math.round((mainObt + sumConv) * 100) / 100;
        const pct        = grandTotal ? Math.min(100, Math.round((grandObt / grandTotal) * 10000) / 100) : 0;
        const g          = rcGetGrade(grandObt, grandTotal);
        return {
          name: st.name, father: st.father, rollNo: st.rollNo,
          mainObt, mainTotal,
          subs, grandTotal, grandObt, pct,
          grade: g ? g.grade : 'F',
          rank: '—',
        };
      });
      // Rank within this class
      const sorted = [...classStudents].sort((a, b) => b.grandObt - a.grandObt);
      classStudents.forEach(s => {
        const r = sorted.findIndex(x => x.rollNo === s.rollNo) + 1;
        const sfx = r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
        s.rank = `${r}${sfx}`;
      });
      const weightsCopy = { ...weights };
      return {
        id: `cbr_${Date.now()}_${ci}`,
        name: `${resultBaseName} — ${cls}`,
        mainExam: mainEx?.name || '',
        subExams: subNames,
        cls, section: 'A',
        created: dateStr,
        published: false,
        weights: weightsCopy,
        students: classStudents,
      };
    });

    onCreate(results.reverse());
  };

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9800, background: 'rgba(10,22,40,.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 700, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,.35)', animation: 'fadeSlide .22s ease', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#1E40AF,#7C3AED)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              <i className="fa-solid fa-layer-group"></i>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>Create Combined Result</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>Set up a new combined assessment</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          {/* Info banner */}
          <div style={{ display: 'flex', gap: 10, padding: '11px 14px', background: 'rgba(30,64,175,.08)', border: '1px solid rgba(30,64,175,.2)', borderRadius: 10, marginBottom: 20 }}>
            <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF', fontSize: 13, marginTop: 1, flexShrink: 0 }}></i>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              Select a <strong>Main Exam</strong> and one or more <strong>Sub Exams</strong>. Click <strong>Fetch Classes</strong> to load matching classes, select your classes, then click <strong>Create Combined Result</strong>.
            </div>
          </div>

          {/* Result Name */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 7 }}>
              <i className="fa-solid fa-tag" style={{ color: '#1E40AF', marginRight: 5 }}></i>Combined Result Name
            </label>
            <input
              className="rs-input"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Mid + Final Combined Result"
              style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}
            />
          </div>

          {/* Main Exam */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-book-open" style={{ color: '#1E40AF' }}></i>Main Exam
              <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {exams.map(ex => (
                <button
                  key={ex.id}
                  type="button"
                  className={`ds-exam-btn${mainId === ex.id ? ' active' : ''}`}
                  onClick={() => pickMain(ex.id)}
                >
                  <i className="fa-solid fa-book-open" style={{ fontSize: 10 }}></i> {ex.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sub Exams */}
          {mainId && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-layer-group" style={{ color: '#7C3AED' }}></i>Sub Exams
                <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 4, color: 'var(--text-muted)' }}>(select one or more)</span>
                <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {subList.map(ex => {
                  const sel = subIds.indexOf(ex.id) > -1;
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => toggleSub(ex.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7,
                        padding: '8px 16px', borderRadius: 999,
                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit', transition: '.18s',
                        background: sel ? 'rgba(124,58,237,.12)' : 'var(--bg-card)',
                        border: sel ? '2px solid #7C3AED' : '1.5px solid var(--border-light)',
                        color: sel ? '#7C3AED' : 'var(--text-secondary)',
                      }}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: 4,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10,
                        background: sel ? '#7C3AED' : 'var(--border-light)',
                        color: sel ? '#fff' : 'var(--text-muted)',
                      }}>
                        <i className={`fa-solid ${sel ? 'fa-check' : 'fa-plus'}`}></i>
                      </span>
                      {ex.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weightage Setup */}
          {subIds.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-sliders" style={{ color: '#7C3AED' }}></i>Sub Exam Weightage
                <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></span>
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <i className="fa-solid fa-circle-info" style={{ color: '#7C3AED', marginRight: 5 }}></i>
                  Set how many marks each sub exam is worth in the combined result. Formula: <strong>Student Marks ÷ Original Total × Weightage</strong>. E.g. 80÷100×20 = 16 marks.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subIds.map(sid => {
                  const ex = exams.find(e => e.id === sid);
                  if (!ex) return null;
                  const wt = weights[sid] ?? 20;
                  const origT = 100;
                  const convEx = Math.round((80 / origT) * wt * 10) / 10;
                  return (
                    <div key={sid} style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-light)', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{ex.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Original Total Marks: <strong>{origT}</strong></div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'rgba(124,58,237,.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,.2)' }}>Sub Exam</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 120 }}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                            Combined Weightage (marks)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={origT}
                            value={wt}
                            onChange={e => updateWeight(sid, e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }}
                          />
                        </div>
                        <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(30,64,175,.08)', border: '1px solid #1E40AF', textAlign: 'center', flexShrink: 0, minWidth: 108 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: '#1E40AF', marginBottom: 3 }}>Live Example</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF' }}>80 ÷ {origT} × {wt} = <strong>{convEx}</strong></div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>if scored 80 / {origT}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fetch Classes */}
          {subIds.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <button
                type="button"
                onClick={fetch}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 26px', borderRadius: 10, background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(30,64,175,.25)', transition: '.2s' }}
              >
                <i className="fa-solid fa-bolt"></i> Fetch Classes
              </button>
            </div>
          )}

          {/* Class selection */}
          {fetched && commonClasses.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="fa-solid fa-users" style={{ color: '#1E40AF' }}></i>Select Classes
                <span style={{ flex: 1, height: 1, background: 'var(--border-light)' }}></span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {commonClasses.map(cls => {
                  const sel = classes.indexOf(cls) > -1;
                  return (
                    <label
                      key={cls}
                      onClick={() => toggleClass(cls)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                        background: sel ? 'rgba(30,64,175,.1)' : 'var(--bg-card)',
                        border: sel ? '1.5px solid #1E40AF' : '1.5px solid var(--border-light)',
                        color: sel ? '#1E40AF' : 'var(--text-secondary)',
                        fontSize: 12.5, fontWeight: 600, userSelect: 'none', transition: '.18s',
                      }}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: 5,
                        background: sel ? '#1E40AF' : 'var(--border-light)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {sel && <i className="fa-solid fa-check" style={{ fontSize: 9, color: '#fff' }}></i>}
                      </span>
                      {cls}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-muted)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 11.5, color: hintColor, lineHeight: 1.4 }}>{hint}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 22px', borderRadius: 10, border: '1.5px solid var(--border-light)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              style={{
                padding: '9px 24px', borderRadius: 10, border: 'none',
                background: canCreate ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : '#E2E8F0',
                color: canCreate ? '#fff' : '#94A3B8',
                fontSize: 13, fontWeight: 700,
                cursor: canCreate ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: canCreate ? '0 2px 10px rgba(30,64,175,.25)' : 'none',
                transition: '.2s',
              }}
            >
              <i className="fa-solid fa-circle-plus"></i> Create Combined Result
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ResultRemarksModal({ cd, student, absentMode, onSave, onClose }) {
  const absSet = {};
  (student.absentSubjects || []).forEach(s => { absSet[s] = true; });
  const totalAll = absentMode === 'zero'
    ? Object.values(cd.totalMarks).reduce((a, b) => a + b, 0)
    : RES_SUBJECTS.reduce((a, s) => absSet[s] ? a : a + (cd.totalMarks[s] || 0), 0);
  const obtAll = RES_SUBJECTS.reduce((a, s) => a + (absSet[s] ? 0 : (student.obtained[s] || 0)), 0);
  const ovPct  = totalAll ? Math.round((obtAll / totalAll) * 10000) / 100 : 0;
  const autoRem = rcGetFinalRemarks(ovPct);

  const [text, setText] = useState(student.finalRemarks || autoRem);
  const MAX = 200;

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9400, background: 'rgba(10,22,40,.58)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="exam-modal" style={{ maxWidth: 660, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-comment-dots"></i></div>
            <div>
              <div className="exam-modal-title">Final Remarks</div>
              <div className="exam-modal-sub">{student.name}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="exam-modal-body" style={{ paddingTop: 18, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(30,64,175,.06)', border: '1px solid rgba(30,64,175,.18)', borderRadius: 'var(--radius-md)', marginBottom: 14, color: '#1E3A8A' }}>
            <i className="fa-solid fa-circle-info" style={{ color: '#1E40AF' }}></i>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Overall: <strong>{obtAll}/{totalAll}</strong> = <strong style={{ color: '#1E40AF' }}>{ovPct}%</strong>
              {!student.manualFinalRemarks && <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>— Auto remark applied below</span>}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)' }}>#</th>
                <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)' }}>Student Name</th>
                <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)' }}>Father Name</th>
                <th style={{ padding: '9px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'left', textTransform: 'uppercase', borderBottom: '1px solid var(--border-light)' }}>Overall Remarks</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>1</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)', verticalAlign: 'top' }}>{student.name}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>{student.father}</td>
                <td style={{ padding: '10px 12px' }}>
                  <textarea
                    rows={3}
                    maxLength={MAX}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Final remarks — max 200 characters"
                    style={{ width: '100%', border: '1.5px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', fontFamily: 'inherit', fontSize: 12.5, resize: 'vertical', outline: 'none', background: 'var(--input-bg, var(--bg-card))', color: 'var(--text-primary)' }}
                  />
                  <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                    {text.length}/{MAX} chars
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="exam-modal-footer">
          <Tooltip text="Close"><button className="exam-cancel-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i> Close</button></Tooltip>
          <Tooltip text="Save remark and close">
            <button className="exam-submit-btn" onClick={() => onSave(text.slice(0, MAX))}>
              <i className="fa-solid fa-check"></i> Save &amp; Close
            </button>
          </Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SINGLE ASSESSMENT — TOTAL MARKS EDIT MODAL
   ═══════════════════════════════════════════════════════════════════ */
function ResultTotalMarksModal({ cd, className, onSave, onClose , subjects , resTotalMarksCtx, selectedTermId }) {

const [totals, setTotals] = useState({});
useEffect(() => {
  const initialTotals = {};

  subjects.forEach(subject => {
    initialTotals[subject.subjectName] = Number(subject.totalMarks || 0);
  });

  setTotals(initialTotals);

  console.log("subjects =", subjects);
  console.log("initialTotals =", initialTotals);
}, [subjects]);
  const upd = (subject, val) => {
    const n = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setTotals(t => ({ ...t, [subject]: n }));
  };

 const applyAll = val => {
  const n = Math.max(0, parseFloat(val) || 0);

  const next = {};

  subjects.forEach(subject => {
    next[subject.subjectName] = n;
  });

  setTotals(next);
};
const save = async () => {
  try {
    const token = sessionStorage.getItem("token");
    const branchID = sessionStorage.getItem("branchID");

    const results = [];

    for (const subject of subjects) {
      const total =
        totals[subject.subjectName] === "" ||
        totals[subject.subjectName] == null
          ? 0
          : Number(totals[subject.subjectName]);

      const hasExisting =
        subject.id && Number(subject.id) > 0;

      const payload = {
        id: hasExisting ? Number(subject.id) : 0,
        subjectID: Number(subject.subjectID),
        totalMarks: String(total),
        branchID: String(branchID),
        classID: Number(resTotalMarksCtx?.classID || 0),
        termID: Number(selectedTermId || 0),
        examID: Number(
          resTotalMarksCtx?.selectExam ||
          resTotalMarksCtx?.examId ||
          0
        ),
        sectionID: Number(resTotalMarksCtx?.sectionID || 0),
        subjectName: "",
        termName: "",
        examName: "",
        totalMarksSum: "",
        action: hasExisting ? "update" : "insert"
      };

      console.log("Sending payload:", payload);

      const response = await fetch(
        buildUrl("/api/sasubjectcrud"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", errorText);
        throw new Error(errorText);
      }

      const data = await response.json();
      results.push(data);
    }

    // Parent refresh callback
    onSave?.(results);

    // Modal close
    onClose?.();

  } catch (error) {
    console.error("Save error:", error);
  }
};
  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9400, background: 'rgba(10,22,40,.58)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div className="exam-modal" style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-calculator"></i></div>
            <div>
              <div className="exam-modal-title">Edit Total Marks</div>
              <div className="exam-modal-sub">{className} — set per-subject total marks</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="exam-modal-body" style={{ paddingTop: 18, overflowY: 'auto' }}>
          {/* Apply to all helper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-muted)', borderRadius: 'var(--radius-md)', marginBottom: 14, border: '1px solid var(--border-light)' }}>
            <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#1E40AF', fontSize: 14 }}></i>
            <div style={{ flex: 1, fontSize: 11.5, color: 'var(--text-secondary)' }}>
              Apply same total to all subjects
            </div>
            <input
              className="rs-input"
              type="number"
              min={0}
              placeholder="e.g. 20"
              style={{ width: 100 }}
              onKeyDown={e => { if (e.key === 'Enter') applyAll(e.currentTarget.value); }}
              onBlur={e => { if (e.target.value) applyAll(e.target.value); }}
            />
          </div>

          {/* Per-subject rows */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
  {subjects.map(subject => (
    <div
      key={subject.subjectID}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        borderRadius: 8
      }}
    >
      <div
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: 600
        }}
      >
        {subject.subjectName}
      </div>
<input
  className="rs-input"
  type="number"
  min={0}
  value={totals[subject.subjectName] ?? ''}
  onChange={e => upd(subject.subjectName, e.target.value)}
  style={{ width: 80, textAlign: 'center' }}
/>
    </div>
  ))}
</div>
        </div>

        <div className="exam-modal-footer">
          <Tooltip text="Cancel and close"><button className="exam-cancel-btn" onClick={onClose}><i className="fa-solid fa-xmark"></i> Cancel</button></Tooltip>
          <Tooltip text="Save Totals"><button className="exam-submit-btn" onClick={save}><i className="fa-solid fa-floppy-disk"></i> Save Totals</button></Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SINGLE ASSESSMENT — CLASS RESULT REPORT PICKER + BUILDER
   ═══════════════════════════════════════════════════════════════════ */
function ClassReportPicker({ cd, ex, className, term, absentMode, onClose, toast }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');

  const generate = () => {
    if (format === 'word') {
      toast('Word export coming soon', 'info');
    } else {
      generateClassResultReport({ cd, ex, className, term, absentMode }, style === 'color');
    }
    onClose();
  };

  return createPortal(
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title">Download Class Result</div>
              <div className="rp-sub">{className} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips">
                    <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Full color with brand palette, highlights &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('bw'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips-bw">
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Printer-friendly grayscale, no background fills</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row">
            <button className={`rp-format-pill${format === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFormat('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${format === 'word' ? ' selected-word' : ''}`} onClick={() => setFormat('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Generate and download the report"><button className="rp-btn go" onClick={generate}><i className="fa-solid fa-download"></i><span>Download {style === 'color' ? 'Colorful' : 'Colorless'} {format === 'pdf' ? 'PDF' : 'Word'}</span></button></Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

function generateClassResultReport({ cd, ex, className, term, absentMode }, isColor) {
  const aColor = isColor ? '#1E40AF' : '#374151';
  const aBg    = isColor ? '#EFF6FF' : '#F5F5F5';
  const aBdr   = isColor ? '#BFDBFE' : '#DDD';
  const tMuted = isColor ? '#64748B' : '#666';
  const rowEv  = isColor ? '#F8FAFF' : '#F7F7F7';
  const hBg    = isColor
    ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%)'
    : '#FFFFFF';
  const successCol = isColor ? '#16A34A' : '#000';
  const warnCol    = isColor ? '#D97706' : '#000';
  const today      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';

  // Compute each student's totals + ranking
  const useZero = absentMode === 'zero';
  const students = cd.students.map(st => {
    const absSet = {};
    (st.absentSubjects || []).forEach(s => { absSet[s] = true; });
    const tot = st.absent
      ? Object.values(cd.totalMarks).reduce((a, b) => a + b, 0)
      : (useZero
          ? Object.values(cd.totalMarks).reduce((a, b) => a + b, 0)
          : RES_SUBJECTS.reduce((a, s) => absSet[s] ? a : a + (cd.totalMarks[s] || 0), 0));
    const obt = st.absent ? 0 : RES_SUBJECTS.reduce((a, s) => a + (absSet[s] ? 0 : (st.obtained[s] || 0)), 0);
    const pct = tot && !st.absent ? Math.round((obt / tot) * 10000) / 100 : 0;
    const grade = (!st.absent && obt > 0) ? rcGetGrade(obt, tot) : null;
    return { st, tot, obt, pct, grade };
  });

  const ranked = [...students].filter(r => !r.st.absent).sort((a, b) => b.obt - a.obt);
  const rankMap = new Map();
  ranked.forEach((r, i) => { rankMap.set(r.st.id, i + 1); });

  const totalSum  = students.reduce((a, r) => a + r.tot, 0);
  const obtSum    = students.reduce((a, r) => a + r.obt, 0);
  const avgPct    = totalSum ? Math.round((obtSum / totalSum) * 100 * 100) / 100 : 0;
  const highest   = ranked[0];
  const lowest    = ranked.length ? ranked[ranked.length - 1] : null;
  const completeCount = students.filter(r => {
    if (r.st.absent) return false;
    return RES_SUBJECTS.every(s => r.st.obtained[s] > 0);
  }).length;

  const gradeColor = g => {
    if (!isColor || !g) return tMuted;
    return g.grade === 'A+' ? '#16A34A'
         : g.grade === 'A'  ? '#15803D'
         : g.grade === 'B'  ? '#1D4ED8'
         : g.grade === 'C'  ? '#B45309'
         : g.grade === 'D'  ? '#EA580C'
         : g.grade === 'F'  ? '#DC2626'
         : '#475569';
  };

  const rowsHtml = students.map((r, i) => {
    const rank = rankMap.get(r.st.id);
    const rankSfx = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
    const rankStr = r.st.absent ? '—' : (rank ? `${rank}${rankSfx}` : '—');
    const bg = i % 2 === 0 ? '#fff' : rowEv;
    const grCol = gradeColor(r.grade);
    const tdBase = `padding:7px 9px;border-bottom:1px solid ${aBdr};font-size:11px;color:#0F172A`;
    const tdC    = tdBase + ';text-align:center';
    return `
      <tr style="background:${bg}${r.st.absent ? ';opacity:.78' : ''}">
        <td style="${tdBase};color:${tMuted};font-weight:700">${i + 1}</td>
        <td style="${tdBase};color:${tMuted};white-space:nowrap">${r.st.rollNo || '—'}</td>
        <td style="${tdBase};font-weight:700">${r.st.name}</td>
        <td style="${tdBase};color:${tMuted}">${r.st.father || '—'}</td>
        <td style="${tdC};font-weight:600">${r.tot || '—'}</td>
        <td style="${tdC}">${r.st.absent
          ? `<span style="display:inline-block;padding:1px 8px;border-radius:999px;background:${isColor ? 'rgba(217,119,6,.1)' : '#F5F5F5'};color:${warnCol};border:1px solid ${isColor ? 'rgba(217,119,6,.25)' : '#CCC'};font-size:10px;font-weight:700">AB</span>`
          : `<strong style="color:${aColor}">${r.obt}</strong>`}</td>
        <td style="${tdC};font-weight:700;color:${r.st.absent ? tMuted : (r.pct >= 80 ? successCol : r.pct >= 60 ? warnCol : (isColor ? '#DC2626' : '#000'))}">${r.st.absent ? '—' : `${r.pct}%`}</td>
        <td style="${tdC}">${r.grade
          ? `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;padding:2px 7px;border-radius:6px;background:${grCol};color:#fff;font-size:10.5px;font-weight:800">${r.grade.grade}</span>`
          : `<span style="color:${tMuted};font-size:10.5px">${r.st.absent ? 'Absent' : '—'}</span>`}</td>
        <td style="${tdC};font-weight:700;color:${aColor}">${rankStr}</td>
      </tr>`;
  }).join('');

  const reportHTML = `
    <div class="page-wrap" style="font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A">
      <!-- Header -->
      <div class="${isColor ? '' : 'cl-doc-header'}" style="background:${hBg};color:${isColor ? '#fff' : '#0F172A'};border-radius:0 0 14px 14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          <div style="width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.25)">🎓</div>
          <div style="min-width:0">
            <div style="font-size:17px;font-weight:800">${schoolName}</div>
            <div style="font-size:10.5px;opacity:.75;margin-top:2px">Academic Year 2026–2027</div>
          </div>
        </div>
        <div style="text-align:right;min-width:0">
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9)">Class Result Report</div>
          <div style="font-size:10.5px;color:rgba(255,255,255,.65);margin-top:3px">${ex.name} · ${term} Term · ${today}</div>
        </div>
      </div>

      <!-- Meta strip -->
      <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid ${aBdr}">
        ${[
          ['Term',     term],
          ['Exam',     ex.name],
          ['Class',    `${className} · Section A`],
          ['Students', String(students.length)],
          ['Released', cd.released ? 'Yes' : 'No'],
        ].map(([k, v]) => `
          <div style="flex:1;min-width:130px;padding:10px 16px;border-right:1px solid ${aBdr};overflow-wrap:anywhere">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${tMuted};margin-bottom:2px">${k}</div>
            <div style="font-size:12.5px;font-weight:800;color:${aColor}">${v}</div>
          </div>
        `).join('')}
      </div>

      <!-- Summary stats -->
      <div style="display:flex;gap:0;border-bottom:1px solid ${aBdr};background:${aBg}">
        ${[
          { label: 'Class Average', val: `${avgPct}%`,                              col: aColor },
          { label: 'Highest',       val: highest ? `${highest.pct}%` : '—',         col: successCol, sub: highest ? highest.st.name : '' },
          { label: 'Lowest',        val: lowest ? `${lowest.pct}%` : '—',           col: warnCol,    sub: lowest ? lowest.st.name : '' },
          { label: 'Completed',     val: `${completeCount}/${students.length}`,     col: aColor },
        ].map((tile, i, arr) => `
          <div style="flex:1;padding:11px 14px;text-align:center;border-right:${i < arr.length - 1 ? '1px solid ' + aBdr : 'none'}">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${tMuted};margin-bottom:3px">${tile.label}</div>
            <div style="font-size:16px;font-weight:900;color:${tile.col}">${tile.val}</div>
            ${tile.sub ? `<div style="font-size:9.5px;color:${tMuted};margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tile.sub}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Main table -->
      <div style="padding:14px 16px 8px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${tMuted};margin-bottom:8px;display:flex;align-items:center;gap:8px">
          <div style="width:3px;height:13px;border-radius:2px;background:${aColor}"></div>STUDENT RESULTS
        </div>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;border:1px solid ${aBdr};font-size:11px">
          <colgroup>
            <col style="width:32px"><col style="width:78px"><col><col><col style="width:50px"><col style="width:62px"><col style="width:52px"><col style="width:46px"><col style="width:46px">
          </colgroup>
          <thead>
            <tr style="background:${aBg}">
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">#</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Roll No</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Student Name</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Father Name</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Total</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Obtained</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">%</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Grade</th>
              <th style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Pos.</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || `<tr><td colspan="9" style="padding:18px;text-align:center;color:${tMuted}">No students in this class</td></tr>`}</tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="padding:10px 16px;background:${aBg};border-top:1px solid ${aBdr};display:flex;justify-content:space-between;font-size:10px;color:${tMuted};flex-wrap:wrap;gap:6px">
        <span>School Mentor ERP · Single Assessment</span>
        <span>Confidential · ${schoolName}</span>
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Class Result — ${className} · ${ex.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;overflow-x:hidden}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;font-size:12px}
@page{size:A4 portrait;margin:15mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
}
.page-wrap{width:100%;max-width:210mm;margin:0 auto;padding:0;overflow:hidden}
table{width:100%;table-layout:fixed}
td,th{overflow-wrap:anywhere;word-break:break-word}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
/* Colorless overrides — recolor white text + decorative fills on the header. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
</style></head><body>
${reportHTML}
<div class="print-bar no-print">
  <button onclick="window.print()">🖨 Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=1000,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   COMBINED ASSESSMENT — CLASS REPORT PICKER + BUILDER (A4 landscape)
   ═══════════════════════════════════════════════════════════════════ */
function CbrClassReportPicker({ cr, onClose, toast }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');

  const generate = () => {
    if (format === 'word') {
      toast('Word export coming soon', 'info');
    } else {
      generateCbrClassReport(cr, style === 'color');
    }
    onClose();
  };

  return createPortal(
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title">Download Combined Result</div>
              <div className="rp-sub">{cr.cls} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips">
                    <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Full color with brand palette, highlights &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('bw'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips-bw">
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Printer-friendly grayscale, no background fills</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row">
            <button className={`rp-format-pill${format === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFormat('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${format === 'word' ? ' selected-word' : ''}`} onClick={() => setFormat('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Generate and download the report"><button className="rp-btn go" onClick={generate}><i className="fa-solid fa-download"></i><span>Download {style === 'color' ? 'Colorful' : 'Colorless'} {format === 'pdf' ? 'PDF' : 'Word'}</span></button></Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

function generateCbrClassReport(cr, isColor) {
  const aColor = isColor ? '#1E40AF' : '#374151';
  const aBg    = isColor ? '#EFF6FF' : '#F5F5F5';
  const aBdr   = isColor ? '#BFDBFE' : '#DDD';
  const tMuted = isColor ? '#64748B' : '#666';
  const rowEv  = isColor ? '#F8FAFF' : '#F7F7F7';
  const hBg    = isColor
    ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%)'
    : '#FFFFFF';
  const successCol = isColor ? '#16A34A' : '#000';
  const warnCol    = isColor ? '#D97706' : '#000';
  const purCol     = isColor ? '#7C3AED' : '#444';
  const today      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';

  const subs = cr.students[0]?.subs || [];

  const gradeColor = g => {
    if (!isColor) return '#000';
    return g === 'A+' ? '#16A34A'
         : g === 'A'  ? '#15803D'
         : g === 'B'  ? '#1D4ED8'
         : g === 'C'  ? '#B45309'
         : g === 'D'  ? '#EA580C'
         : g === 'F'  ? '#DC2626'
         : '#475569';
  };

  // Class stats
  const sortedByPct = [...cr.students].sort((a, b) => b.pct - a.pct);
  const highest = sortedByPct[0];
  const lowest  = sortedByPct[sortedByPct.length - 1];
  const avgPct  = cr.students.length
    ? Math.round((cr.students.reduce((a, s) => a + s.pct, 0) / cr.students.length) * 100) / 100
    : 0;
  const publishedTxt = cr.published ? 'Yes' : 'No';

  // Build sub header colspans
  const subHead1 = subs.map(sb => `
    <th colspan="2" style="padding:6px 9px;font-size:9.5px;font-weight:700;color:${purCol};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid ${aBdr};border-left:2px solid ${isColor ? 'rgba(124,58,237,.2)' : '#DDD'};background:${isColor ? 'rgba(124,58,237,.06)' : '#F5F5F5'}">${sb.name}</th>
  `).join('');
  const subHead2 = subs.map(() => `
    <th style="padding:6px 9px;font-size:9px;font-weight:700;color:${purCol};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr};border-left:2px solid ${isColor ? 'rgba(124,58,237,.2)' : '#DDD'};background:${isColor ? 'rgba(124,58,237,.06)' : '#F5F5F5'}">Orig</th>
    <th style="padding:6px 9px;font-size:9px;font-weight:700;color:${purCol};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr};background:${isColor ? 'rgba(124,58,237,.06)' : '#F5F5F5'}">Conv</th>
  `).join('');

  const rowsHtml = cr.students.map((st, i) => {
    const bg = i % 2 === 0 ? '#fff' : rowEv;
    const pctC = st.pct >= 80 ? successCol : st.pct >= 60 ? warnCol : (isColor ? '#DC2626' : '#000');
    const grCol = gradeColor(st.grade);
    const tdBase = `padding:6px 9px;border-bottom:1px solid ${aBdr};font-size:11px;color:#0F172A;text-align:center`;

    const subCells = (st.subs || []).map(sb => `
      <td style="${tdBase};color:${tMuted};border-left:2px solid ${isColor ? 'rgba(124,58,237,.1)' : '#EEE'}">${sb.subObt}/${sb.origT}</td>
      <td style="${tdBase};font-weight:700;color:${purCol}">${sb.conv}/${sb.weight}</td>
    `).join('');

    return `
      <tr style="background:${bg}">
        <td style="${tdBase};color:${tMuted};font-weight:700">${i + 1}</td>
        <td style="${tdBase};text-align:left;font-weight:700">${st.name}<br><span style="font-size:9px;font-weight:500;color:${tMuted}">${st.rollNo || ''}</span></td>
        <td style="${tdBase};text-align:left;color:${tMuted}">${st.father || '—'}</td>
        <td style="${tdBase};color:${tMuted}">${st.mainTotal}</td>
        <td style="${tdBase};font-weight:700;color:${aColor}">${st.mainObt}</td>
        ${subCells}
        <td style="${tdBase};color:${tMuted};border-left:2px solid ${aBdr}">${st.grandTotal}</td>
        <td style="${tdBase};font-weight:800;color:${successCol}">${st.grandObt}</td>
        <td style="${tdBase};font-weight:800;color:${pctC}">${st.pct}%</td>
        <td style="${tdBase}">
          <span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;padding:2px 7px;border-radius:5px;background:${grCol};color:#fff;font-size:10px;font-weight:800">${st.grade}</span>
        </td>
        <td style="${tdBase};font-weight:700;color:${aColor}">${st.rank}</td>
      </tr>`;
  }).join('');

  const reportHTML = `
    <div class="page-wrap" style="font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A">
      <!-- Header -->
      <div class="${isColor ? '' : 'cl-doc-header'}" style="background:${hBg};color:${isColor ? '#fff' : '#0F172A'};border-radius:0 0 14px 14px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          <div style="width:44px;height:44px;border-radius:11px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.25)">🎓</div>
          <div style="min-width:0">
            <div style="font-size:16px;font-weight:800">${schoolName}</div>
            <div style="font-size:10px;opacity:.75;margin-top:2px">Academic Year 2026–2027</div>
          </div>
        </div>
        <div style="text-align:right;min-width:0">
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.95)">Combined Result Report</div>
          <div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:3px">${cr.name} · Generated: ${today}</div>
        </div>
      </div>

      <!-- Meta strip -->
      <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid ${aBdr}">
        ${[
          ['Main Exam',  cr.mainExam],
          ['Sub Exams',  (cr.subExams || []).join(', ')],
          ['Class',      `${cr.cls} · Section ${cr.section}`],
          ['Students',   String(cr.students.length)],
          ['Published',  publishedTxt],
        ].map(([k, v]) => `
          <div style="flex:1;min-width:120px;padding:9px 14px;border-right:1px solid ${aBdr};overflow-wrap:anywhere">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${tMuted};margin-bottom:2px">${k}</div>
            <div style="font-size:12px;font-weight:800;color:${aColor}">${v || '—'}</div>
          </div>
        `).join('')}
      </div>

      <!-- Stats -->
      <div style="display:flex;gap:0;border-bottom:1px solid ${aBdr};background:${aBg}">
        ${[
          { label:'Class Average', val: avgPct + '%', col: aColor },
          { label:'Highest',       val: highest ? highest.pct + '%' : '—', col: successCol, sub: highest ? highest.name : '' },
          { label:'Lowest',        val: lowest  ? lowest.pct  + '%' : '—', col: warnCol,    sub: lowest  ? lowest.name  : '' },
          { label:'Sub Exams',     val: subs.length, col: purCol },
        ].map((tile, i, arr) => `
          <div style="flex:1;padding:10px 14px;text-align:center;border-right:${i < arr.length - 1 ? '1px solid ' + aBdr : 'none'}">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${tMuted};margin-bottom:3px">${tile.label}</div>
            <div style="font-size:16px;font-weight:900;color:${tile.col}">${tile.val}</div>
            ${tile.sub ? `<div style="font-size:9px;color:${tMuted};margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${tile.sub}</div>` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Main table -->
      <div style="padding:14px 14px 6px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${tMuted};margin-bottom:8px;display:flex;align-items:center;gap:8px">
          <div style="width:3px;height:13px;border-radius:2px;background:${aColor}"></div>STUDENT COMBINED RESULTS
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid ${aBdr};font-size:11px">
          <thead>
            <tr style="background:${aBg}">
              <th rowspan="2" style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">#</th>
              <th rowspan="2" style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Student</th>
              <th rowspan="2" style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Father</th>
              <th colspan="2" style="padding:6px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid ${aBdr}">${cr.mainExam}</th>
              ${subHead1}
              <th colspan="2" style="padding:6px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid ${aBdr};border-left:2px solid ${aBdr}">Grand Total</th>
              <th rowspan="2" style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">%</th>
              <th rowspan="2" style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Grade</th>
              <th rowspan="2" style="padding:8px 9px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Pos.</th>
            </tr>
            <tr style="background:${aBg}">
              <th style="padding:6px 9px;font-size:9px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Total</th>
              <th style="padding:6px 9px;font-size:9px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Obt</th>
              ${subHead2}
              <th style="padding:6px 9px;font-size:9px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr};border-left:2px solid ${aBdr}">Total</th>
              <th style="padding:6px 9px;font-size:9px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${aBdr}">Obt</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || `<tr><td colspan="${7 + subs.length * 2 + 3}" style="padding:18px;text-align:center;color:${tMuted}">No students in this class</td></tr>`}</tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="padding:9px 16px;background:${aBg};border-top:1px solid ${aBdr};display:flex;justify-content:space-between;font-size:10px;color:${tMuted};flex-wrap:wrap;gap:6px">
        <span>School Mentor ERP · Combined Assessment</span>
        <span>Confidential · ${schoolName}</span>
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Combined Result — ${cr.cls} · ${cr.mainExam}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;overflow-x:hidden}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;font-size:11px}
@page{size:A4 portrait;margin:12mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
}
.page-wrap{width:100%;max-width:210mm;margin:0 auto;padding:0;overflow:hidden}
table{width:100%;table-layout:fixed}
td,th{overflow-wrap:anywhere;word-break:break-word}
.page-wrap table th,
.page-wrap table td{padding:5px 6px!important;font-size:9.5px!important}
.page-wrap table th{font-size:8.5px!important;letter-spacing:.3px!important}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
/* Colorless overrides — recolor white text + decorative fills on the header. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
</style></head><body>
${reportHTML}
<div class="print-bar no-print">
  <button onclick="window.print()">🖨 Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   RESULT HISTORY — report picker + 5 builders (single card + 4 reports)
   ═══════════════════════════════════════════════════════════════════ */
function RhReportPicker({ req, onClose, toast }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');

  const titles = {
    card:       'Result Card Report',
    history:    'Full Academic History',
    progress:   'Progress Report',
    comparison: 'Comparison Report',
    attendance: 'Attendance Summary',
  };

  const generate = () => {
    if (format === 'word') {
      toast('Word export coming soon', 'info');
    } else {
      const isColor = style === 'color';
      if (req.type === 'card')       rhBuildSingleCardReport(req.student, req.result, isColor);
      if (req.type === 'history')    rhBuildHistoryReport(req.student, isColor);
      if (req.type === 'progress')   rhBuildProgressReport(req.student, isColor);
      if (req.type === 'comparison') rhBuildComparisonReport(req.student, isColor);
      if (req.type === 'attendance') rhBuildAttendanceReport(req.student, isColor);
    }
    onClose();
  };

  return createPortal(
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title">{titles[req.type] || 'Download Report'}</div>
              <div className="rp-sub">{req.student.name} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview"><div className="rp-preview-color">
                <div className="rp-mock-header"></div>
                <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                <div className="rp-mock-chips">
                  <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                  <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                  <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                </div>
              </div></div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Full color with brand palette, highlights &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('bw'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview"><div className="rp-preview-bw">
                <div className="rp-mock-header-bw"></div>
                <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                <div className="rp-mock-chips-bw">
                  <div className="rp-mock-chip-bw"></div>
                  <div className="rp-mock-chip-bw"></div>
                  <div className="rp-mock-chip-bw"></div>
                </div>
              </div></div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Printer-friendly grayscale, no background fills</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row">
            <button className={`rp-format-pill${format === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFormat('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${format === 'word' ? ' selected-word' : ''}`} onClick={() => setFormat('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Generate and download the report"><button className="rp-btn go" onClick={generate}><i className="fa-solid fa-download"></i><span>Download {style === 'color' ? 'Colorful' : 'Colorless'} {format === 'pdf' ? 'PDF' : 'Word'}</span></button></Tooltip>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* Shared helpers for RH reports */
function rhRptPalette(isColor) {
  return {
    accent : isColor ? '#1E40AF' : '#374151',
    accBg  : isColor ? '#EFF6FF' : '#F5F5F5',
    accBdr : isColor ? '#BFDBFE' : '#DDD',
    tMuted : isColor ? '#64748B' : '#666',
    rowEv  : isColor ? '#F8FAFF' : '#F7F7F7',
    hBg    : isColor ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%)' : '#FFFFFF',
    grn    : isColor ? '#16A34A' : '#000',
    amb    : isColor ? '#D97706' : '#000',
    red    : isColor ? '#DC2626' : '#000',
    pur    : isColor ? '#7C3AED' : '#444',
  };
}
function rhRptShell(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;overflow-x:hidden}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;font-size:11.5px}
@page{size:A4 portrait;margin:12mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
}
.page-wrap{width:100%;max-width:210mm;margin:0 auto;padding:0;overflow:hidden}
table{width:100%;table-layout:fixed}
td,th{overflow-wrap:anywhere;word-break:break-word}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
/* Colorless overrides — recolor white text + decorative fills on the header. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
</style></head><body>
${body}
<div class="print-bar no-print">
  <button onclick="window.print()">🖨 Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`;
}
function rhRptHeader(p, schoolName, today, title, subline) {
  return `<div class="${p.isColor ? '' : 'cl-doc-header'}" style="background:${p.hBg};color:${p.isColor ? '#fff' : '#0F172A'};border-radius:0 0 14px 14px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;page-break-inside:avoid">
    <div style="display:flex;align-items:center;gap:12px;min-width:0">
      <div style="width:44px;height:44px;border-radius:11px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.25)">🎓</div>
      <div style="min-width:0">
        <div style="font-size:16px;font-weight:800">${schoolName}</div>
        <div style="font-size:10px;opacity:.75;margin-top:2px">Academic Year 2026–2027</div>
      </div>
    </div>
    <div style="text-align:right;min-width:0">
      <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.95)">${title}</div>
      <div style="font-size:10px;color:rgba(255,255,255,.7);margin-top:3px">${subline} · ${today}</div>
    </div>
  </div>`;
}
function rhRptOpen(html) {
  const w = window.open('', '_blank', 'width=950,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}
function rhGradeColor(g, isColor) {
  if (!isColor || !g) return '#475569';
  return g === 'A+' ? '#16A34A' : g === 'A' ? '#15803D' : g === 'B' ? '#1D4ED8'
       : g === 'C' ? '#B45309' : g === 'D' ? '#EA580C' : '#DC2626';
}

/* 1) Single result card report (download icon on each exam history row) */
function rhBuildSingleCardReport(st, r, isColor) {
  const p = rhRptPalette(isColor);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';
  const grade = rcGetGrade(r.pct, 100);
  const gradeStr = grade ? grade.grade : '—';
  const gradeCol = rhGradeColor(gradeStr, isColor);
  const subjects = r.subjects || rhMakeSubjects(r.pct);
  const totals = RES_DEFAULT_TOTALS;
  const subjTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const subjObt   = RES_SUBJECTS.reduce((a, s) => a + (subjects[s] || 0), 0);
  const finalRem  = rcGetFinalRemarks(r.pct);

  const rows = RES_SUBJECTS.map((s, i) => {
    const tot = totals[s] || 20;
    const obt = subjects[s] || 0;
    const pct = tot ? Math.round((obt / tot) * 100) : 0;
    const g = rcGetGrade(obt, tot);
    const bg = i % 2 === 0 ? '#fff' : p.rowEv;
    return `<tr style="background:${bg}">
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-size:10.5px;color:${p.tMuted};text-align:center;font-weight:700">${i + 1}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-weight:700;color:#0F172A">${s}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;color:${p.tMuted}">${tot}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:800;color:${p.accent}">${obt}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:700;color:${pct >= 80 ? p.grn : pct >= 60 ? p.amb : p.red}">${pct}%</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center">
        <span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;padding:2px 7px;border-radius:5px;background:${rhGradeColor(g ? g.grade : 'F', isColor)};color:#fff;font-size:10px;font-weight:800">${g ? g.grade : '—'}</span>
      </td>
    </tr>`;
  }).join('');

  const body = `<div class="page-wrap" style="font-family:inherit">
    ${rhRptHeader(p, schoolName, today, 'Result Card', `${r.exam} · ${st.cls}`)}
    <div style="display:flex;flex-wrap:wrap;border-bottom:1px solid ${p.accBdr}">
      ${[
        ['Student',     st.name],
        ['Father',      st.father],
        ['Roll No',     st.rollNo],
        ['Class',       st.cls + ' · Section A'],
        ['Exam',        r.exam],
        ['Exam Date',   r.date],
        ['Year',        r.year === '2025-26' ? '2025–2026' : r.year],
        ['Type',        r.type === 'combined' ? 'Combined Assessment' : 'Single Assessment'],
      ].map(([k,v]) => `<div style="flex:1;min-width:120px;padding:8px 14px;border-right:1px solid ${p.accBdr}">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:2px">${k}</div>
        <div style="font-size:12px;font-weight:800;color:${p.accent}">${v}</div>
      </div>`).join('')}
    </div>
    <div style="padding:14px 14px 6px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:13px;border-radius:2px;background:${p.accent}"></div>SUBJECT-WISE RESULT
      </div>
      <table style="border:1px solid ${p.accBdr}">
        <colgroup><col style="width:32px"><col><col style="width:50px"><col style="width:60px"><col style="width:50px"><col style="width:46px"></colgroup>
        <thead><tr style="background:${p.accBg}">
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">#</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Subject</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Total</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Obtained</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">%</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Grade</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:${p.accBg}">
          <td colspan="2" style="padding:7px 9px;font-size:11px;font-weight:800;color:${p.accent};border-top:2px solid ${p.accBdr}">Grand Total</td>
          <td style="padding:7px 9px;text-align:center;font-weight:800;color:${p.accent};border-top:2px solid ${p.accBdr}">${subjTotal}</td>
          <td style="padding:7px 9px;text-align:center;font-weight:900;color:${p.accent};border-top:2px solid ${p.accBdr}">${subjObt}</td>
          <td style="padding:7px 9px;text-align:center;font-weight:900;color:${p.grn};border-top:2px solid ${p.accBdr}">${r.pct}%</td>
          <td style="padding:7px 9px;text-align:center;border-top:2px solid ${p.accBdr}">
            <span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;padding:3px 9px;border-radius:6px;background:${gradeCol};color:#fff;font-size:11px;font-weight:800">${gradeStr}</span>
          </td>
        </tr></tfoot>
      </table>
    </div>
    <div style="padding:0 14px 14px">
      <div style="margin-top:10px;padding:10px 14px;border:1px solid ${p.accBdr};border-radius:8px;background:${p.accBg}">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:4px">Final Remarks</div>
        <div style="font-size:11.5px;color:#0F172A;line-height:1.55">${finalRem.slice(0, 200)}</div>
      </div>
    </div>
    <div style="padding:9px 16px;background:${p.accBg};border-top:1px solid ${p.accBdr};display:flex;justify-content:space-between;font-size:10px;color:${p.tMuted};flex-wrap:wrap;gap:6px">
      <span>School Mentor ERP · Result History</span>
      <span>Confidential · ${schoolName}</span>
    </div>
  </div>`;

  rhRptOpen(rhRptShell(`Result Card — ${st.name}`, body));
}

/* 2) Full Academic History */
function rhBuildHistoryReport(st, isColor) {
  const p = rhRptPalette(isColor);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';
  const pcts = st.results.map(r => r.pct);
  const avgPct = pcts.length ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 10) / 10 : 0;
  const best   = pcts.length ? Math.max(...pcts) : 0;
  const worst  = pcts.length ? Math.min(...pcts) : 0;

  const rows = st.results.map((r, i) => {
    const isCb = r.type === 'combined';
    const g = rcGetGrade(r.pct, 100);
    const gCol = rhGradeColor(g ? g.grade : 'F', isColor);
    const pctC = r.pct >= 80 ? p.grn : r.pct >= 60 ? p.amb : p.red;
    const bg = i % 2 === 0 ? '#fff' : p.rowEv;
    const sfx = r.rank === 1 ? 'st' : r.rank === 2 ? 'nd' : r.rank === 3 ? 'rd' : 'th';
    return `<tr style="background:${bg}">
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-size:10.5px;color:${p.tMuted};text-align:center;font-weight:700">${i + 1}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-weight:700">${r.exam}<br><span style="font-size:9px;font-weight:600;color:${isCb ? p.pur : p.accent}">${isCb ? 'Combined' : 'Single'}</span></td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;color:${p.tMuted}">${r.year === '2025-26' ? '2025–2026' : r.year === '2024-25' ? '2024–2025' : r.year}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;color:${p.tMuted}">${r.date}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:800;color:${pctC}">${r.pct}%</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center">
        <span style="display:inline-flex;align-items:center;justify-content:center;min-width:22px;padding:2px 7px;border-radius:5px;background:${gCol};color:#fff;font-size:10px;font-weight:800">${g ? g.grade : '—'}</span>
      </td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:700;color:${p.accent}">${r.rank}${sfx}</td>
    </tr>`;
  }).join('');

  const body = `<div class="page-wrap">
    ${rhRptHeader(p, schoolName, today, 'Full Academic History', `${st.name} · ${st.cls}`)}
    <div style="display:flex;border-bottom:1px solid ${p.accBdr}">
      ${[
        ['Student',  st.name],
        ['Class',    st.cls],
        ['Roll No',  st.rollNo],
        ['Session',  st.session === '2025-26' ? '2025–2026' : st.session],
      ].map(([k,v]) => `<div style="flex:1;padding:9px 14px;border-right:1px solid ${p.accBdr}">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:2px">${k}</div>
        <div style="font-size:12px;font-weight:800;color:${p.accent}">${v}</div>
      </div>`).join('')}
    </div>
    <div style="display:flex;border-bottom:1px solid ${p.accBdr};background:${p.accBg}">
      ${[
        ['Exams',    String(st.results.length), p.accent],
        ['Average',  `${avgPct}%`, avgPct >= 80 ? p.grn : avgPct >= 60 ? p.amb : p.red],
        ['Best',     `${best}%`,   p.grn],
        ['Worst',    `${worst}%`,  p.red],
      ].map(([k,v,col], i, arr) => `<div style="flex:1;padding:10px 14px;text-align:center;border-right:${i < arr.length - 1 ? '1px solid ' + p.accBdr : 'none'}">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:3px">${k}</div>
        <div style="font-size:16px;font-weight:900;color:${col}">${v}</div>
      </div>`).join('')}
    </div>
    <div style="padding:14px 14px 6px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:13px;border-radius:2px;background:${p.accent}"></div>EXAM HISTORY
      </div>
      <table style="border:1px solid ${p.accBdr}">
        <colgroup><col style="width:32px"><col><col style="width:80px"><col style="width:80px"><col style="width:48px"><col style="width:50px"><col style="width:50px"></colgroup>
        <thead><tr style="background:${p.accBg}">
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">#</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Exam</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Year</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Date</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">%</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Grade</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Pos.</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="padding:9px 16px;background:${p.accBg};border-top:1px solid ${p.accBdr};display:flex;justify-content:space-between;font-size:10px;color:${p.tMuted}">
      <span>School Mentor ERP · Result History</span><span>Confidential · ${schoolName}</span>
    </div>
  </div>`;
  rhRptOpen(rhRptShell(`Academic History — ${st.name}`, body));
}

/* 3) Progress Report — trend + per-subject improvement */
function rhBuildProgressReport(st, isColor) {
  const p = rhRptPalette(isColor);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';
  const pcts = st.results.map(r => r.pct);
  const first = pcts[0] || 0;
  const last  = pcts[pcts.length - 1] || 0;
  const delta = Math.round((last - first) * 10) / 10;
  const trendCol = delta > 0 ? p.grn : delta < 0 ? p.red : p.tMuted;
  const trendLbl = delta > 0 ? `Improving (+${delta}%)` : delta < 0 ? `Declining (${delta}%)` : 'Stable';

  // Trend bars
  const bars = st.results.map(r => {
    const col = r.pct >= 80 ? p.grn : r.pct >= 60 ? p.accent : r.pct >= 50 ? p.amb : p.red;
    const h = Math.max(8, Math.round(r.pct));
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:64px;flex-shrink:0">
      <div style="font-size:9.5px;font-weight:700;color:${col}">${r.pct}%</div>
      <div style="width:100%;background:${p.accBg};border-radius:4px 4px 0 0;height:80px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${h}%;background:${col};border-radius:4px 4px 0 0;min-height:4px"></div>
      </div>
      <div style="font-size:8.5px;color:${p.tMuted};text-align:center;line-height:1.2;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.exam}</div>
    </div>`;
  }).join('');

  // Subject improvement: avg across firsts vs lasts (single results only)
  const singles = st.results.filter(r => r.type === 'single' && r.subjects);
  const subjFirst = singles[0]?.subjects || {};
  const subjLast  = singles[singles.length - 1]?.subjects || {};
  const subjRows = RES_SUBJECTS.slice(0, 10).map((s, i) => {
    const a = subjFirst[s] || 0;
    const b = subjLast[s]  || 0;
    const d = b - a;
    const col = d > 0 ? p.grn : d < 0 ? p.red : p.tMuted;
    const bg = i % 2 === 0 ? '#fff' : p.rowEv;
    return `<tr style="background:${bg}">
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-size:10.5px;color:${p.tMuted};text-align:center;font-weight:700">${i + 1}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-weight:700">${s}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center">${a}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:800;color:${p.accent}">${b}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:800;color:${col}">${d > 0 ? '+' : ''}${d}</td>
    </tr>`;
  }).join('');

  const body = `<div class="page-wrap">
    ${rhRptHeader(p, schoolName, today, 'Progress Report', `${st.name} · ${st.cls}`)}
    <div style="display:flex;border-bottom:1px solid ${p.accBdr};background:${p.accBg}">
      ${[
        ['First',  `${first}%`, p.accent],
        ['Latest', `${last}%`,  p.accent],
        ['Change', `${delta > 0 ? '+' : ''}${delta}%`, trendCol],
        ['Trend',  trendLbl, trendCol],
      ].map(([k,v,col],i,arr) => `<div style="flex:1;padding:10px 14px;text-align:center;border-right:${i < arr.length - 1 ? '1px solid ' + p.accBdr : 'none'}">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:3px">${k}</div>
        <div style="font-size:14px;font-weight:900;color:${col}">${v}</div>
      </div>`).join('')}
    </div>
    <div style="padding:14px 14px 8px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:13px;border-radius:2px;background:${p.accent}"></div>PERFORMANCE TREND
      </div>
      <div style="display:flex;gap:8px;align-items:flex-end;padding:8px;border:1px solid ${p.accBdr};border-radius:10px;overflow-x:auto;background:#fff">${bars}</div>
    </div>
    ${singles.length >= 2 ? `<div style="padding:6px 14px 0">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:13px;border-radius:2px;background:${p.pur}"></div>SUBJECT-WISE IMPROVEMENT
      </div>
      <table style="border:1px solid ${p.accBdr}">
        <colgroup><col style="width:32px"><col><col style="width:60px"><col style="width:60px"><col style="width:60px"></colgroup>
        <thead><tr style="background:${p.accBg}">
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">#</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Subject</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">First</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Latest</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Δ</th>
        </tr></thead>
        <tbody>${subjRows}</tbody>
      </table>
    </div>` : ''}
    <div style="margin-top:10px;padding:9px 16px;background:${p.accBg};border-top:1px solid ${p.accBdr};display:flex;justify-content:space-between;font-size:10px;color:${p.tMuted}">
      <span>School Mentor ERP · Result History</span><span>Confidential · ${schoolName}</span>
    </div>
  </div>`;
  rhRptOpen(rhRptShell(`Progress Report — ${st.name}`, body));
}

/* 4) Comparison Report — exam vs exam grade movement */
function rhBuildComparisonReport(st, isColor) {
  const p = rhRptPalette(isColor);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';

  const rows = [];
  for (let i = 1; i < st.results.length; i++) {
    const prev = st.results[i - 1];
    const cur  = st.results[i];
    const dPct = Math.round((cur.pct - prev.pct) * 10) / 10;
    const dRank = (prev.rank || 0) - (cur.rank || 0);
    const dirCol = dPct > 0 ? p.grn : dPct < 0 ? p.red : p.tMuted;
    const dirIcon = dPct > 0 ? '↑' : dPct < 0 ? '↓' : '→';
    const bg = i % 2 === 1 ? '#fff' : p.rowEv;
    rows.push(`<tr style="background:${bg}">
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-size:10.5px;color:${p.tMuted};text-align:center;font-weight:700">${i}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-weight:700">${prev.exam}<br><span style="font-size:9px;font-weight:600;color:${p.tMuted}">${prev.pct}% · ${rcGetGrade(prev.pct, 100)?.grade || '—'}</span></td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-size:14px;color:${dirCol};font-weight:900">${dirIcon}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-weight:700">${cur.exam}<br><span style="font-size:9px;font-weight:600;color:${p.tMuted}">${cur.pct}% · ${rcGetGrade(cur.pct, 100)?.grade || '—'}</span></td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:800;color:${dirCol}">${dPct > 0 ? '+' : ''}${dPct}%</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:700;color:${dRank > 0 ? p.grn : dRank < 0 ? p.red : p.tMuted}">${dRank > 0 ? '+' : ''}${dRank}</td>
    </tr>`);
  }

  const body = `<div class="page-wrap">
    ${rhRptHeader(p, schoolName, today, 'Comparison Report', `${st.name} · ${st.cls}`)}
    <div style="padding:14px 14px 6px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin-bottom:8px;display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:13px;border-radius:2px;background:${p.amb}"></div>EXAM TO EXAM COMPARISON
      </div>
      <table style="border:1px solid ${p.accBdr}">
        <colgroup><col style="width:32px"><col><col style="width:36px"><col><col style="width:60px"><col style="width:60px"></colgroup>
        <thead><tr style="background:${p.accBg}">
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">#</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Previous Exam</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">vs</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Current Exam</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Δ %</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Δ Rank</th>
        </tr></thead>
        <tbody>${rows.join('') || `<tr><td colspan="6" style="padding:16px;text-align:center;color:${p.tMuted}">Need at least 2 exams to compare</td></tr>`}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;padding:9px 16px;background:${p.accBg};border-top:1px solid ${p.accBdr};display:flex;justify-content:space-between;font-size:10px;color:${p.tMuted}">
      <span>School Mentor ERP · Result History</span><span>Confidential · ${schoolName}</span>
    </div>
  </div>`;
  rhRptOpen(rhRptShell(`Comparison Report — ${st.name}`, body));
}

/* 5) Attendance Summary */
function rhBuildAttendanceReport(st, isColor) {
  const p = rhRptPalette(isColor);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const schoolName = 'The Oxford System, Lahore Campus';
  const attCol = st.attendance >= 90 ? p.grn : st.attendance >= 75 ? p.amb : p.red;
  const statusLbl = st.attendance >= 90 ? 'Excellent' : st.attendance >= 75 ? 'Good' : st.attendance >= 60 ? 'Needs Improvement' : 'Critical';

  // Generate 12 plausible monthly bars (deterministic from the overall attendance)
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const monthOffsets = [-2, 1, 0, 2, -1, 0, 1, -2, 0, 1, 2, 0];
  const monthAtt = months.map((m, i) => Math.max(40, Math.min(100, st.attendance + monthOffsets[i])));

  const monthBars = months.map((m, i) => {
    const a = monthAtt[i];
    const col = a >= 90 ? p.grn : a >= 75 ? p.amb : p.red;
    const h = Math.max(8, Math.round(a));
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;min-width:36px">
      <div style="font-size:9px;font-weight:700;color:${col}">${a}%</div>
      <div style="width:100%;background:${p.accBg};border-radius:4px 4px 0 0;height:80px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${h}%;background:${col};border-radius:4px 4px 0 0;min-height:4px"></div>
      </div>
      <div style="font-size:9px;color:${p.tMuted};font-weight:600">${m}</div>
    </div>`;
  }).join('');

  const monthRows = months.map((m, i) => {
    const a = monthAtt[i];
    const col = a >= 90 ? p.grn : a >= 75 ? p.amb : p.red;
    const bg = i % 2 === 0 ? '#fff' : p.rowEv;
    return `<tr style="background:${bg}">
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-size:10.5px;color:${p.tMuted};text-align:center;font-weight:700">${i + 1}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};font-weight:700">${m}</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;font-weight:800;color:${col}">${a}%</td>
      <td style="padding:6px 9px;border-bottom:1px solid ${p.accBdr};text-align:center;color:${col};font-weight:700">${a >= 90 ? 'Excellent' : a >= 75 ? 'Good' : a >= 60 ? 'Needs Improvement' : 'Critical'}</td>
    </tr>`;
  }).join('');

  const body = `<div class="page-wrap">
    ${rhRptHeader(p, schoolName, today, 'Attendance Summary', `${st.name} · ${st.cls}`)}
    <div style="display:flex;border-bottom:1px solid ${p.accBdr};background:${p.accBg}">
      ${[
        ['Overall',  `${st.attendance}%`, attCol],
        ['Status',   statusLbl,             attCol],
        ['Session',  st.session === '2025-26' ? '2025–2026' : st.session, p.accent],
        ['Class',    st.cls.replace(' - Section A', ''), p.accent],
      ].map(([k,v,col],i,arr) => `<div style="flex:1;padding:10px 14px;text-align:center;border-right:${i < arr.length - 1 ? '1px solid ' + p.accBdr : 'none'}">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${p.tMuted};margin-bottom:3px">${k}</div>
        <div style="font-size:15px;font-weight:900;color:${col}">${v}</div>
      </div>`).join('')}
    </div>
    <div style="padding:14px 14px 8px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:${p.tMuted};margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:13px;border-radius:2px;background:${p.grn}"></div>MONTHLY BREAKDOWN
      </div>
      <div style="display:flex;gap:6px;align-items:flex-end;padding:8px;border:1px solid ${p.accBdr};border-radius:10px;background:#fff">${monthBars}</div>
    </div>
    <div style="padding:6px 14px 0">
      <table style="border:1px solid ${p.accBdr}">
        <colgroup><col style="width:32px"><col><col style="width:62px"><col style="width:140px"></colgroup>
        <thead><tr style="background:${p.accBg}">
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">#</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:left;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Month</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Attendance</th>
          <th style="padding:7px 9px;font-size:9.5px;font-weight:700;color:${p.accent};text-align:center;text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${p.accBdr}">Status</th>
        </tr></thead>
        <tbody>${monthRows}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;padding:9px 16px;background:${p.accBg};border-top:1px solid ${p.accBdr};display:flex;justify-content:space-between;font-size:10px;color:${p.tMuted}">
      <span>School Mentor ERP · Result History</span><span>Confidential · ${schoolName}</span>
    </div>
  </div>`;
  rhRptOpen(rhRptShell(`Attendance Summary — ${st.name}`, body));
}

function ResultCardViewer({ student, rd, ex, template, rcoGeneral, rcoSig, rsSigs, rsAbsentMode, onClose, toast, initialMode = 'single' }) {
  const [mode, setMode] = useState(initialMode);
  const cardRef = useRef(null);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tConfig = RC_TEMPLATES.find(x => x.id === template) || RC_TEMPLATES[0];

  const printPdf = () => {
    const node = cardRef.current;
    if (!node) return;
    const html = node.innerHTML;
    const w = window.open('', '_blank', 'width=960,height=820');
    if (!w) { toast('Pop-up blocker prevented opening', 'error'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Result Card — ${student.name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A}
@page{size:A4 portrait;margin:12mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
}
.wrap{width:100%;max-width:210mm;margin:0 auto}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
/* Colorless overrides — recolor white text + decorative fills on the header. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
</style></head><body>
<div class="wrap">${html}</div>
<div class="print-bar no-print">
  <button onclick="window.print()">🖨 Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`);
    w.document.close();
  };

  const tabBase = {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '8px 18px 10px', fontSize: 12.5, fontWeight: 700,
    background: 'transparent', border: 'none',
    borderBottom: '2.5px solid transparent', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: -1,
    color: 'var(--text-muted)',
  };
  const tabActive = { ...tabBase, color: tConfig.accent, borderBottomColor: tConfig.accent };

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(10,22,40,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.4)', animation: 'fadeSlide .22s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: tConfig.accentLight, color: tConfig.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              <i className="fa-solid fa-id-card"></i>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Result Card — {student.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{tConfig.name} · {ex.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={printPdf}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <i className="fa-solid fa-file-pdf"></i> PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '12px 22px 0', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexShrink: 0 }}>
          <button type="button" style={mode === 'single' ? tabActive : tabBase} onClick={() => setMode('single')}>
            <i className="fa-solid fa-file"></i> Single Assessment
          </button>
          <button type="button" style={mode === 'combined' ? tabActive : tabBase} onClick={() => setMode('combined')}>
            <i className="fa-solid fa-layer-group"></i> Combined Assessment
          </button>
        </div>

        {/* Card area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F1F5F9' }}>
          <div ref={cardRef} style={{ maxWidth: 720, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.14)' }}>
            {template === 'classic' && (
              <ClassicResultCard
                rcoGeneral={rcoGeneral} rcoSig={rcoSig} rsSigs={rsSigs} rsAbsentMode={rsAbsentMode}
                mode={mode} student={student} rd={rd} ex={ex}
              />
            )}
            {template === 'insight' && (
              <InsightResultCard
                rcoGeneral={rcoGeneral} rcoSig={rcoSig} rsSigs={rsSigs} rsAbsentMode={rsAbsentMode}
                mode={mode} student={student} rd={rd} ex={ex}
              />
            )}
            {template === 'portfolio' && (
              <PortfolioResultCard
                rcoGeneral={rcoGeneral} rcoSig={rcoSig} rsSigs={rsSigs} rsAbsentMode={rsAbsentMode}
                mode={mode} student={student} rd={rd} ex={ex}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function TemplatePreviewModal({ templateId, rcoGeneral, rcoSig, rsSigs, rsAbsentMode, onClose, onSelect }) {
  const t = RC_TEMPLATES.find(x => x.id === templateId);
  const [mode, setMode] = useState('single'); // single | combined

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!t) return null;

  const tabBase = {
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '8px 18px 10px', fontSize: 12.5, fontWeight: 700,
    background: 'transparent', border: 'none',
    borderBottom: '2.5px solid transparent', cursor: 'pointer',
    fontFamily: 'inherit', marginBottom: -1,
    color: 'var(--text-muted)',
  };
  const tabActive = { ...tabBase, color: t.accent, borderBottomColor: t.accent };

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 9900, background: 'rgba(10,22,40,.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,.4)', animation: 'fadeSlide .22s ease' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.accentLight, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
              <i className="fa-solid fa-eye"></i>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t.name} — Preview</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Switch between Single and Combined Assessment previews</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: t.accent, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <i className="fa-solid fa-check"></i> Select
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '12px 22px 0', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-muted)', flexShrink: 0 }}>
          <button type="button" style={mode === 'single' ? tabActive : tabBase} onClick={() => setMode('single')}>
            <i className="fa-solid fa-file"></i> Single Assessment
          </button>
          <button type="button" style={mode === 'combined' ? tabActive : tabBase} onClick={() => setMode('combined')}>
            <i className="fa-solid fa-layer-group"></i> Combined Assessment
          </button>
        </div>

        {/* Preview area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#F1F5F9' }}>
          <div style={{ maxWidth: 720, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.14)' }}>
            {t.id === 'classic' && (
              <ClassicResultCard
                rcoGeneral={rcoGeneral}
                rcoSig={rcoSig}
                rsSigs={rsSigs}
                rsAbsentMode={rsAbsentMode}
                mode={mode}
              />
            )}
            {t.id === 'insight' && (
              <InsightResultCard
                rcoGeneral={rcoGeneral}
                rcoSig={rcoSig}
                rsSigs={rsSigs}
                rsAbsentMode={rsAbsentMode}
                mode={mode}
              />
            )}
            {t.id === 'portfolio' && (
              <PortfolioResultCard
                rcoGeneral={rcoGeneral}
                rcoSig={rcoSig}
                rsSigs={rsSigs}
                rsAbsentMode={rsAbsentMode}
                mode={mode}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RESULT SETUP — EDIT MODAL (4 tabs: grades, signatures, remarks, absent)
   ═══════════════════════════════════════════════════════════════════ */
function ResultSetupModal({ grades, sigs, remarks, absentMode, onSave, onClose, toast }) {
  const [tab, setTab] = useState('grades');
  const [draftGrades, setDraftGrades] = useState(() => {
    if (grades && grades.length) {
      return grades.map(g => ({ ...g }));
    }
    return [];
  });
  const [draftSigs, setDraftSigs] = useState(() => {
    if (sigs && sigs.length) {
      return sigs.map(s => ({ ...s }));
    }
    return [];
  });
  const [draftRemarks, setDraftRemarks] = useState(() => {
    if (remarks && remarks.length) {
      return remarks.map(r => ({ ...r }));
    }
    return [];
  });
  const [draftAbsent, setDraftAbsent] = useState(absentMode);
  const [loading, setLoading] = useState(false);

  // Update drafts when props change
  useEffect(() => {
    if (grades && grades.length) {
      setDraftGrades(grades.map(g => ({ ...g })));
    }
  }, [grades]);

  useEffect(() => {
    if (sigs && sigs.length) {
      setDraftSigs(sigs.map(s => ({ ...s })));
    }
  }, [sigs]);

  useEffect(() => {
    if (remarks && remarks.length) {
      setDraftRemarks(remarks.map(r => ({ ...r })));
    }
  }, [remarks]);

  const upGrade = (id, k, v) => setDraftGrades(rows => rows.map(r => r.id === id ? { ...r, [k]: v } : r));
  const upSig = (id, k, v) => setDraftSigs(rows => rows.map(r => r.id === id ? { ...r, [k]: v } : r));
  const upRemark = (id, k, v) => setDraftRemarks(rows => rows.map(r => r.id === id ? { ...r, [k]: v } : r));

const addGrade = () =>
  setDraftGrades(r => [
    ...r,
    { id: `temp_${Date.now()}`, grade: 'A+', cond: 'gte', pct: '', comment: '' }
  ]);
   const addSig = () =>
  setDraftSigs(r => [
    ...r,
    { id: `temp_${Date.now()}`, name: '', desig: '', img: '' }
  ]);

const addRemark = () =>
  setDraftRemarks(r => [
    ...r,
    { id: `temp_${Date.now()}`, cond: 'gte', pct: '', text: '' }
  ]);  const [rsConfirm, setRsConfirm] = useState(null);

  const askDeleteGrade = g => setRsConfirm({
    kind: 'grade', id: g.id,
    title: 'Delete Grade',
    message: `Delete grade rule for <strong>${g.grade || '—'}</strong>?`,
  });
  const askDeleteSig = s => setRsConfirm({
    kind: 'sig', id: s.id,
    title: 'Delete Signature',
    message: `Delete signature for <strong>${s.name?.trim() || 'this entry'}</strong>?`,
  });
  const askDeleteRemark = r => setRsConfirm({
    kind: 'remark', id: r.id,
    title: 'Delete Remark',
    message: `Delete this final remark rule (${RS_COND_MAP[r.cond] || '≥'} ${r.pct || '—'}%)?`,
  });

const runDelete = async () => {
  if (!rsConfirm) return;

  const { kind, id } = rsConfirm;

  try {
    const token = sessionStorage.getItem("token");

    if (typeof id === "number" && id > 0) {
      let endpoint = "";

      if (kind === "grade") {
        endpoint = `/api/delete-grading-setup/${id}`;
      } else if (kind === "sig") {
        endpoint = `/api/delete-grading-uploader/${id}`;
      } else if (kind === "remark") {
        endpoint = `/api/delete-overall-grading/${id}`;
      }

      if (endpoint) {
        await fetch(buildUrl(endpoint), {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          }
        });
      }
    }

    // Remove from local state
    if (kind === "grade") {
      setDraftGrades(r => r.filter(x => x.id !== id));
    }

    if (kind === "sig") {
      setDraftSigs(r => r.filter(x => x.id !== id));
    }

    if (kind === "remark") {
      setDraftRemarks(r => r.filter(x => x.id !== id));
    }

    setRsConfirm(null);

    toast("Deleted successfully", "success");
  } catch (err) {
    console.error(err);
    toast("Failed to delete", "error");
  }
};
  const uploadSig = (id, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => upSig(id, 'img', e.target.result);
    reader.readAsDataURL(file);
  };

  // Helper function to save a single grade to API
  const saveGradeToAPI = async (grade) => {
    try {
      const token = sessionStorage.getItem('token');
      const branchID = sessionStorage.getItem('branchID');
      
      // Format percentage based on condition
      let percentage = '';
      switch (grade.cond) {
        case 'gte': percentage = `≥${grade.pct}`; break;
        case 'gt': percentage = `>${grade.pct}`; break;
        case 'lte': percentage = `≤${grade.pct}`; break;
        case 'lt': percentage = `<${grade.pct}`; break;
        case 'eq': percentage = `=${grade.pct}`; break;
        default: percentage = grade.pct;
      }
      
      const isUpdate = grade.id && typeof grade.id === 'number' && grade.id > 0;
      
      const payload = {
        id: isUpdate ? grade.id : 0,
        branchID: branchID || "1",
        percentage: percentage,
        grade: grade.grade || '',
        remarks: grade.comment || '',
        percentageNo: "",
        action: isUpdate ? "update" : "insert"
      };
      
      console.log("Saving grade payload:", payload);
      
      const response = await fetch(buildUrl('/api/gradingcrud'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log("Grade save response:", data);
      return { success: response.ok, data };
    } catch (error) {
      console.error("Error saving grade:", error);
      return { success: false, error };
    }
  };
  
  // Helper function to delete a grade from API
  const deleteGradeFromAPI = async (gradeId) => {
    try {
      const token = sessionStorage.getItem('token');
      const branchID = sessionStorage.getItem('branchID');
      
      const payload = {
        id: gradeId,
        branchID: branchID || "1",
        percentage: "",
        grade: "",
        remarks: "",
        percentageNo: "",
        action: "delete"
      };
      
      console.log("Deleting grade payload:", payload);
      
      const response = await fetch(buildUrl('/api/gradingcrud'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      console.error("Error deleting grade:", error);
      return { success: false, error };
    }
  };
  
  // Helper function to save a single signature to API
  const saveSignatureToAPI = async (signature) => {
    try {
      const token = sessionStorage.getItem('token');
      const branchID = sessionStorage.getItem('branchID');
      
      const isUpdate = signature.id && typeof signature.id === 'number' && signature.id > 0;
      
      // Handle image - if it's a data URL, we need to send it as is or extract base64
      let signatureValue = signature.img || '';
      // If it's a file upload, we keep the data URL
      
      const payload = {
        id: isUpdate ? signature.id : 0,
        branchID: branchID || "1",
        name: signature.name || '',
        designation: signature.desig || '',
        signature: signatureValue,
        action: isUpdate ? "update" : "insert"
      };
      
      console.log("Saving signature payload:", payload);
      
      const response = await fetch(buildUrl('/api/gradinguploadercrud'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log("Signature save response:", data);
      return { success: response.ok, data };
    } catch (error) {
      console.error("Error saving signature:", error);
      return { success: false, error };
    }
  };
  
  // Helper function to delete a signature from API
  const deleteSignatureFromAPI = async (signatureId) => {
    try {
      const token = sessionStorage.getItem('token');
      const branchID = sessionStorage.getItem('branchID');
      
      const payload = {
        id: signatureId,
        branchID: branchID || "1",
        name: "",
        designation: "",
        signature: "",
        action: "delete"
      };
      
      const response = await fetch(buildUrl('/api/gradinguploadercrud'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      console.error("Error deleting signature:", error);
      return { success: false, error };
    }
  };
  
  // Helper function to save a single remark to API
  const saveRemarkToAPI = async (remark) => {
    try {
      const token = sessionStorage.getItem('token');
      const branchID = sessionStorage.getItem('branchID');
      
      // Format percentage based on condition
      let percentage = '';
      switch (remark.cond) {
        case 'gte': percentage = `≥ ${remark.pct}`; break;
        case 'gt': percentage = `> ${remark.pct}`; break;
        case 'lte': percentage = `≤ ${remark.pct}`; break;
        case 'lt': percentage = `< ${remark.pct}`; break;
        case 'eq': percentage = `= ${remark.pct}`; break;
        default: percentage = remark.pct;
      }
      
      const isUpdate = remark.id && typeof remark.id === 'number' && remark.id > 0;
      
      const payload = {
        id: isUpdate ? remark.id : 0,
        branchID: branchID || "1",
        percentage: percentage,
        finalRemarks: remark.text || '',
        action: isUpdate ? "update" : "insert"
      };
      
      console.log("Saving remark payload:", payload);
      
      const response = await fetch(buildUrl('/api/overallgradingcrud'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log("Remark save response:", data);
      return { success: response.ok, data };
    } catch (error) {
      console.error("Error saving remark:", error);
      return { success: false, error };
    }
  };
  
  // Helper function to delete a remark from API
  const deleteRemarkFromAPI = async (remarkId) => {
    try {
      const token = sessionStorage.getItem('token');
      const branchID = sessionStorage.getItem('branchID');
      
      const payload = {
        id: remarkId,
        branchID: branchID || "1",
        percentage: "",
        finalRemarks: "",
        action: "delete"
      };
      
      const response = await fetch(buildUrl('/api/overallgradingcrud'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      return { success: response.ok, data };
    } catch (error) {
      console.error("Error deleting remark:", error);
      return { success: false, error };
    }
  };

  const submit = async () => {
    setLoading(true);
    
    try {
      // Track which items were added/updated vs deleted
      const originalGradeIds = new Set(grades.map(g => g.id));
      const newGradeIds = new Set(draftGrades.map(g => g.id).filter(id => typeof id === 'number'));
      
      // Find deleted grades (present in original but not in new)
      const deletedGrades = grades.filter(g => !newGradeIds.has(g.id));
      
      // Save/Update all grades
      for (const grade of draftGrades) {
        await saveGradeToAPI(grade);
      }
      
      // Delete removed grades
      for (const grade of deletedGrades) {
        if (grade.id && typeof grade.id === 'number') {
          await deleteGradeFromAPI(grade.id);
        }
      }
      
      // Handle Signatures
      const originalSigIds = new Set(sigs.map(s => s.id));
      const newSigIds = new Set(draftSigs.map(s => s.id).filter(id => typeof id === 'number'));
      const deletedSigs = sigs.filter(s => !newSigIds.has(s.id));
      
      for (const sig of draftSigs) {
        await saveSignatureToAPI(sig);
      }
      
      for (const sig of deletedSigs) {
        if (sig.id && typeof sig.id === 'number') {
          await deleteSignatureFromAPI(sig.id);
        }
      }
      
      // Handle Remarks
      const originalRemarkIds = new Set(remarks.map(r => r.id));
      const newRemarkIds = new Set(draftRemarks.map(r => r.id).filter(id => typeof id === 'number'));
      const deletedRemarks = remarks.filter(r => !newRemarkIds.has(r.id));
      
      for (const remark of draftRemarks) {
        await saveRemarkToAPI(remark);
      }
      
      for (const remark of deletedRemarks) {
        if (remark.id && typeof remark.id === 'number') {
          await deleteRemarkFromAPI(remark.id);
        }
      }
      
      toast('Result setup saved successfully!', 'success');
      
      // Call onSave to update parent state
      onSave({
        grades: draftGrades,
        sigs: draftSigs,
        remarks: draftRemarks,
        absentMode: draftAbsent,
      });
      
    } catch (error) {
      console.error("Error saving result setup:", error);
      toast('Error saving result setup', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="exam-modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="exam-modal rs-modal">
        <div className="exam-modal-header">
          <div className="exam-modal-header-left">
            <div className="exam-modal-header-icon"><i className="fa-solid fa-pen-to-square"></i></div>
            <div>
              <div className="exam-modal-title">Edit Result Setup</div>
              <div className="exam-modal-sub">Configure grades, signatures, final remarks &amp; absent handling</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="exam-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        {/* Modal tabs */}
        <div className="rs-modal-tabs">
          {[
            { k: 'grades', l: 'Grade', icon: 'fa-chart-bar' },
            { k: 'signatures', l: 'Signature', icon: 'fa-signature' },
            { k: 'remarks', l: 'Final Remarks', icon: 'fa-comment-dots' },
            { k: 'absent', l: 'Absent Handling', icon: 'fa-user-xmark' },
          ].map(t => (
            <button key={t.k} className={`rs-modal-tab${tab === t.k ? ' active' : ''}`} onClick={() => setTab(t.k)}>
              <i className={`fa-solid ${t.icon}`}></i> {t.l}
            </button>
          ))}
        </div>

        <div className="exam-modal-body rs-modal-body">
          {/* GRADES */}
          {tab === 'grades' && (
            <>
              {draftGrades.length === 0 ? (
                <div className="rs-empty">No grades configured. Click "Add Grade" to create one.</div>
              ) : (
                draftGrades.map((g, i) => (
                  <div key={g.id} className="rm-grade-row">
                    <div className="rm-sno">{i + 1}</div>
                    <input
                      className="rs-input"
                      list={`gradeOpts-${g.id}`}
                      value={g.grade || ''}
                      placeholder="Grade..."
                      onChange={e => upGrade(g.id, 'grade', e.target.value)}
                    />
                    <datalist id={`gradeOpts-${g.id}`}>
                      {RS_GRADE_LIST.map(opt => <option key={opt} value={opt} />)}
                    </datalist>
                    <select className="rs-input" value={g.cond || 'gte'} onChange={e => upGrade(g.id, 'cond', e.target.value)}>
                      {RS_COND_LIST.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                    <input
                      className="rs-input"
                      type="number"
                      value={g.pct || ''}
                      placeholder="Value"
                      onChange={e => upGrade(g.id, 'pct', e.target.value)}
                    />
                    <CharField
                      value={g.comment || ''}
                      max={28}
                      placeholder="Comment (max 28 chars)"
                      onChange={v => upGrade(g.id, 'comment', v)}
                      toast={toast}
                    />
                    <Tooltip text="Remove this grade band">
                      <button className="rs-del" onClick={() => askDeleteGrade(g)}>
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </Tooltip>
                  </div>
                ))
              )}
              <Tooltip text="Add a new grade band">
                <button className="rs-add" onClick={addGrade}>
                  <i className="fa-solid fa-plus"></i> Add Grade
                </button>
              </Tooltip>
            </>
          )}

          {/* SIGNATURES */}
          {tab === 'signatures' && (
            <>
              {draftSigs.length === 0 ? (
                <div className="rs-empty">No signatures added. Click "Add Signature" to create one.</div>
              ) : (
                draftSigs.map((s, i) => (
                  <div key={s.id} className="rm-sig-row">
                    <div className="rm-sno">{i + 1}</div>
                    <input
                      className="rs-input"
                      value={s.name || ''}
                      placeholder="Name"
                      onChange={e => upSig(s.id, 'name', e.target.value)}
                    />
                    <input
                      className="rs-input"
                      value={s.desig || ''}
                      placeholder="Designation"
                      onChange={e => upSig(s.id, 'desig', e.target.value)}
                    />
                    <label className="rs-sig-upload">
                      <input type="file" accept="image/*" onChange={e => uploadSig(s.id, e.target.files[0])} />
                      {s.img ? (
                        <img src={s.img} alt="" />
                      ) : (
                        <div className="rs-sig-upload-placeholder">
                          <i className="fa-solid fa-plus"></i>
                          <span>{s.img || 'Upload'}</span>
                        </div>
                      )}
                    </label>
                    <Tooltip text="Remove this signatory">
                      <button className="rs-del" onClick={() => askDeleteSig(s)}>
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </Tooltip>
                  </div>
                ))
              )}
              <Tooltip text="Add a new signatory">
                <button className="rs-add" onClick={addSig}>
                  <i className="fa-solid fa-plus"></i> Add Signature
                </button>
              </Tooltip>
            </>
          )}

          {/* REMARKS */}
          {tab === 'remarks' && (
            <>
              {draftRemarks.length === 0 ? (
                <div className="rs-empty">No remarks configured. Click "Add Remark" to create one.</div>
              ) : (
                draftRemarks.map((r, i) => (
                  <div key={r.id} className="rm-remark-row">
                    <div className="rm-remark-top">
                      <div className="rm-sno">{i + 1}</div>
                      <div className="rs-remark-lbl">Total Marks</div>
                      <select className="rs-input" value={r.cond || 'gte'} onChange={e => upRemark(r.id, 'cond', e.target.value)}>
                        {RS_COND_LIST.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
                      </select>
                      <input
                        className="rs-input"
                        type="number"
                        value={r.pct || ''}
                        placeholder="Percentage value"
                        onChange={e => upRemark(r.id, 'pct', e.target.value)}
                      />
                      <Tooltip text="Remove this remark">
                        <button className="rs-del" onClick={() => askDeleteRemark(r)}>
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </Tooltip>
                    </div>
                    <div className="rm-remark-bot">
                      <CharField
                        value={r.text || ''}
                        max={200}
                        placeholder="Final Remarks — max 200 characters"
                        multiline
                        onChange={v => upRemark(r.id, 'text', v)}
                        toast={toast}
                      />
                    </div>
                  </div>
                ))
              )}
              <Tooltip text="Add a new remark band">
                <button className="rs-add" onClick={addRemark}>
                  <i className="fa-solid fa-plus"></i> Add Remark
                </button>
              </Tooltip>
            </>
          )}

          {/* ABSENT */}
          {tab === 'absent' && (
            <>
              <div className="rs-abs-intro">
                Choose how absent subjects affect total marks, percentage and grade calculation on the Result Card.
              </div>
              {[
                {
                  v: 'zero',
                  title: 'Count Absent Subjects as Zero Marks',
                  desc: 'Absent subjects are included in the total marks but scored as 0. The student is assessed out of the full total marks.',
                  chips: ['10 subjects = 200 total', '2 absent → still / 200', 'Card shows: AB / 0'],
                  chipStyle: 'amber',
                },
                {
                  v: 'exclude',
                  title: 'Exclude Absent Subjects from Total Marks',
                  desc: 'Absent subjects are removed from the total entirely. The student is only assessed on subjects they attended.',
                  chips: ['10 subjects = 200 total', '2 absent → / 160', 'Card shows: AB'],
                  chipStyle: 'blue',
                  isDefault: true,
                },
              ].map(opt => {
                const isSel = draftAbsent === opt.v;
                return (
                  <div
                    key={opt.v}
                    className={`rs-abs-opt${isSel ? ' selected' : ''}`}
                    onClick={() => setDraftAbsent(opt.v)}
                  >
                    <div className="rs-abs-radio">
                      <div className="rs-abs-radio-dot" style={{ display: isSel ? 'block' : 'none' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="rs-abs-opt-title">
                        {opt.title}
                        {opt.isDefault && <span className="rs-abs-default">Default</span>}
                      </div>
                      <div className="rs-abs-opt-desc">{opt.desc}</div>
                      <div className="rs-abs-chips">
                        {opt.chips.map((c, ci) => (
                          <span key={ci} className={`rs-abs-chip ${opt.chipStyle}`}>{c}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="exam-modal-footer">
          <Tooltip text="Cancel and close">
            <button className="exam-cancel-btn" onClick={onClose} disabled={loading}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          </Tooltip>
          <Tooltip text="Submit">
            <button className="exam-submit-btn" onClick={submit} disabled={loading}>
              {loading ? (
                <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
              ) : (
                <><i className="fa-solid fa-floppy-disk"></i> Save</>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Nested delete confirmation */}
      {rsConfirm && (
        <div
          className="confirm-overlay open"
          style={{ zIndex: 1100 }}
          onClick={e => { if (e.target === e.currentTarget) setRsConfirm(null); }}
        >
          <div className="confirm-dialog">
            <div className="confirm-glow" style={{ background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }} />
            <div className="confirm-hero">
              <div className="confirm-ring">
                <div className="confirm-icon-wrap" style={{ background: 'rgba(220,38,38,.1)', color: '#DC2626' }}>
                  <i className="fa-solid fa-trash-can"></i>
                </div>
              </div>
            </div>
            <div className="confirm-body">
              <div className="confirm-title">{rsConfirm.title}</div>
              <div className="confirm-msg" dangerouslySetInnerHTML={{ __html: rsConfirm.message }} />
              <div className="confirm-hint">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>This cannot be undone.</span>
              </div>
            </div>
            <div className="confirm-footer">
              <Tooltip text="Cancel and close">
                <button className="confirm-btn confirm-btn--cancel" onClick={() => setRsConfirm(null)}>Cancel</button>
              </Tooltip>
              <Tooltip text="Yes, Delete (confirm)">
                <button className="confirm-btn confirm-btn--confirm" onClick={runDelete}>Yes, Delete</button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CharField({ value, max, placeholder, multiline = false, onChange, toast }) {
  const warnRef  = useRef(false);
  const limitRef = useRef(false);
  const len = (value || '').length;
  const pct = max > 0 ? len / max : 0;
  const barCol = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#D97706' : '#1E40AF';
  const cntCol = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#D97706' : 'var(--text-muted)';
  const bdrCol = pct >= 1 ? '#DC2626' : pct >= 0.8 ? '#D97706' : 'var(--border-light)';
  const barW   = Math.min(100, Math.round(pct * 100));
  const label  = multiline ? 'Final Remarks' : 'Comment';

  const handle = next => {
    const nlen = next.length;
    const npct = max > 0 ? nlen / max : 0;
    if (npct >= 0.8 && npct < 1 && !warnRef.current) {
      warnRef.current  = true;
      limitRef.current = false;
      toast && toast(`${label}: only ${max - nlen} characters remaining.`, 'info');
    }
    if (npct >= 1 && !limitRef.current) {
      limitRef.current = true;
      toast && toast(`${label} limit reached — max ${max} characters.`, 'error');
    }
    if (npct < 0.8) { warnRef.current = false; limitRef.current = false; }
    onChange(next);
  };

  return (
    <div className="rs-cf-wrap">
      {multiline ? (
        <textarea
          className="rs-input rs-input-area"
          maxLength={max}
          placeholder={placeholder}
          value={value || ''}
          onChange={e => handle(e.target.value)}
          style={{ borderColor: bdrCol }}
        />
      ) : (
        <input
          className="rs-input"
          maxLength={max}
          placeholder={placeholder}
          value={value || ''}
          onChange={e => handle(e.target.value)}
          style={{ borderColor: bdrCol }}
        />
      )}
      <div className="rs-cf-meter">
        <div className="rs-cf-bar">
          <div style={{ width: `${barW}%`, background: barCol }} />
        </div>
        <span className="rs-cf-count" style={{ color: cntCol }}>
          {len}/{max}{multiline ? ' chars' : ''}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RESULT SETUP — REPORT PICKER + BUILDER (A4 portrait)
   ═══════════════════════════════════════════════════════════════════ */
function ResultSetupReportPicker({ grades, sigs, remarks, absentMode, onClose, toast }) {
  const [style, setStyle]   = useState('color');
  const [format, setFormat] = useState('pdf');
  const dlLabel = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${format === 'pdf' ? 'PDF' : 'Word'}`;

  const generate = () => {
    if (format === 'word') {
      toast('Word export coming soon', 'info');
    } else {
      generateResultSetupReport({ grades, sigs, remarks, absentMode }, style === 'color');
    }
    onClose();
  };

  return (
    <div className="report-picker-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title">Download Report</div>
              <div className="rp-sub">Result Setup — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div className={`rp-option${style === 'color' ? ' selected' : ''}`} onClick={() => setStyle('color')} role="radio" aria-checked={style === 'color'} tabIndex={style === 'color' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips">
                    <div className="rp-mock-chip" style={{ background: 'rgba(255,255,255,.85)' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCD34D' }}></div>
                    <div className="rp-mock-chip" style={{ background: '#FCA5A5' }}></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6, fontSize: 12 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Full color with brand palette, highlights &amp; icons</div>
              </div>
            </div>
            <div className={`rp-option${style === 'bw' ? ' selected' : ''}`} onClick={() => setStyle('bw')} role="radio" aria-checked={style === 'bw'} tabIndex={style === 'bw' ? 0 : -1} onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle('bw'); } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); } }}>
              <div className="rp-check"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                  <div className="rp-mock-chips-bw">
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                    <div className="rp-mock-chip-bw"></div>
                  </div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Printer-friendly grayscale, no background fills</div>
              </div>
            </div>
          </div>

          <div className="rp-section-label">File Format</div>
          <div className="rp-format-row">
            <button className={`rp-format-pill${format === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFormat('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${format === 'word' ? ' selected-word' : ''}`} onClick={() => setFormat('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="rp-footer">
          <Tooltip text="Cancel and close"><button className="rp-btn cancel" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Generate and download the report"><button className="rp-btn go" onClick={generate}><i className="fa-solid fa-download"></i><span>{dlLabel}</span></button></Tooltip>
        </div>
      </div>
    </div>
  );
}

function generateResultSetupReport({ grades, sigs, remarks, absentMode }, isColor) {
  const aColor = isColor ? '#1E40AF' : '#374151';
  const aBg    = isColor ? '#EFF6FF' : '#F5F5F5';
  const aBdr   = isColor ? '#BFDBFE' : '#DDD';
  const tMuted = isColor ? '#64748B' : '#666';
  const rowEv  = isColor ? '#F8FAFF' : '#F7F7F7';
  const hBg    = isColor ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%)' : '#FFFFFF';
  const accLight = isColor ? '#DBEAFE' : '#E5E5E5';
  const today  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const sectionCard = (icon, title, sub, body) => `
    <div style="margin-bottom:20px;border:1px solid ${aBdr};border-radius:12px;overflow:hidden;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:11px;padding:12px 16px;background:${aBg};border-bottom:1px solid ${aBdr}">
        <div style="width:32px;height:32px;border-radius:8px;background:${accLight};color:${aColor};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div>
          <div style="font-size:13.5px;font-weight:800;color:#0F172A">${title}</div>
          <div style="font-size:10.5px;color:${tMuted};margin-top:1px">${sub}</div>
        </div>
      </div>
      ${body}
    </div>`;

  // Grades table
  const gradesBody = grades.length ? `
    <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px">
      <colgroup><col style="width:40px"><col style="width:60px"><col style="width:90px"><col></colgroup>
      <thead>
        <tr style="background:${aBg}">
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">#</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Grade</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Percentage</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Comment</th>
        </tr>
      </thead>
      <tbody>
        ${grades.map((g, i) => {
          const col = isColor ? (RS_GRADE_COLORS[g.grade] || aColor) : '#555';
          return `
            <tr style="background:${i % 2 === 0 ? '#fff' : rowEv}">
              <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};text-align:center;color:${tMuted};font-weight:700">${i + 1}</td>
              <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};text-align:center">
                <span style="display:inline-flex;min-width:36px;padding:3px 9px;border-radius:6px;background:${col};color:#fff;font-size:11.5px;font-weight:800;justify-content:center">${g.grade}</span>
              </td>
              <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};text-align:center">
                <span style="display:inline-block;padding:2px 9px;border-radius:999px;background:${accLight};color:${aColor};font-size:11px;font-weight:700">${RS_COND_MAP[g.cond] || '≥'} ${g.pct}%</span>
              </td>
              <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};color:#0F172A;font-size:11.5px">${g.comment || '—'}</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>` : `<div style="padding:16px;text-align:center;font-size:12px;color:${tMuted}">No grades configured</div>`;

  // Sigs table
  const sigsBody = sigs.length ? `
    <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px">
      <colgroup><col style="width:40px"><col><col><col style="width:110px"></colgroup>
      <thead>
        <tr style="background:${aBg}">
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">#</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Name</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Designation</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Signature</th>
        </tr>
      </thead>
      <tbody>
        ${sigs.map((s, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : rowEv}">
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};text-align:center;color:${tMuted};font-weight:700">${i + 1}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};font-size:11.5px;font-weight:700;color:#0F172A">${s.name || '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};font-size:11.5px;color:${tMuted}">${s.desig || '—'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};text-align:center">
              ${s.img
                ? `<img src="${s.img}" style="max-height:36px;max-width:100px;object-fit:contain" />`
                : `<span style="display:inline-block;padding:3px 9px;border-radius:6px;background:${accLight};color:${aColor};font-size:11px;font-weight:700">—</span>`}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>` : `<div style="padding:16px;text-align:center;font-size:12px;color:${tMuted}">No signatures added</div>`;

  // Remarks table
  const remarksBody = remarks.length ? `
    <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:12px">
      <colgroup><col style="width:40px"><col style="width:90px"><col style="width:100px"><col></colgroup>
      <thead>
        <tr style="background:${aBg}">
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">#</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Total Marks</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:center;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Percentage</th>
          <th style="padding:8px 10px;font-size:9.5px;font-weight:700;color:${aColor};text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:1.5px solid ${aBdr}">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${remarks.map((r, i) => `
          <tr style="background:${i % 2 === 0 ? '#fff' : rowEv}">
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};text-align:center;color:${tMuted};font-weight:700">${i + 1}</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};font-size:11.5px;color:#0F172A">Total Marks</td>
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};text-align:center">
              <span style="display:inline-block;padding:2px 9px;border-radius:999px;background:${accLight};color:${aColor};font-size:11px;font-weight:700">${RS_COND_MAP[r.cond] || '≥'} ${r.pct}%</span>
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid ${aBdr};font-size:11.5px;color:#0F172A;line-height:1.5">${r.text || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : `<div style="padding:16px;text-align:center;font-size:12px;color:${tMuted}">No remarks configured</div>`;

  // Absent body
  const isZero = absentMode === 'zero';
  const absBody = `
    <div style="padding:14px 16px;display:flex;align-items:flex-start;gap:14px">
      <div style="width:34px;height:34px;border-radius:9px;background:${isZero ? 'rgba(217,119,6,.1)' : 'rgba(30,64,175,.1)'};color:${isZero ? '#B45309' : aColor};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
        <i class="fa-solid ${isZero ? 'fa-calculator' : 'fa-circle-minus'}"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12.5px;font-weight:700;color:#0F172A;margin-bottom:4px">
          ${isZero ? 'Count Absent Subjects as Zero Marks' : 'Exclude Absent Subjects from Total Marks'}
        </div>
        <div style="font-size:11px;color:${tMuted};line-height:1.6">
          ${isZero
            ? 'Absent subjects are scored as 0 and included in the full total. Card shows <strong>AB / 0</strong>.'
            : 'Absent subjects are removed from the total. Student is assessed on attended subjects only. Card shows <strong>AB</strong>.'}
        </div>
      </div>
      <span style="font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:999px;background:${isZero ? 'rgba(217,119,6,.1)' : 'rgba(30,64,175,.1)'};color:${isZero ? '#B45309' : aColor};border:1px solid ${isZero ? 'rgba(217,119,6,.25)' : 'rgba(30,64,175,.25)'};white-space:nowrap">${isZero ? 'AB / 0' : 'AB'}</span>
    </div>`;

  const reportHTML = `
    <div class="page-wrap" style="font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A">
      <div class="${isColor ? '' : 'cl-doc-header'}" style="background:${hBg};color:${isColor ? '#fff' : '#0F172A'};border-radius:0 0 14px 14px;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;min-width:0">
          <div style="width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.25)">🏫</div>
          <div style="min-width:0">
            <div style="font-size:17px;font-weight:800">The Oxford System, Lahore Campus</div>
            <div style="font-size:10.5px;opacity:.75;margin-top:2px">Academic Year 2026–2027</div>
          </div>
        </div>
        <div style="text-align:right;min-width:0">
          <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,.9)">Result Setup Report</div>
          <div style="font-size:10.5px;color:rgba(255,255,255,.65);margin-top:3px">Generated: ${today}</div>
        </div>
      </div>
      <div style="padding:18px 16px 8px">
        ${sectionCard('fa-chart-bar', 'Grades Setup', `${grades.length} grade rule${grades.length !== 1 ? 's' : ''} configured`, gradesBody)}
        ${sectionCard('fa-signature', 'Signatures', `${sigs.length} signature${sigs.length !== 1 ? 's' : ''}`, sigsBody)}
        ${sectionCard('fa-comment-dots', 'Final Remarks', `${remarks.length} remark${remarks.length !== 1 ? 's' : ''} configured`, remarksBody)}
        ${sectionCard('fa-user-xmark', 'Absent Subject Handling', isZero ? 'Mode: Count as Zero' : 'Mode: Exclude from Total', absBody)}
      </div>
      <div style="padding:10px 16px;background:${aBg};border-top:1px solid ${aBdr};display:flex;justify-content:space-between;font-size:10px;color:${tMuted};flex-wrap:wrap;gap:6px">
        <span>School Mentor ERP · Result Setup</span>
        <span>Confidential · The Oxford System, Lahore Campus</span>
      </div>
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Result Setup Report</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;overflow-x:hidden}
body{font-family:'Plus Jakarta Sans','Segoe UI',Arial,sans-serif;color:#0F172A;font-size:12px}
@page{size:A4 portrait;margin:15mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none!important}
  .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
}
.page-wrap{width:100%;max-width:210mm;margin:0 auto;padding:0;overflow:hidden}
table{width:100%;table-layout:fixed}
td,th{overflow-wrap:anywhere;word-break:break-word}
.print-bar{text-align:center;padding:14px;background:#F8FAFF;border-top:1px solid #BFDBFE;margin-top:10px}
.print-bar button{background:linear-gradient(135deg,#1E3A8A,#1E40AF);color:#fff;border:none;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
/* Colorless overrides — recolor white text + decorative fills on the header. */
.cl-doc-header, .cl-doc-header *{color:#0F172A !important;text-shadow:none !important}
.cl-doc-header div[style*="rgba(255,255,255"]{background:transparent !important;border-color:#D1D5DB !important;color:#0F172A !important}
.cl-doc-header [style*="opacity:.75"],
.cl-doc-header [style*="opacity:.65"]{opacity:1 !important;color:#4B5563 !important}
.cl-doc-header [style*="color:rgba(255,255,255,.9)"],
.cl-doc-header [style*="color:rgba(255,255,255,.65)"]{color:#4B5563 !important}
</style></head><body>
${reportHTML}
<div class="print-bar no-print">
  <button onclick="window.print()">🖨 Save as PDF</button>
  <button class="close-btn" onclick="window.close()">Close</button>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=960,height=820');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   REPORT BUILDER — A4 portrait
   ═══════════════════════════════════════════════════════════════════ */
function generateExamReport(ctx, isColor) {
  const { req, exams, term, target } = ctx;
  const list = req.scope === 'all' ? exams.filter(e => e.term === term) : [target];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const time  = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const brand   = isColor ? '#1E40AF' : '#111';
  const muted   = isColor ? '#64748B' : '#555';
  const border  = isColor ? '#BFDBFE' : '#CCC';
  const tHead   = isColor ? '#EFF6FF' : '#EBEBEB';
  const rowAlt  = isColor ? '#F8FAFF' : '#F5F5F5';
  const hdrBg   = isColor ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : 'linear-gradient(135deg,#1a1a1a,#444)';

  const STATUS_COLORS = {
    upcoming: isColor ? { fg: '#D97706', bg: 'rgba(217,119,6,.1)', bd: 'rgba(217,119,6,.25)' } : { fg: '#555', bg: '#EEE', bd: '#CCC' },
    current:  isColor ? { fg: '#16A34A', bg: 'rgba(22,163,74,.1)', bd: 'rgba(22,163,74,.25)' } : { fg: '#333', bg: '#EEE', bd: '#CCC' },
    past:     isColor ? { fg: '#64748B', bg: 'rgba(100,116,139,.1)', bd: 'rgba(100,116,139,.2)' } : { fg: '#777', bg: '#EEE', bd: '#CCC' },
  };

  const rows = list.map((ex, i) => {
    const st  = getExamStatus(ex);
    const sc  = STATUS_COLORS[st.cls];
    const dur = calcDuration(ex.from, ex.to);
    const pillsHtml = ex.classes.map(c =>
      `<span style="display:inline-block;padding:2px 8px;border-radius:99px;background:${isColor ? '#EFF6FF' : '#EEE'};color:${brand};font-size:10px;font-weight:600;border:1px solid ${border};margin:2px 3px 2px 0">${c}</span>`
    ).join('');
    return `
    <tr>
      <td style="color:${muted};font-weight:700;text-align:center">${i + 1}</td>
      <td>
        <div style="font-weight:800;color:${brand};font-size:12px">${ex.name}</div>
        <div style="font-size:10.5px;color:${muted};margin-top:3px">${pillsHtml}</div>
      </td>
      <td style="text-align:center">
        <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;font-size:10.5px;font-weight:700;background:${sc.bg};color:${sc.fg};border:1px solid ${sc.bd}">${st.label}</span>
      </td>
      <td style="text-align:center;color:${muted};font-size:11px">${ex.from || '—'}</td>
      <td style="text-align:center;color:${muted};font-size:11px">${ex.to || '—'}</td>
      <td style="text-align:center;font-weight:700;color:${brand};font-size:11.5px">${dur}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Examination Report — ${req.scope === 'all' ? term + ' Term' : (target ? target.name : '')}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#fff;overflow-x:hidden}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#0F172A;font-size:12px;line-height:1.5}
  @page{size:A4 portrait;margin:15mm}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .no-print{display:none!important}
    .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
  }
  .page-wrap{width:100%;max-width:210mm;margin:0 auto;padding:14mm 15mm 16mm;box-sizing:border-box;overflow:hidden}
  .doc-header{background:${hdrBg};color:#fff;border-radius:0 0 14px 14px;padding:18px 24px 14px;margin-bottom:18px;page-break-inside:avoid}
  .doc-school{font-size:17px;font-weight:800}
  .doc-year{font-size:10.5px;opacity:.75;margin-top:2px}
  .doc-name{font-size:13px;font-weight:700;margin-top:6px;opacity:.95}
  .doc-meta-bar{display:flex;flex-wrap:wrap;gap:0;background:rgba(0,0,0,.15);border-top:1px solid rgba(255,255,255,.1);margin:14px -24px -14px}
  .doc-meta-cell{flex:1;min-width:0;padding:8px 14px;border-right:1px solid rgba(255,255,255,.1);font-size:10.5px;overflow-wrap:anywhere}
  .doc-meta-cell:last-child{border-right:none}
  .doc-meta-key{opacity:.65;font-weight:600;text-transform:uppercase;letter-spacing:.3px;font-size:9px;margin-bottom:2px}
  .doc-meta-val{font-weight:700;font-size:11.5px}
  table{width:100%;table-layout:fixed;border-collapse:collapse;font-size:11px;word-wrap:break-word}
  thead{background:${tHead};display:table-header-group}
  tr{page-break-inside:avoid}
  th{padding:7px 8px;text-align:left;font-size:9.5px;font-weight:800;color:${brand};text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid ${border}}
  td{padding:8px 8px;border-bottom:1px solid ${border};vertical-align:top;overflow-wrap:anywhere}
  tbody tr:nth-child(even) td{background:${rowAlt}}
  .doc-footer{margin-top:18px;padding-top:10px;border-top:1.5px solid ${border};display:flex;justify-content:space-between;align-items:center;font-size:10px;color:${muted};flex-wrap:wrap;gap:6px}
  .doc-footer-logo{font-weight:800;color:${brand}}
  .print-bar{text-align:center;padding:16px;background:#F8FAFC;border-top:1px solid #E2E8F0;margin-top:14px;border-radius:10px}
  .print-bar button{background:${brand};color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
  .print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
</style></head><body>
<div class="page-wrap">
  <div class="doc-header">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <div style="width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:22px;border:1.5px solid rgba(255,255,255,.25);flex-shrink:0">🎓</div>
      <div>
        <div class="doc-school">School Mentor ERP</div>
        <div class="doc-year">Academic Year 2025–2026</div>
        <div class="doc-name">Examination Report — ${req.scope === 'all' ? term + ' Term' : (target ? target.name : '')}</div>
      </div>
    </div>
    <div class="doc-meta-bar">
      <div class="doc-meta-cell"><div class="doc-meta-key">Scope</div><div class="doc-meta-val">${req.scope === 'all' ? 'All Exams (' + list.length + ')' : 'Single Exam'}</div></div>
      <div class="doc-meta-cell"><div class="doc-meta-key">Term</div><div class="doc-meta-val">${term}</div></div>
      <div class="doc-meta-cell"><div class="doc-meta-key">Style</div><div class="doc-meta-val">${isColor ? 'Colorful' : 'Colorless'}</div></div>
      <div class="doc-meta-cell"><div class="doc-meta-key">Generated</div><div class="doc-meta-val">${today} — ${time}</div></div>
    </div>
  </div>

  <table>
    <colgroup>
      <col style="width:38px">
      <col>
      <col style="width:78px">
      <col style="width:76px">
      <col style="width:76px">
      <col style="width:62px">
    </colgroup>
    <thead><tr>
      <th style="text-align:center">#</th>
      <th>Exam Name &amp; Classes</th>
      <th style="text-align:center">Status</th>
      <th style="text-align:center">Start</th>
      <th style="text-align:center">End</th>
      <th style="text-align:center">Duration</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:24px;color:' + muted + '">No exams in this term.</td></tr>'}</tbody>
  </table>

  <div class="doc-footer">
    <span class="doc-footer-logo">🎓 School Mentor ERP — Examination</span>
    <span>Generated: ${today} — ${time}</span>
  </div>

  <div class="print-bar no-print">
    <button onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">Close</button>
  </div>
</div></body></html>`;

  const w = window.open('', '_blank', 'width=960,height=820');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   CSS — verbatim from HTML's #module-exam styles
   ═══════════════════════════════════════════════════════════════════ */
const EXAM_CSS = `
.exam-tabs-row {
  display:flex; gap:4px;
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg);
  padding:5px; margin-bottom:20px;
  box-shadow:var(--shadow-sm);
  overflow-x:auto; flex-wrap:nowrap;
}
.exam-tab {
  flex:1 1 0;
  display:flex; align-items:center; justify-content:center; gap:7px;
  padding:11px 18px; border-radius:var(--radius-md); border:none;
  background:transparent; font-family:var(--font-body);
  font-size:13px; font-weight:600; color:var(--text-muted);
  cursor:pointer; transition:var(--tr); white-space:nowrap;
}
.exam-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
.exam-tab.active {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color:#fff;
  box-shadow:0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}
.exam-tab i { font-size:12px; }

.exam-term-chips { display:flex; align-items:center; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
.exam-term-chip {
  padding:7px 16px; border-radius:var(--radius-full);
  border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-muted);
  font-family:var(--font-body); font-size:12.5px; font-weight:600;
  cursor:pointer; transition:var(--tr);
}
.exam-term-chip:hover { border-color:var(--border-med); color:var(--text-primary); }
.exam-term-chip.active {
  background:linear-gradient(135deg,#EFF6FF,#DBEAFE);
  border-color:#93C5FD; color:#1E40AF; font-weight:700;
  box-shadow:0 2px 8px rgba(30,58,138,.12);
}

/* Export buttons (PDF / Word) — copied verbatim from Academics shared sheet
   so the colors load even when Academics module isn't mounted */
.export-btn {
  display:inline-flex; align-items:center; gap:6px;
  height:32px; padding:0 13px; border-radius:var(--radius-md);
  border:none; font-family:var(--font-body);
  font-size:11.5px; font-weight:700; cursor:pointer; transition:var(--tr);
  white-space:nowrap;
}
.export-btn.pdf  { background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff; box-shadow:0 2px 8px rgba(239,68,68,.3); }
.export-btn.word { background:linear-gradient(135deg,#2563EB,#1E40AF); color:#fff; box-shadow:0 2px 8px rgba(37,99,235,.3); }
.export-btn:hover { transform:translateY(-1px); filter:brightness(1.08); }
.export-btn:active { transform:scale(.96); }

.exam-action-bar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:16px; }
.exam-add-btn {
  display:inline-flex; align-items:center; gap:8px;
  padding:10px 28px; border-radius:var(--radius-full);
  border:none; background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  color:#fff; font-family:var(--font-body); font-size:13.5px; font-weight:700;
  cursor:pointer; transition:var(--tr);
  box-shadow:0 4px 16px rgba(30,58,138,.32), inset 0 1px 0 rgba(255,255,255,.2);
}
.exam-add-btn:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(30,58,138,.42); }
.exam-add-btn:active { transform:scale(.97); }

.exam-table-head {
  display:flex !important;
  padding:0 18px !important;
  background:var(--bg-muted);
  border-bottom:1px solid var(--border-light);
}
.exam-th {
  padding:11px 10px; font-size:10.5px; font-weight:700;
  color:var(--text-muted); letter-spacing:.6px; text-transform:uppercase;
}
.exam-table-head .exam-th:nth-child(1) { width:52px; flex-shrink:0; }
.exam-table-head .exam-th:nth-child(2) { flex:1; }
.exam-table-head .exam-th:nth-child(3) { width:100px; flex-shrink:0; text-align:center; }
.exam-table-head .exam-th:nth-child(4) { width:70px; flex-shrink:0; }
.exam-table-head .exam-th:nth-child(5) { width:150px; flex-shrink:0; }
.exam-table-head .exam-th:nth-child(6) { width:90px; flex-shrink:0; text-align:right; }

.exam-row-wrap { border-bottom:1px solid var(--border-light); }
.exam-row-wrap:last-child { border-bottom:none; }
.exam-row {
  display:flex !important;
  padding:0 18px !important;
  min-height:58px; align-items:center; flex-wrap:nowrap;
  cursor:pointer; transition:var(--tr);
}
.exam-row:hover { background:rgba(30,58,138,.04); }
.exam-row.open { background:var(--bg-muted); }
.exam-td { padding:12px 10px; font-size:13px; color:var(--text-secondary); display:flex; align-items:center; }
.exam-td:nth-child(1) { width:52px; flex-shrink:0; }
.exam-td:nth-child(2) { flex:1; min-width:0; }
.exam-td:nth-child(3) { width:100px; flex-shrink:0; justify-content:center; }
.exam-td:nth-child(4) { width:70px; flex-shrink:0; }
.exam-td:nth-child(5) { width:150px; flex-shrink:0; gap:6px; flex-wrap:nowrap; }
.exam-td:nth-child(6) { width:90px; flex-shrink:0; justify-content:flex-end; gap:6px; }
.exam-td.sno { color:var(--text-muted); font-weight:600; }
.exam-td.name { font-weight:700; color:var(--text-primary); gap:8px; }
.exam-td.name > div > div:last-child { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.exam-name-icon {
  width:28px; height:28px; border-radius:7px;
  background:linear-gradient(135deg,rgba(30,58,138,.12),rgba(30,58,138,.2));
  color:#1E40AF; display:flex; align-items:center; justify-content:center;
  font-size:11px; flex-shrink:0;
}

.exam-status-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:var(--radius-full);
  font-size:10.5px; font-weight:700; letter-spacing:.3px; flex-shrink:0;
}
.exam-status-badge.upcoming { background:rgba(217,119,6,.1);   color:#D97706; border:1px solid rgba(217,119,6,.25); }
.exam-status-badge.current  { background:rgba(22,163,74,.1);    color:#16A34A; border:1px solid rgba(22,163,74,.25); }
.exam-status-badge.past     { background:rgba(100,116,139,.1);  color:#64748B; border:1px solid rgba(100,116,139,.2); }
.exam-status-badge i { font-size:9px; }

.exam-edit-btn {
  display:flex; align-items:center; gap:5px;
  padding:6px 12px; border-radius:var(--radius-md);
  border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-secondary);
  font-family:var(--font-body); font-size:11.5px; font-weight:700;
  cursor:pointer; transition:var(--tr);
}
.exam-edit-btn:hover { border-color:#1E40AF; color:#1E40AF; background:rgba(30,58,138,.05); }

.exam-del-btn {
  width:30px; height:30px; border-radius:8px;
  border:1.5px solid rgba(220,38,38,.2);
  background:rgba(220,38,38,.05); color:var(--error);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; cursor:pointer; transition:var(--tr);
}
.exam-del-btn:hover { background:rgba(220,38,38,.12); border-color:var(--error); }

.exam-expand-btn {
  width:30px; height:30px; border-radius:8px;
  border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-muted);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; cursor:pointer; transition:var(--tr);
}
.exam-expand-btn:hover { border-color:#1E40AF; color:#1E40AF; }
.exam-expand-btn.open { transform:rotate(180deg); border-color:#1E40AF; color:#1E40AF; }

.exam-detail {
  background:linear-gradient(135deg,rgba(30,58,138,.02),rgba(30,58,138,.05));
  border-top:1px solid var(--border-light);
  max-height:0; overflow:hidden;
  transition:max-height .4s cubic-bezier(.4,0,.2,1);
}
.exam-detail-item { display:flex; align-items:flex-start; gap:10px; }
.exam-detail-icon {
  width:34px; height:34px; border-radius:9px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:13px; margin-top:1px;
}
.exam-detail-label {
  font-size:10px; color:var(--text-muted); font-weight:700;
  text-transform:uppercase; letter-spacing:.5px; margin-bottom:3px;
}
.exam-detail-val { font-size:12.5px; color:var(--text-primary); font-weight:700; line-height:1.4; }
.exam-detail-val.classes-list { display:flex; flex-wrap:wrap; gap:4px; margin-top:2px; }
.exam-class-pill {
  display:inline-block; padding:2px 8px; border-radius:var(--radius-full);
  background:var(--brand-light); color:var(--brand-primary);
  font-size:10.5px; font-weight:600; border:1px solid var(--border-med);
}

/* Modal */
.exam-modal-overlay {
  position:fixed; inset:0; background:rgba(10,22,40,.55);
  backdrop-filter:blur(5px); z-index:1000;
  display:none; align-items:center; justify-content:center; padding:20px;
}
.exam-modal-overlay.open { display:flex; }
.exam-modal {
  background:var(--bg-card); border-radius:var(--radius-xl);
  width:100%; max-width:620px; max-height:90vh; overflow-y:auto;
  box-shadow:var(--shadow-xl); border:1px solid var(--border-light);
  animation:modalIn .28s cubic-bezier(.34,1.26,.64,1) both;
}
@keyframes modalIn { from{opacity:0;transform:scale(.96) translateY(10px)} to{opacity:1;transform:none} }
.exam-modal-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:20px 24px 16px; border-bottom:1px solid var(--border-light);
  background:linear-gradient(135deg,rgba(30,58,138,.04),transparent);
}
.exam-modal-header-left { display:flex; align-items:center; gap:12px; }
.exam-modal-header-icon {
  width:40px; height:40px; border-radius:11px;
  background:linear-gradient(135deg,rgba(30,58,138,.15),rgba(30,58,138,.25));
  color:#1E40AF; font-size:17px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.exam-modal-title { font-size:16.5px; font-weight:800; color:#1E40AF; letter-spacing:-.02em; }
.exam-modal-sub { font-size:12px; color:var(--text-muted); margin-top:2px; }
.exam-modal-close {
  width:30px; height:30px; border-radius:8px; border:none;
  background:var(--bg-muted); color:var(--text-muted);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:13px; transition:var(--tr); flex-shrink:0;
}
.exam-modal-close:hover { background:rgba(220,38,38,.1); color:var(--error); }
.exam-modal-body { padding:20px 24px 24px; }
.exam-modal-footer {
  display:flex; gap:9px; justify-content:flex-end;
  padding:14px 24px; border-top:1px solid var(--border-light);
}
.exam-cancel-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  height:40px; padding:0 20px; border-radius:var(--radius-md);
  border:1.5px solid var(--border-light);
  background:var(--bg-muted); color:var(--text-secondary);
  font-family:var(--font-body); font-size:13px; font-weight:600;
  cursor:pointer; transition:var(--tr);
}
.exam-cancel-btn:hover { background:var(--bg-card); color:var(--text-primary); border-color:var(--border-med); }
.exam-submit-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  height:40px; padding:0 20px; border-radius:var(--radius-md);
  border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-family:var(--font-body); font-size:13px; font-weight:700;
  cursor:pointer; transition:var(--tr);
  box-shadow:0 4px 14px rgba(30,58,138,.28), inset 0 1px 0 rgba(255,255,255,.15);
}
.exam-submit-btn:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(30,58,138,.4); }
.exam-submit-btn:active { transform:scale(.97); }

.exam-date-field { position:relative; }
.exam-date-field .exam-field-icon {
  position:absolute; left:12px; top:50%; transform:translateY(-50%);
  color:var(--text-muted); font-size:13px; pointer-events:none; z-index:1;
}
.exam-date-field .form-input { padding-left:36px !important; }
.exam-name-field { position:relative; }
.exam-name-field .exam-field-icon {
  position:absolute; left:12px; top:50%; transform:translateY(-50%);
  color:var(--text-muted); font-size:13px; pointer-events:none; z-index:1;
}
.exam-name-field .form-input { padding-left:36px !important; }

.exam-class-select-wrap {
  border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  background:var(--input-bg); min-height:42px; padding:4px 8px;
  display:flex; flex-wrap:wrap; gap:6px; align-items:center; cursor:text;
  transition:var(--tr);
}
.exam-class-select-wrap:focus-within { border-color:#1E40AF; box-shadow:0 0 0 3px rgba(30,58,138,.1); }
.exam-class-tag {
  display:inline-flex; align-items:center; gap:5px;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; border-radius:var(--radius-full);
  padding:3px 10px; font-size:11.5px; font-weight:600;
}
.exam-class-tag-x {
  background:none; border:none; color:rgba(255,255,255,.8);
  cursor:pointer; font-size:10px; padding:0; line-height:1;
  display:flex; align-items:center; justify-content:center;
}
.exam-class-tag-x:hover { color:#fff; }
.exam-class-input {
  border:none; outline:none; background:transparent;
  font-family:var(--font-body); font-size:13px; color:var(--text-primary);
  min-width:80px; flex:1; padding:4px 2px;
}
.exam-class-dropdown {
  position:absolute; left:0; right:0; top:calc(100% + 4px);
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-md); box-shadow:var(--shadow-lg);
  z-index:200; max-height:200px; overflow-y:auto;
  display:none;
}
.exam-class-dropdown.open { display:block; }
.exam-class-option {
  padding:9px 14px; font-family:var(--font-body);
  font-size:13px; font-weight:500; color:var(--text-primary);
  cursor:pointer; transition:var(--tr);
  display:flex; align-items:center; gap:8px;
}
.exam-class-option:hover { background:rgba(30,58,138,.06); color:#1E40AF; }
.exam-class-option.selected { color:#1E40AF; }
.exam-class-option.selected::before {
  content:''; display:inline-block; width:6px; height:6px;
  border-radius:50%; background:#1E40AF;
}

/* Coming Soon */
.exam-no-data-card {
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px;
  padding:80px 40px; text-align:center;
  background:var(--bg-card); border-radius:var(--radius-lg);
  border:1.5px solid var(--border-light); box-shadow:var(--shadow-sm);
}
.exam-nd-icon-wrap { position:relative; width:80px; height:80px; display:flex; align-items:center; justify-content:center; }
.exam-nd-rings { position:absolute; inset:0; }
.exam-nd-ring { position:absolute; border-radius:50%; border:2px solid; }
.exam-nd-ring1 { inset:0; border-color:rgba(30,58,138,.2); animation:examRingPulse 2.4s ease-in-out infinite; }
.exam-nd-ring2 { inset:-10px; border-color:rgba(30,58,138,.1); animation:examRingPulse 2.4s ease-in-out .4s infinite; }
@keyframes examRingPulse { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.12);opacity:.3} }
.exam-nd-icon {
  width:64px; height:64px; border-radius:50%;
  background:linear-gradient(135deg,rgba(30,58,138,.12),rgba(30,58,138,.22));
  color:#1E40AF; font-size:26px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 4px 18px rgba(30,58,138,.2);
  position:relative; z-index:1;
}
.exam-nd-title { font-size:18px; font-weight:800; color:var(--text-primary); letter-spacing:-.02em; }
.exam-nd-sub { font-size:13px; color:var(--text-muted); max-width:320px; line-height:1.5; }

/* Dark theme parity */
[data-theme="dark"] .exam-status-badge.upcoming { background:rgba(217,119,6,.15); color:#FBBF24; border-color:rgba(217,119,6,.3); }
[data-theme="dark"] .exam-status-badge.current  { background:rgba(22,163,74,.15); color:#4ADE80; border-color:rgba(22,163,74,.3); }
[data-theme="dark"] .exam-status-badge.past     { background:rgba(100,116,139,.15); color:#94A3B8; border-color:rgba(100,116,139,.25); }
[data-theme="dark"] .exam-class-pill { background:rgba(59,130,246,.12); color:#93C5FD; border-color:var(--border-med); }
[data-theme="dark"] .exam-cancel-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .exam-cancel-btn:hover { background:var(--bg-card); color:#E2E8F8; }

/* Responsive */
@media (max-width:768px) {
  .exam-table-head, .exam-row { padding:0 10px !important; }
  .exam-table-head .exam-th:nth-child(3), .exam-td:nth-child(3) { display:none; }
  .exam-table-head .exam-th:nth-child(4), .exam-td:nth-child(4) { width:60px; }
  .exam-table-head .exam-th:nth-child(5), .exam-td:nth-child(5) { width:120px; }
  .exam-table-head .exam-th:nth-child(6), .exam-td:nth-child(6) { width:70px; }
  .exam-action-bar { flex-direction:column; align-items:stretch; }
  .exam-action-bar > div { justify-content:flex-end; }
  .exam-tab { padding:9px 12px; font-size:12px; }
}
@media (max-width:480px) {
  .exam-table-head .exam-th:nth-child(5), .exam-td:nth-child(5) { display:none; }
  .exam-td:nth-child(1), .exam-table-head .exam-th:nth-child(1) { width:36px; }
  .exam-td:nth-child(4), .exam-table-head .exam-th:nth-child(4) { width:60px; }
  .exam-td:nth-child(6), .exam-table-head .exam-th:nth-child(6) { width:70px; }
}
/* ── Report picker: collapse 2-col grids on phones so the modal fits ── */
@media (max-width:520px) {
  .rp-options, .rp-format-row { grid-template-columns:1fr; gap:10px; }
  .rp-footer { grid-template-columns:1fr 1fr; padding:14px 18px 18px; }
  .rp-header { padding:18px 18px 14px; }
  .rp-body { padding:18px 18px 16px; }
  .rp-btn { height:42px; font-size:13px; }
}
/* ── Modal shells must not overflow the viewport on tablet/phone ── */
@media (max-width:820px) {
  .exam-modal,
  .exam-modal.ds-edit-modal,
  .exam-modal.syl-edit-modal,
  .exam-modal.rs-modal,
  .report-picker,
  .rc-preview-shell { max-width:96vw !important; }
}

/* ══════════════════════════════════════════════════
   Shared Confirm Dialog (Academics-style) — verbatim
══════════════════════════════════════════════════ */
.confirm-overlay {
  position:fixed; inset:0;
  background:rgba(10,22,40,.55); backdrop-filter:blur(8px);
  z-index:9999; display:none;
  align-items:center; justify-content:center; padding:20px;
}
.confirm-overlay.open { display:flex; }
.confirm-dialog {
  background:var(--bg-card); border-radius:24px;
  width:100%; max-width:380px;
  border:1px solid var(--border-light);
  box-shadow:0 30px 80px rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.1);
  animation:confirmIn .32s cubic-bezier(.34,1.3,.64,1) both;
  overflow:hidden; position:relative;
}
@keyframes confirmIn { from{opacity:0;transform:scale(.88) translateY(20px)} to{opacity:1;transform:none} }
.confirm-glow { position:absolute; top:0; left:0; right:0; height:3px; border-radius:24px 24px 0 0; }
.confirm-hero {
  display:flex; flex-direction:column; align-items:center;
  padding:32px 28px 10px;
  background:linear-gradient(180deg,rgba(220,38,38,.03),transparent);
}
.confirm-ring { position:relative; width:80px; height:80px; display:flex; align-items:center; justify-content:center; }
.confirm-ring::before {
  content:''; position:absolute; inset:0; border-radius:50%;
  border:2px solid transparent; border-top-color:#EF4444; border-right-color:#EF4444;
  animation:confirmRing 3s linear infinite; opacity:.4;
}
@keyframes confirmRing { to{transform:rotate(360deg)} }
.confirm-icon-wrap {
  width:60px; height:60px; border-radius:18px;
  display:flex; align-items:center; justify-content:center;
  font-size:24px; position:relative; z-index:1;
  box-shadow:0 8px 24px rgba(220,38,38,.2);
  transition:all .3s ease;
}
.confirm-body { padding:16px 28px 8px; text-align:center; }
.confirm-title { font-size:20px; font-weight:800; color:var(--text-primary); margin-bottom:10px; letter-spacing:-.02em; }
.confirm-msg { font-size:13.5px; color:var(--text-muted); line-height:1.75; margin-bottom:14px; }
.confirm-msg strong { color:var(--text-primary); font-weight:700; }
.confirm-hint {
  display:flex; align-items:flex-start; gap:9px; text-align:left;
  padding:11px 14px; border-radius:12px;
  background:rgba(220,38,38,.05); border:1px solid rgba(220,38,38,.15);
  font-size:12px; font-weight:600; color:#991B1B; line-height:1.5;
}
.confirm-hint i { color:#DC2626; font-size:13px; flex-shrink:0; margin-top:1px; }
.confirm-footer { display:grid; grid-template-columns:1fr 1.4fr; gap:10px; padding:20px 28px 28px; }
.confirm-btn {
  display:flex; align-items:center; justify-content:center; gap:8px;
  height:46px; border-radius:12px; border:none; cursor:pointer;
  font-family:var(--font-body); font-size:14px; font-weight:700;
  transition:all .2s cubic-bezier(.4,0,.2,1); letter-spacing:.01em;
}
.confirm-btn--cancel {
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  color:var(--text-muted);
}
.confirm-btn--cancel:hover { background:var(--bg-card); color:var(--text-primary); border-color:var(--border-med); }
.confirm-btn--confirm {
  background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff;
  box-shadow:0 4px 14px rgba(220,38,38,.35), inset 0 1px 0 rgba(255,255,255,.2);
}
.confirm-btn--confirm:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(220,38,38,.5); }
.confirm-btn:active { transform:scale(.97) translateY(0)!important; }

/* ══════════════════════════════════════════════════
   Shared Report Picker (Academics-style) — verbatim
══════════════════════════════════════════════════ */
.report-picker-overlay {
  position:fixed; inset:0;
  background:rgba(10,22,40,.5); backdrop-filter:blur(8px);
  z-index:2000; display:none;
  align-items:center; justify-content:center; padding:20px;
}
.report-picker-overlay.open { display:flex; }
.report-picker {
  background:var(--bg-card); border-radius:24px;
  width:100%; max-width:460px;
  border:1px solid var(--border-light);
  box-shadow:var(--shadow-xl);
  animation:modalIn .28s cubic-bezier(.34,1.26,.64,1) both;
  overflow:hidden;
}
.rp-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:22px 24px 18px; border-bottom:1px solid var(--border-light);
  background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);
}
.rp-header-left { display:flex; align-items:center; gap:12px; }
.rp-header-icon {
  width:40px; height:40px; border-radius:11px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; font-size:17px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.rp-title { font-size:16px; font-weight:800; color:var(--text-primary); letter-spacing:-.01em; }
.rp-sub { font-size:11.5px; color:var(--text-muted); margin-top:2px; }
.rp-close {
  width:30px; height:30px; border-radius:8px; border:none;
  background:var(--bg-muted); color:var(--text-muted);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:12px; transition:var(--tr); flex-shrink:0;
}
.rp-close:hover { background:rgba(220,38,38,.1); color:var(--error); }
.rp-body { padding:22px 24px 20px; }
.rp-section-label {
  font-size:10px; font-weight:800; letter-spacing:1.2px;
  text-transform:uppercase; color:var(--text-muted);
  margin-bottom:14px; display:flex; align-items:center; gap:8px;
}
.rp-section-label::after { content:''; flex:1; height:1px; background:var(--border-light); }
.rp-options { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:24px; }
.rp-option {
  border:2px solid var(--border-light); border-radius:16px;
  cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1);
  background:var(--bg-card); overflow:hidden; position:relative;
}
.rp-option:hover { border-color:var(--border-med); transform:translateY(-2px); box-shadow:var(--shadow-md); }
.rp-option.selected {
  border-color:var(--brand-primary);
  box-shadow:0 0 0 3px rgba(30,58,138,.12), var(--shadow-md);
  transform:translateY(-2px);
}
.rp-check {
  position:absolute; top:10px; right:10px;
  width:22px; height:22px; border-radius:50%;
  background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  color:#fff; font-size:9px;
  display:none; align-items:center; justify-content:center;
  box-shadow:0 3px 8px rgba(30,58,138,.4); z-index:2;
}
.rp-option.selected .rp-check { display:flex; }
.rp-preview { height:110px; position:relative; overflow:hidden; }
.rp-preview-color {
  width:100%; height:100%;
  background:linear-gradient(145deg,#1E3A8A 0%,#1E40AF 45%,#2563EB 100%);
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; padding:14px; position:relative; overflow:hidden;
}
.rp-preview-color::before { content:''; position:absolute; top:-20px; right:-20px; width:80px; height:80px; border-radius:50%; background:rgba(255,255,255,.06); }
.rp-preview-color::after  { content:''; position:absolute; bottom:-15px; left:-10px; width:60px; height:60px; border-radius:50%; background:rgba(14,165,233,.15); }
.rp-mock-header { width:80%; height:7px; border-radius:4px; background:rgba(255,255,255,.9); position:relative; z-index:1; }
.rp-mock-line   { border-radius:3px; background:rgba(255,255,255,.5); position:relative; z-index:1; }
.rp-mock-chips  { display:flex; gap:5px; position:relative; z-index:1; margin-top:2px; }
.rp-mock-chip   { width:28px; height:9px; border-radius:4px; }
/* Colorless preview — paper-white look matches the dedicated low-ink
   variant we actually print. White bg, dark gray header band, light
   gray lines, bordered chips (no fills). */
.rp-preview-bw {
  width:100%; height:100%;
  background:#FFFFFF;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; padding:14px;
  border-bottom:1px solid #E5E7EB;
}
.rp-mock-header-bw { width:80%; height:7px; border-radius:2px; background:#1F2937; }
.rp-mock-line-bw   { border-radius:2px; background:#9CA3AF; }
.rp-mock-chips-bw  { display:flex; gap:5px; margin-top:2px; }
.rp-mock-chip-bw   { width:28px; height:9px; border-radius:2px; background:transparent; border:1px solid #9CA3AF; }
[data-theme="dark"] .rp-preview-bw { background:#F8FAFC; border-bottom-color:#CBD5E1; }
[data-theme="dark"] .rp-mock-header-bw { background:#1F2937; }
[data-theme="dark"] .rp-mock-line-bw { background:#94A3B8; }
[data-theme="dark"] .rp-mock-chip-bw { border-color:#94A3B8; }
/* Keyboard focus ring on radio-style options */
.rp-option:focus-visible {
  outline:none;
  box-shadow:0 0 0 3px rgba(30,58,138,.18), var(--shadow-md);
  border-color:var(--brand-primary);
}
[data-theme="dark"] .rp-option:focus-visible {
  box-shadow:0 0 0 3px rgba(59,130,246,.32), var(--shadow-md);
  border-color:#3B82F6;
}
.rp-option-text { padding:12px 14px; }
.rp-option-name { font-size:13px; font-weight:800; color:var(--text-primary); margin-bottom:3px; }
.rp-option-desc { font-size:11px; color:var(--text-muted); line-height:1.45; }
.rp-format-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:6px; }
.rp-format-pill {
  display:flex; align-items:center; gap:10px;
  padding:12px 14px; border-radius:12px;
  border:2px solid var(--border-light); background:var(--bg-muted);
  cursor:pointer; transition:var(--tr);
  font-family:var(--font-body); text-align:left;
}
.rp-format-pill:hover { border-color:var(--border-med); background:var(--bg-card); }
.rp-format-pill.selected-pdf  { border-color:#DC2626; background:rgba(220,38,38,.05); }
.rp-format-pill.selected-word { border-color:#1E40AF; background:rgba(30,64,175,.05); }
.rp-format-icon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.rp-format-pill.selected-pdf  .rp-format-icon { background:rgba(220,38,38,.1); color:#DC2626; }
.rp-format-pill.selected-word .rp-format-icon { background:rgba(30,64,175,.1); color:#1E40AF; }
.rp-format-pill:not(.selected-pdf):not(.selected-word) .rp-format-icon { background:var(--bg-card); color:var(--text-muted); }
.rp-format-name { font-size:13px; font-weight:700; color:var(--text-primary); }
.rp-format-desc { font-size:10.5px; color:var(--text-muted); margin-top:1px; }
.rp-format-pill.selected-pdf  .rp-format-name { color:#DC2626; }
.rp-format-pill.selected-word .rp-format-name { color:#1E40AF; }
.rp-footer {
  display:grid; grid-template-columns:1fr 1.6fr; gap:10px;
  padding:16px 24px 24px; border-top:1px solid var(--border-light);
}
.rp-btn {
  display:flex; align-items:center; justify-content:center; gap:8px;
  height:46px; border-radius:12px; border:none; cursor:pointer;
  font-family:var(--font-body); font-size:14px; font-weight:700; transition:var(--tr);
}
.rp-btn.cancel {
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  color:var(--text-muted);
}
.rp-btn.cancel:hover { background:var(--bg-card); color:var(--text-primary); }
.rp-btn.go {
  background:linear-gradient(135deg,#1D4ED8,#1E3A8A); color:#fff;
  box-shadow:0 4px 14px rgba(30,58,138,.32), inset 0 1px 0 rgba(255,255,255,.2);
}
.rp-btn.go:hover { transform:translateY(-1px); box-shadow:0 8px 22px rgba(30,58,138,.45); }
.rp-btn.go:active { transform:scale(.97); }

/* ═══════════════════════════════════════════════════════════════════
   DATE SHEET
   ═══════════════════════════════════════════════════════════════════ */
.ds-exam-btn {
  display:inline-flex; align-items:center; gap:8px;
  padding:9px 16px; background:var(--bg-card); color:var(--text-primary);
  border:1.5px solid var(--border-light); border-radius:10px;
  font-weight:700; font-size:12.5px; cursor:pointer;
  transition:all .2s ease; position:relative;
}
.ds-exam-btn:hover {
  background:#EFF6FF; border-color:#BFDBFE; color:#1E40AF;
  transform:translateY(-1px); box-shadow:0 4px 12px rgba(30,64,175,.12);
}
.ds-exam-btn.active {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
  border-color:#1E40AF; box-shadow:0 6px 18px rgba(30,64,175,.32);
}
.ds-has-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 9px; border-radius:999px;
  font-size:10.5px; font-weight:700;
  background:rgba(16,185,129,.12); color:#059669;
}
.ds-has-badge i { font-size:10px; }

.ds-empty {
  padding:42px 24px; text-align:center;
  color:var(--text-muted); font-size:13px;
}
.ds-empty i { font-size:28px; color:#CBD5E1; margin-bottom:10px; display:block; }

.ds-table-head {
  display:grid;
  grid-template-columns: 60px 1.4fr 60px 120px 110px 220px 90px;
  background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border:1px solid var(--border-light); border-bottom:none;
  border-radius:10px 10px 0 0;
  padding:11px 14px; gap:10px;
  font-size:10.5px; font-weight:800; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.5px;
}
.ds-th { font-size:10.5px; font-weight:800; }
.ds-row-wrap { background:transparent; }
.ds-row-wrap:last-child .ds-row:not(.open) { border-radius:0 0 10px 10px; }
.ds-row-wrap:last-child .ds-detail.open { border-radius:0 0 10px 10px; }
.ds-row {
  display:grid;
  grid-template-columns: 60px 1.4fr 60px 120px 110px 220px 90px;
  align-items:center; gap:10px;
  padding:13px 14px;
  background:var(--bg-card);
  border:1px solid var(--border-light); border-top:none;
  font-size:12.5px; cursor:pointer;
  transition:background .15s ease;
}
.ds-row:hover { background:#F8FAFF; }
.ds-row.open { background:#EFF6FF; }

.ds-td.cls-name { display:flex; align-items:center; gap:9px; min-width:0; }
.ds-td.cls-name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.ds-cls-icon {
  width:32px; height:32px; border-radius:8px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; display:flex; align-items:center; justify-content:center;
  font-size:13px; font-weight:800; flex-shrink:0;
}
.ds-td { color:var(--text-primary); font-weight:600; }
.ds-td.muted { color:var(--text-muted); font-weight:500; }
.ds-td .pill {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 9px; border-radius:999px;
  font-size:10.5px; font-weight:700;
}
.ds-td .pill.ready  { background:rgba(16,185,129,.12); color:#059669; }
.ds-td .pill.empty  { background:rgba(148,163,184,.18); color:#475569; }

.ds-actions-cell { display:flex; gap:6px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }

/* Icon-only square buttons (delete + expand chevron) */
.ds-del-btn, .ds-expand-btn, .ds-bell-btn {
  width:32px; height:32px; border-radius:8px;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:12.5px; cursor:pointer; flex-shrink:0;
  border:1.5px solid transparent;
  transition:all .18s ease;
}
.ds-del-btn { background:rgba(220,38,38,.1); color:#DC2626; }
.ds-del-btn:hover { background:#DC2626; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(220,38,38,.3); }

.ds-expand-btn { background:var(--bg-muted); color:var(--text-muted); }
.ds-expand-btn:hover { background:var(--text-primary); color:#fff; }
.ds-expand-btn.open { background:#1E40AF; color:#fff; border-color:#1E40AF; }
.ds-expand-btn i { transition:transform .25s ease; }
.ds-expand-btn.open i { transform:rotate(180deg); }

.ds-bell-btn { background:rgba(245,158,11,.12); color:#D97706; }
.ds-bell-btn:hover { background:#D97706; color:#fff; }

/* Pill buttons with icon + label (Edit / Basic PDF / Copy) */
.ds-edit-btn, .ds-copy-btn, .ds-report-btn, .ds-copy-row-btn {
  display:inline-flex; align-items:center; gap:6px;
  height:32px; padding:0 12px;
  border-radius:8px;
  font-size:11.5px; font-weight:700; line-height:1;
  cursor:pointer; white-space:nowrap;
  border:1.5px solid transparent;
  transition:all .18s ease;
}
.ds-edit-btn i, .ds-copy-btn i, .ds-report-btn i, .ds-copy-row-btn i { font-size:11px; }

.ds-edit-btn { background:rgba(30,64,175,.1); color:#1E40AF; }
.ds-edit-btn:hover { background:#1E40AF; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(30,64,175,.3); }

.ds-copy-btn { background:rgba(99,102,241,.1); color:#4F46E5; }
.ds-copy-btn:hover { background:#4F46E5; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(99,102,241,.3); }

.ds-report-btn { background:rgba(220,38,38,.1); color:#DC2626; }
.ds-report-btn:hover { background:#DC2626; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(220,38,38,.3); }

.ds-copy-row-btn { background:rgba(30,64,175,.1); color:#1E40AF; }
.ds-copy-row-btn:hover { background:#1E40AF; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(30,64,175,.3); }

.ds-detail {
  background:#F8FAFF;
  border:1px solid var(--border-light); border-top:none;
  max-height:0; padding:0 18px; overflow:hidden;
  transition: max-height .28s ease, padding .28s ease;
}
.ds-detail.open {
  max-height:2000px; padding:14px 18px;
}
.ds-detail-inner { animation:dsSlide .22s ease; }
@keyframes dsSlide {
  from { opacity:0; transform:translateY(-4px); }
  to   { opacity:1; transform:translateY(0); }
}

.ds-subj-table-head {
  display:grid;
  grid-template-columns: 50px 2fr 1.2fr 1fr 1fr;
  gap:10px; padding:8px 12px;
  background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border-bottom:1px solid var(--border-light);
  font-size:10px; font-weight:800; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.4px;
}
.ds-subj-th { font-size:10px; font-weight:800; }
.ds-subj-row {
  display:grid;
  grid-template-columns: 50px 2fr 1.2fr 1fr 1fr;
  gap:10px; padding:9px 12px;
  border-bottom:1px solid var(--border-light);
  font-size:12px;
}
.ds-subj-row:last-child { border-bottom:none; }
.ds-subj-row:nth-child(odd) { background:#FCFCFD; }
.ds-subj-td { color:var(--text-secondary); display:flex; align-items:center; }
.ds-subj-td.name { gap:8px; color:var(--text-primary); font-weight:700; }
.ds-subj-icon {
  width:26px; height:26px; border-radius:7px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; display:inline-flex; align-items:center; justify-content:center;
  font-size:11px; flex-shrink:0;
}

/* ── Date Sheet edit modal — uses .exam-modal shell with a wider variant ── */
.exam-modal.ds-edit-modal { max-width:860px; }
.ds-edit-body {
  padding:18px 24px 6px !important;
  max-height:calc(90vh - 170px); overflow-y:auto;
}
.ds-edit-empty {
  text-align:center; padding:32px 16px;
  background:linear-gradient(135deg,rgba(30,58,138,.04),rgba(30,58,138,.02));
  border:1.5px dashed var(--border-light); border-radius:var(--radius-md);
  color:var(--text-secondary);
}
.ds-edit-empty i {
  display:block; font-size:32px; color:#94A3B8; margin-bottom:10px;
}
.ds-edit-empty-sub { font-size:12px; color:var(--text-muted); margin-top:4px; }

.ds-edit-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  padding:0; margin-bottom:12px;
  transition:all .18s ease;
  overflow:hidden;
}
.ds-edit-card:hover { border-color:#BFDBFE; box-shadow:0 4px 14px rgba(30,58,138,.06); }
.ds-edit-card:focus-within {
  border-color:#1E40AF;
  box-shadow:0 0 0 3px rgba(30,64,175,.1), 0 6px 18px rgba(30,58,138,.08);
}

.ds-edit-card-head {
  display:flex; align-items:center; gap:10px;
  padding:10px 14px;
  background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border-bottom:1px solid var(--border-light);
}
.ds-edit-num {
  width:24px; height:24px; border-radius:7px;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-size:11px; font-weight:800;
  display:inline-flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
.ds-edit-card-title {
  flex:1; min-width:0;
  font-size:12.5px; font-weight:700; color:var(--text-primary);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.ds-edit-card-remove {
  width:30px; height:30px; border-radius:8px;
  background:rgba(220,38,38,.1); color:#DC2626;
  border:1.5px solid transparent; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:11.5px; transition:all .18s ease; flex-shrink:0;
}
.ds-edit-card-remove:hover {
  background:#DC2626; color:#fff;
  transform:translateY(-1px); box-shadow:0 4px 10px rgba(220,38,38,.3);
}

.ds-edit-fields {
  display:grid;
  grid-template-columns: 2fr 1.1fr 1fr 1fr;
  gap:12px; padding:14px;
}
.ds-edit-field { display:flex; flex-direction:column; gap:5px; min-width:0; }
.ds-edit-field label {
  font-size:10px; font-weight:800; letter-spacing:.5px;
  text-transform:uppercase; color:var(--text-muted);
}
.ds-edit-input {
  width:100%; padding:9px 11px; font-size:12.5px;
  border:1.5px solid var(--border-light); border-radius:8px;
  background:var(--bg-page); color:var(--text-primary);
  font-family:inherit; transition:all .18s ease;
}
.ds-edit-input:focus {
  outline:none; border-color:#1E40AF;
  background:var(--bg-card);
  box-shadow:0 0 0 3px rgba(30,64,175,.12);
}

.ds-edit-add {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  width:100%; padding:11px 14px; margin:6px 0 14px;
  background:linear-gradient(135deg,rgba(30,58,138,.04),rgba(30,58,138,.08));
  color:#1E40AF;
  border:1.5px dashed #93C5FD; border-radius:var(--radius-md);
  font-family:inherit; font-size:12.5px; font-weight:700;
  cursor:pointer; transition:all .2s ease;
}
.ds-edit-add:hover {
  background:linear-gradient(135deg,rgba(30,58,138,.08),rgba(30,58,138,.14));
  border-color:#1E40AF; border-style:solid;
  transform:translateY(-1px); box-shadow:0 6px 16px rgba(30,58,138,.16);
}
.ds-edit-add i { font-size:11px; }

@media (max-width: 720px) {
  .ds-edit-fields { grid-template-columns: 1fr 1fr; }
  .ds-edit-field-wide { grid-column: 1 / -1; }
}
@media (max-width: 820px) {
  .ds-table-head, .ds-row { grid-template-columns: 50px 1.4fr 60px 110px 100px 200px 80px; }
  .ds-subj-table-head, .ds-subj-row { grid-template-columns: 38px 1.4fr 1fr 1fr 1fr; }
}
@media (max-width: 640px) {
  .ds-table-head { display:none; }
  .ds-row {
    grid-template-columns: 1fr; gap:6px;
    padding:14px;
  }
  .ds-actions-cell { justify-content:flex-start; }
}

body.dark .ds-row { background:var(--bg-card); }
body.dark .ds-row:hover { background:rgba(30,64,175,.08); }
body.dark .ds-detail { background:rgba(30,64,175,.05); }
body.dark .ds-subj-row,
body.dark .ds-subj-table-head { background:var(--bg-card); }
body.dark .ds-subj-row:nth-child(odd) { background:rgba(255,255,255,.02); }
body.dark .ds-edit-input { background:var(--bg-card); color:var(--text-primary); }
body.dark .ds-edit-card { background:var(--bg-card); }
body.dark .ds-edit-card-head,
body.dark .ds-table-head,
body.dark .ds-subj-table-head { background:linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.04)); }
body.dark .ds-exam-btn { background:var(--bg-card); color:var(--text-primary); }
body.dark .ds-exam-btn:hover { background:rgba(30,64,175,.15); border-color:#1E40AF; color:#93C5FD; }

/* ═══════════════════════════════════════════════════════════════════
   SYLLABUS
   ═══════════════════════════════════════════════════════════════════ */
.syl-table-head {
  display:grid;
  grid-template-columns: 60px 1.4fr 60px 130px 90px 100px 90px;
  background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border:1px solid var(--border-light); border-bottom:none;
  border-radius:10px 10px 0 0;
  padding:11px 14px; gap:10px;
  font-size:10.5px; font-weight:800; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.5px;
}
.syl-th { font-size:10.5px; font-weight:800; }
.syl-row-wrap { background:transparent; }
.syl-row-wrap:last-child .syl-row:not(.open) { border-radius:0 0 10px 10px; }
.syl-row-wrap:last-child .syl-detail.open { border-radius:0 0 10px 10px; }
.syl-row {
  display:grid;
  grid-template-columns: 60px 1.4fr 60px 130px 90px 100px 90px;
  align-items:center; gap:10px;
  padding:13px 14px;
  background:var(--bg-card);
  border:1px solid var(--border-light); border-top:none;
  font-size:12.5px; cursor:pointer;
  transition:background .15s ease;
}
.syl-row:hover { background:#F8FAFF; }
.syl-row.open { background:#EFF6FF; }
.syl-td { display:flex; align-items:center; min-width:0; }
.syl-td.cls-name { gap:9px; }
.syl-td.cls-name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.syl-cls-icon {
  width:32px; height:32px; border-radius:8px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE); color:#1E40AF;
  display:flex; align-items:center; justify-content:center;
  font-size:13px; font-weight:800; flex-shrink:0;
}

.syl-status-badge {
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 10px; border-radius:999px;
  font-size:10px; font-weight:700; white-space:nowrap; flex-shrink:0;
}
.syl-status-badge.added    { background:rgba(22,163,74,.1);  color:#16A34A; border:1px solid rgba(22,163,74,.25); }
.syl-status-badge.notadded { background:rgba(217,119,6,.1);  color:#D97706; border:1px solid rgba(217,119,6,.25); }
.syl-status-badge.partial  { background:rgba(30,58,138,.1);  color:#1E40AF; border:1px solid rgba(30,58,138,.2); }

.syl-edit-btn, .syl-report-btn {
  display:inline-flex; align-items:center; gap:6px;
  height:32px; padding:0 12px;
  border-radius:8px;
  font-size:11.5px; font-weight:700; line-height:1;
  cursor:pointer; white-space:nowrap;
  border:1.5px solid transparent; transition:all .18s ease;
}
.syl-edit-btn { background:rgba(30,64,175,.1); color:#1E40AF; }
.syl-edit-btn:hover { background:#1E40AF; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(30,64,175,.3); }
.syl-report-btn { background:rgba(220,38,38,.1); color:#DC2626; }
.syl-report-btn:hover { background:#DC2626; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(220,38,38,.3); }

.syl-del-btn, .syl-expand-btn {
  width:32px; height:32px; border-radius:8px;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:12.5px; cursor:pointer; flex-shrink:0;
  border:1.5px solid transparent; transition:all .18s ease;
}
.syl-del-btn { background:rgba(220,38,38,.1); color:#DC2626; }
.syl-del-btn:hover { background:#DC2626; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(220,38,38,.3); }
.syl-expand-btn { background:var(--bg-muted); color:var(--text-muted); }
.syl-expand-btn:hover { background:var(--text-primary); color:#fff; }
.syl-expand-btn.open { background:#1E40AF; color:#fff; border-color:#1E40AF; }
.syl-expand-btn i { transition:transform .25s ease; }
.syl-expand-btn.open i { transform:rotate(180deg); }

.syl-detail {
  background:#F8FAFF;
  border:1px solid var(--border-light); border-top:none;
  max-height:0; padding:0 18px; overflow:hidden;
  transition: max-height .28s ease, padding .28s ease;
}
.syl-detail.open { max-height:2000px; padding:14px 18px; }

.syl-subj-table-head {
  display:grid;
  grid-template-columns: 50px 1.4fr 2fr 110px 100px;
  gap:10px; padding:8px 12px;
  background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border-bottom:1px solid var(--border-light);
  font-size:10px; font-weight:800; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.4px;
}
.syl-subj-th { font-size:10px; font-weight:800; }
.syl-subj-row {
  display:grid;
  grid-template-columns: 50px 1.4fr 2fr 110px 100px;
  gap:10px; padding:9px 12px;
  border-bottom:1px solid var(--border-light);
  font-size:12px; align-items:center;
}
.syl-subj-row:last-child { border-bottom:none; }
.syl-subj-row:nth-child(odd) { background:#FCFCFD; }
.syl-subj-td { color:var(--text-secondary); display:flex; align-items:center; min-width:0; }
.syl-subj-td.name { gap:8px; color:var(--text-primary); font-weight:700; }
.syl-subj-icon {
  width:24px; height:24px; border-radius:6px;
  background:rgba(30,58,138,.1); color:#1E40AF;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:10px; flex-shrink:0;
}
.syl-summary-text {
  font-size:11.5px; color:var(--text-muted);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;
}
.syl-subj-status { display:inline-flex; align-items:center; gap:5px; font-size:11px; font-weight:700; }
.syl-subj-status .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
.syl-subj-status.completed { color:#16A34A; }
.syl-subj-status.completed .dot { background:#16A34A; }
.syl-subj-status.pending   { color:#D97706; }
.syl-subj-status.pending .dot { background:#D97706; }
.syl-subj-status.partial   { color:#1E40AF; }
.syl-subj-status.partial .dot { background:#1E40AF; }

/* Syllabus modal — RTE */
.syl-subj-tabs {
  display:flex; gap:0; overflow-x:auto;
  border-bottom:2px solid var(--border-light); margin-bottom:14px;
}
.syl-subj-tab {
  padding:10px 18px; font-size:12.5px; font-weight:600;
  color:var(--text-muted); background:transparent; border:none;
  border-bottom:3px solid transparent;
  cursor:pointer; white-space:nowrap; transition:all .18s ease;
  font-family:inherit;
}
.syl-subj-tab:hover { color:#1E40AF; }
.syl-subj-tab.active {
  color:#1E40AF; border-bottom-color:#1E40AF; font-weight:700;
}

.syl-rte-wrap {
  border:1.5px solid var(--border-light); border-radius:10px;
  background:var(--bg-card); overflow:hidden;
}
.syl-rte-toolbar {
  display:flex; align-items:center; gap:4px; flex-wrap:wrap;
  padding:8px 10px; background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border-bottom:1px solid var(--border-light);
}
.syl-tb-btn {
  width:30px; height:30px; border-radius:7px;
  background:transparent; color:var(--text-secondary);
  border:1.5px solid transparent; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:12px; font-family:inherit;
  transition:all .15s ease;
}
.syl-tb-btn:hover { background:var(--bg-page); color:#1E40AF; border-color:var(--border-light); }
.syl-tb-btn b, .syl-tb-btn u, .syl-tb-btn i { font-style:inherit; font-size:13px; }
.syl-tb-divider { width:1px; height:18px; background:var(--border-light); margin:0 3px; }
.syl-tb-select {
  height:30px; padding:0 8px; font-size:12px;
  background:var(--bg-page); color:var(--text-secondary);
  border:1.5px solid var(--border-light); border-radius:7px;
  font-family:inherit; cursor:pointer;
}
.syl-rte-editor {
  min-height:280px; max-height:420px; overflow-y:auto;
  padding:14px 16px; font-size:13.5px; line-height:1.6;
  color:var(--text-primary); outline:none;
  background:var(--bg-page);
}
.syl-rte-editor:empty::before {
  content:attr(data-placeholder);
  color:var(--text-muted); pointer-events:none;
}
.syl-rte-editor:focus { background:var(--bg-card); }
.syl-rte-char-count {
  text-align:right; font-size:10.5px; color:var(--text-muted);
  padding:5px 12px; background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border-top:1px solid var(--border-light);
}

@media (max-width: 820px) {
  .syl-table-head, .syl-row { grid-template-columns: 50px 1.4fr 50px 110px 80px 90px 80px; }
  .syl-subj-table-head, .syl-subj-row { grid-template-columns: 38px 1.2fr 1.4fr 90px 80px; }
}
@media (max-width: 640px) {
  .syl-table-head { display:none; }
  .syl-row { grid-template-columns: 1fr; gap:6px; padding:14px; }
}

body.dark .syl-row { background:var(--bg-card); }
body.dark .syl-row:hover { background:rgba(30,64,175,.08); }
body.dark .syl-row.open { background:rgba(30,64,175,.12); }
body.dark .syl-detail { background:rgba(30,64,175,.05); }
body.dark .syl-subj-row:nth-child(odd) { background:rgba(255,255,255,.02); }
body.dark .syl-table-head,
body.dark .syl-subj-table-head,
body.dark .syl-rte-toolbar,
body.dark .syl-rte-char-count { background:linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.04)); }
body.dark .syl-rte-editor { background:var(--bg-card); color:var(--text-primary); }
body.dark .syl-rte-editor:focus { background:var(--bg-page); }
body.dark .syl-tb-btn { color:var(--text-muted); }
body.dark .syl-tb-btn:hover { background:var(--bg-card); color:#93C5FD; }
body.dark .syl-tb-select { background:var(--bg-card); color:var(--text-primary); }

/* ═══════════════════════════════════════════════════════════════════
   RESULTS — Level-1 sub-tabs + Level-2 inner tabs
   ═══════════════════════════════════════════════════════════════════ */
.res-sub-tabs {
  display:flex; flex-wrap:wrap; gap:8px; margin-bottom:18px;
}
.res-sub-tab {
  padding:9px 18px; font-family:inherit;
  font-size:12.5px; font-weight:600;
  background:var(--bg-card); color:var(--text-secondary);
  border:1.5px solid var(--border-light); border-radius:10px;
  cursor:pointer; transition:all .18s ease;
}
.res-sub-tab:hover { color:#1E40AF; border-color:#BFDBFE; }
.res-sub-tab.active {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
  border-color:transparent;
  box-shadow:0 4px 12px rgba(30,58,138,.3);
}

.rs-l2-tabs {
  display:flex; margin-bottom:18px;
  border-radius:10px; overflow:hidden;
  border:1.5px solid var(--border-light); width:fit-content;
}
.rs-l2-tab {
  padding:9px 22px; font-family:inherit;
  font-size:13px; font-weight:600;
  background:var(--bg-card); color:var(--text-muted);
  border:none; cursor:pointer;
  transition:all .18s ease;
}
.rs-l2-tab + .rs-l2-tab { border-left:1.5px solid var(--border-light); }
.rs-l2-tab:hover { color:#1E40AF; }
.rs-l2-tab.active { background:#1E40AF; color:#fff; }

.rs-edit-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:9px 20px; border-radius:10px;
  border:1.5px solid var(--border-light);
  background:var(--bg-card); color:#1E40AF;
  font-family:inherit; font-size:13px; font-weight:600;
  cursor:pointer; transition:all .2s ease;
}
.rs-edit-btn:hover { background:#1E40AF; color:#fff; border-color:#1E40AF; transform:translateY(-1px); box-shadow:0 4px 12px rgba(30,64,175,.25); }

/* Summary cards */
.rs-card {
  background:var(--bg-card);
  border:1px solid var(--border-light);
  border-radius:14px; overflow:hidden;
  box-shadow:0 2px 8px rgba(15,23,42,.04);
  margin-bottom:16px;
}
.rs-card-head {
  display:flex; align-items:center; gap:12px;
  padding:14px 18px;
  background:var(--bg-muted);
  border-bottom:1px solid var(--border-light);
}
.rs-card-icon {
  width:34px; height:34px; border-radius:8px;
  background:rgba(30,58,138,.1); color:#1E40AF;
  display:flex; align-items:center; justify-content:center;
  font-size:15px; flex-shrink:0;
}
.rs-card-title { font-size:14px; font-weight:700; color:var(--text-primary); }
.rs-empty { padding:20px; text-align:center; color:var(--text-muted); font-size:13px; }

/* Grade table */
.rs-grades-cols, .rs-grade-row {
  display:flex; align-items:center;
  padding:10px 18px;
  font-size:13px;
}
.rs-grades-cols {
  background:var(--bg-muted);
  border-bottom:1px solid var(--border-light);
  font-size:11px; font-weight:700; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.6px;
}
.rs-grade-row { border-bottom:1px solid var(--border-light); }
.rs-grade-row:last-child { border-bottom:none; }
.rs-grades-col.sno   { flex:0 0 52px; }
.rs-grades-col.grade { flex:0 0 80px; }
.rs-grades-col.pct   { flex:1; }
.rs-grades-col.cmt   { flex:2; color:var(--text-secondary); }
.rs-grade-chip {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:36px; padding:3px 9px; border-radius:6px;
  color:#fff; font-size:11px; font-weight:700;
}
.rs-pct-pill {
  display:inline-block; padding:2px 10px; border-radius:999px;
  background:rgba(30,58,138,.1); color:#1E40AF;
  font-size:12px; font-weight:600;
}

/* Sigs table */
.rs-sigs-cols, .rs-sig-row {
  display:flex; align-items:center;
  padding:12px 18px; font-size:13px;
}
.rs-sigs-cols {
  background:var(--bg-muted);
  border-bottom:1px solid var(--border-light);
  font-size:11px; font-weight:700; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.6px;
}
.rs-sig-row { border-bottom:1px solid var(--border-light); }
.rs-sig-row:last-child { border-bottom:none; }
.rs-sigs-col.sno   { flex:0 0 52px; }
.rs-sigs-col.name  { flex:1; font-weight:600; color:var(--text-primary); }
.rs-sigs-col.desig { flex:1; color:var(--text-secondary); }
.rs-sigs-col.sig   { flex:1; }
.rs-sig-initial {
  width:40px; height:36px; border-radius:6px;
  background:rgba(30,58,138,.1); color:#1E40AF;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:14px; font-weight:700;
}

/* Remarks table */
.rs-rem-cols, .rs-rem-row {
  display:flex; align-items:flex-start;
  padding:12px 18px; font-size:13px;
}
.rs-rem-cols {
  background:var(--bg-muted);
  border-bottom:1px solid var(--border-light);
  font-size:11px; font-weight:700; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.6px;
}
.rs-rem-row { border-bottom:1px solid var(--border-light); }
.rs-rem-row:last-child { border-bottom:none; }
.rs-rem-col.sno   { flex:0 0 52px; padding-top:2px; }
.rs-rem-col.total { flex:1; color:var(--text-secondary); padding-top:2px; }
.rs-rem-col.pct   { flex:1; padding-top:2px; }
.rs-rem-col.text  { flex:2; color:var(--text-secondary); line-height:1.55; }

/* Absent summary */
.rs-absent-summary {
  display:flex; align-items:center; gap:12px;
  padding:14px 18px;
}
.rs-abs-icon {
  width:36px; height:36px; border-radius:9px;
  display:flex; align-items:center; justify-content:center;
  font-size:16px; flex-shrink:0;
}
.rs-abs-body { flex:1; min-width:0; }
.rs-abs-title { font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:3px; }
.rs-abs-desc  { font-size:11.5px; color:var(--text-muted); line-height:1.5; }
.rs-abs-badge {
  font-size:11px; font-weight:700; padding:3px 10px;
  border-radius:999px; background:rgba(30,64,175,.1);
  color:#1E40AF; border:1px solid rgba(30,64,175,.25);
  white-space:nowrap; flex-shrink:0;
}
.rs-abs-badge.zero { background:rgba(217,119,6,.1); color:#B45309; border-color:rgba(217,119,6,.25); }

/* ── Result Setup edit modal ── */
.exam-modal.rs-modal { max-width:920px; }
.rs-modal-tabs {
  display:flex; flex-wrap:wrap; gap:0;
  padding:0 22px; margin-top:-4px;
  border-bottom:1px solid var(--border-light);
}
.rs-modal-tab {
  display:inline-flex; align-items:center; gap:7px;
  padding:11px 18px 12px; font-family:inherit;
  font-size:12.5px; font-weight:600;
  background:transparent; border:none;
  border-bottom:2.5px solid transparent;
  color:var(--text-muted); cursor:pointer;
  transition:all .18s ease; margin-bottom:-1px;
}
.rs-modal-tab:hover { color:#1E40AF; }
.rs-modal-tab.active {
  color:#1E40AF; border-bottom-color:#1E40AF;
  font-weight:700;
}
.rs-modal-body { padding:18px 24px 4px !important; max-height:calc(85vh - 220px); overflow-y:auto; }

.rs-input {
  padding:8px 11px; border:1.5px solid var(--border-light);
  border-radius:8px; background:var(--bg-card);
  color:var(--text-primary); font-family:inherit;
  font-size:12.5px; transition:all .18s ease;
  width:100%; box-sizing:border-box; outline:none;
}
.rs-input:focus {
  border-color:#1E40AF;
  box-shadow:0 0 0 3px rgba(30,64,175,.12);
}
.rs-input-area { resize:vertical; min-height:60px; }

.rm-sno {
  font-size:12px; font-weight:700; color:var(--text-muted);
  width:24px; text-align:center; flex-shrink:0;
}
.rs-del {
  width:30px; height:30px; border-radius:7px;
  background:rgba(220,38,38,.08); color:#DC2626;
  border:1.5px solid rgba(220,38,38,.18);
  display:inline-flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all .18s ease; flex-shrink:0;
}
.rs-del:hover { background:#DC2626; color:#fff; border-color:#DC2626; transform:translateY(-1px); box-shadow:0 4px 10px rgba(220,38,38,.3); }

.rm-grade-row {
  display:grid;
  grid-template-columns: 28px 110px 1.2fr 80px 1.4fr 32px;
  gap:10px; align-items:start;
  padding:12px 0; border-bottom:1px solid var(--border-light);
}
.rm-sig-row {
  display:grid;
  grid-template-columns: 28px 1fr 1fr 130px 32px;
  gap:10px; align-items:center;
  padding:12px 0; border-bottom:1px solid var(--border-light);
}
.rm-remark-row { padding:12px 0; border-bottom:1px solid var(--border-light); }
.rm-remark-top {
  display:grid;
  grid-template-columns: 28px 110px 1.2fr 100px 32px;
  gap:10px; align-items:center; margin-bottom:8px;
}
.rs-remark-lbl { font-size:12px; color:var(--text-muted); font-weight:600; }
.rm-remark-bot { padding-left:38px; }

.rs-add {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  width:100%; padding:10px 14px; margin:12px 0 16px;
  background:linear-gradient(135deg,rgba(30,58,138,.04),rgba(30,58,138,.08));
  color:#1E40AF; font-family:inherit;
  border:1.5px dashed #93C5FD; border-radius:10px;
  font-size:12.5px; font-weight:700; cursor:pointer;
  transition:all .2s ease;
}
.rs-add:hover {
  background:linear-gradient(135deg,rgba(30,58,138,.08),rgba(30,58,138,.14));
  border-color:#1E40AF; border-style:solid;
  transform:translateY(-1px); box-shadow:0 6px 16px rgba(30,58,138,.16);
}

.rs-sig-upload {
  width:130px; height:64px; border-radius:8px;
  border:1.5px dashed var(--border-med);
  background:var(--bg-muted);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; overflow:hidden; position:relative;
}
.rs-sig-upload input[type="file"] {
  position:absolute; inset:0; opacity:0; cursor:pointer;
}
.rs-sig-upload img { width:100%; height:100%; object-fit:contain; padding:4px; }
.rs-sig-upload-placeholder {
  display:flex; flex-direction:column; align-items:center; gap:3px;
  font-size:10.5px; color:var(--text-muted);
}
.rs-sig-upload-placeholder i { font-size:16px; }

.rs-cf-wrap { position:relative; min-width:0; }
.rs-cf-meter {
  display:flex; align-items:center; gap:6px; margin-top:4px;
}
.rs-cf-bar {
  flex:1; height:3px; border-radius:2px;
  background:var(--border-light); overflow:hidden;
}
.rs-cf-bar > div { height:100%; transition:.25s; }
.rs-cf-count {
  font-size:9.5px; font-weight:600; min-width:34px;
  text-align:right; white-space:nowrap;
}

/* Absent tab inside modal */
.rs-abs-intro {
  font-size:11.5px; color:var(--text-muted); line-height:1.6;
  padding-bottom:14px; margin-bottom:16px;
  border-bottom:2px solid var(--border-light);
}
.rs-abs-opt {
  display:flex; align-items:flex-start; gap:14px;
  padding:14px 16px; border-radius:10px;
  border:1.5px solid var(--border-light);
  cursor:pointer; transition:all .18s ease;
  margin-bottom:10px;
}
.rs-abs-opt:hover { border-color:#1E40AF; }
.rs-abs-opt.selected { border-color:#1E40AF; background:rgba(30,64,175,.04); }
.rs-abs-radio {
  margin-top:3px; width:18px; height:18px; border-radius:50%;
  border:2px solid #1E40AF;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}
.rs-abs-radio-dot {
  width:8px; height:8px; border-radius:50%; background:#1E40AF;
}
.rs-abs-opt-title {
  font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:4px;
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
}
.rs-abs-default {
  font-size:9.5px; font-weight:700; padding:2px 7px;
  border-radius:999px; background:#1E40AF; color:#fff;
}
.rs-abs-opt-desc {
  font-size:11.5px; color:var(--text-muted); line-height:1.6; margin-bottom:8px;
}
.rs-abs-chips { display:flex; gap:6px; flex-wrap:wrap; }
.rs-abs-chip {
  font-size:10.5px; font-weight:600;
  padding:2px 9px; border-radius:999px;
}
.rs-abs-chip.amber {
  background:rgba(217,119,6,.1); color:#B45309;
  border:1px solid rgba(217,119,6,.2);
}
.rs-abs-chip.blue {
  background:rgba(30,64,175,.1); color:#1E40AF;
  border:1px solid rgba(30,64,175,.2);
}

@media (max-width: 720px) {
  .rm-grade-row { grid-template-columns: 28px 1fr 1fr 32px; }
  .rm-grade-row .rs-input:nth-of-type(3),
  .rm-grade-row .rs-cf-wrap { grid-column: 1 / -1; }
  .rm-sig-row { grid-template-columns: 28px 1fr 32px; }
  .rm-sig-row .rs-input:nth-of-type(2),
  .rm-sig-row .rs-sig-upload { grid-column: 1 / -1; }
  .rm-remark-top { grid-template-columns: 28px 1fr 32px; }
  .rs-grades-cols, .rs-grade-row,
  .rs-sigs-cols, .rs-sig-row,
  .rs-rem-cols, .rs-rem-row {
    flex-wrap:wrap;
  }
}

body.dark .rs-card { background:var(--bg-card); }
body.dark .rs-card-head,
body.dark .rs-grades-cols,
body.dark .rs-sigs-cols,
body.dark .rs-rem-cols { background:rgba(255,255,255,.03); }
body.dark .rs-input { background:var(--bg-card); color:var(--text-primary); }
body.dark .rs-l2-tab { background:var(--bg-card); color:var(--text-muted); }
body.dark .rs-l2-tab.active { background:#1E40AF; color:#fff; }
body.dark .res-sub-tab { background:var(--bg-card); color:var(--text-muted); }
body.dark .res-sub-tab:hover { color:#93C5FD; border-color:#1E40AF; }
body.dark .rs-edit-btn { background:var(--bg-card); }

/* ═══════════════════════════════════════════════════════════════════
   RESULT CARD OPTIONS — template cards + toggles
   ═══════════════════════════════════════════════════════════════════ */
.rct-grid {
  display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px;
  margin-bottom:16px;
}
.rct-card {
  position:relative; cursor:pointer;
  background:var(--bg-card);
  border:2px solid var(--border-light); border-radius:14px;
  overflow:hidden; transition:all .2s ease;
}
.rct-card:hover { transform:translateY(-2px); border-color:var(--rct-accent); }
.rct-card.selected {
  border-color:var(--rct-accent);
  background:var(--rct-accent-bg);
  box-shadow:0 4px 16px color-mix(in srgb, var(--rct-accent) 18%, transparent);
}

.rct-check {
  position:absolute; top:10px; right:10px; z-index:20;
  width:22px; height:22px; border-radius:6px;
  background:var(--rct-accent); border:2px solid #fff;
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:10px;
  box-shadow:0 2px 8px color-mix(in srgb, var(--rct-accent) 40%, transparent);
  cursor:pointer; transition:.18s;
}
.rct-check.hollow {
  background:rgba(255,255,255,.18);
  border:2px solid rgba(255,255,255,.6);
  box-shadow:none;
}
.rct-preview { /* hero block — inline styles in JSX */ }
.rct-body { padding:13px 15px 14px; }

.rct-title-row { display:flex; align-items:center; gap:8px; margin-bottom:5px; flex-wrap:wrap; }
.rct-title { font-size:13px; font-weight:800; color:var(--text-primary); }
.rct-badge {
  font-size:9.5px; font-weight:700;
  padding:1px 7px; border-radius:999px;
}
.rct-badge.default {
  background:rgba(30,58,138,.1); color:#1E40AF;
  border:1px solid #1E40AF;
}
.rct-badge.new {
  background:linear-gradient(135deg,#7C3AED,#4F46E5);
  color:#fff;
}
.rct-desc {
  font-size:11px; color:var(--text-muted); line-height:1.5; margin-bottom:8px;
}
.rct-pages {
  padding:7px 10px; border-radius:8px;
  background:var(--bg-muted); border:1px solid var(--border-light);
  margin-bottom:9px; font-size:10.5px;
}
.rct-pages-row {
  display:flex; justify-content:space-between; align-items:center;
}
.rct-pages-row + .rct-pages-row { margin-top:3px; }
.rct-pages-row span:first-child { color:var(--text-muted); }
.rct-pages-row span:first-child i { font-size:9px; margin-right:4px; }

.rct-tags {
  display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;
}
.rct-tag {
  font-size:10px; font-weight:600;
  padding:2px 7px; border-radius:5px;
  background:var(--rct-accent-light); color:var(--rct-accent);
}
.rct-tag i { font-size:9px; margin-right:3px; }

.rct-preview-btn {
  width:100%; padding:8px 0; border-radius:8px;
  background:transparent; color:var(--rct-accent);
  border:1.5px solid var(--rct-accent);
  font-family:inherit; font-size:12px; font-weight:600;
  cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:6px;
  transition:.18s;
}
.rct-preview-btn:hover { background:var(--rct-accent); color:#fff; }
.rct-preview-btn i { font-size:11px; }

/* Visibility options */
.rco-group-label {
  display:flex; align-items:center; gap:8px;
  margin-bottom:10px;
  font-size:10px; font-weight:700; letter-spacing:1px;
  text-transform:uppercase; color:var(--text-muted);
}
.rco-group-bar {
  width:3px; height:14px; border-radius:2px; background:#1E40AF;
}
.rco-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));
  gap:8px;
}
.rco-row {
  display:flex; align-items:center; justify-content:space-between;
  padding:10px 14px; border-radius:10px;
  border:1px solid var(--border-light);
  background:var(--bg-muted);
  transition:background .15s ease;
}
.rco-row:hover { background:var(--bg-card); }
.rco-row-lbl {
  display:flex; align-items:center; gap:8px;
  font-size:13px; font-weight:500; color:var(--text-secondary);
}
.rco-toggle {
  position:relative; flex-shrink:0;
  width:40px; height:22px; border-radius:11px;
  background:#CBD5E1; border:none;
  cursor:pointer; transition:.2s;
  padding:0;
}
.rco-toggle.on { background:#1E40AF; }
.rco-dot {
  position:absolute; top:3px; left:3px;
  width:16px; height:16px; border-radius:50%;
  background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2);
  transition:.2s;
}
.rco-toggle.on .rco-dot { left:21px; }

.rco-foot {
  padding-top:16px; margin-top:16px;
  border-top:1px solid var(--border-light);
  display:flex; align-items:center; justify-content:space-between;
  flex-wrap:wrap; gap:10px;
}
.rco-foot-hint {
  font-size:11.5px; color:var(--text-muted);
}
.rco-save-btn {
  display:inline-flex; align-items:center; gap:8px;
  padding:10px 22px; border-radius:10px;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; border:none; cursor:pointer;
  font-family:inherit; font-size:13px; font-weight:600;
  transition:.2s; box-shadow:0 2px 8px rgba(30,64,175,.25);
}
.rco-save-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(30,64,175,.4); }

@media (max-width: 980px) {
  .rct-grid { grid-template-columns:1fr 1fr; }
}
@media (max-width: 640px) {
  .rct-grid { grid-template-columns:1fr; }
}

body.dark .rct-card { background:var(--bg-card); }
body.dark .rco-row { background:rgba(255,255,255,.02); }
body.dark .rco-row:hover { background:var(--bg-card); }
body.dark .rct-pages { background:rgba(255,255,255,.02); }

/* ═══════════════════════════════════════════════════════════════════
   SINGLE ASSESSMENT — class rows + student table + per-row badges
   ═══════════════════════════════════════════════════════════════════ */
.res-table-head {
  display:grid;
  grid-template-columns: 56px 1.3fr 50px 120px 150px 130px 130px;
  background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
  border:1px solid var(--border-light); border-bottom:none;
  border-radius:10px 10px 0 0;
  padding:11px 14px; gap:10px;
  font-size:10.5px; font-weight:800; color:var(--text-muted);
  text-transform:uppercase; letter-spacing:.5px;
}
.res-th { font-size:10.5px; font-weight:800; }
.res-row-wrap { background:transparent; }
.res-row-wrap:last-child .res-row:not(.open) { border-radius:0 0 10px 10px; }
.res-row-wrap:last-child .res-detail.open { border-radius:0 0 10px 10px; }
.res-row {
  display:grid;
  grid-template-columns: 56px 1.3fr 50px 120px 150px 130px 130px;
  align-items:center; gap:10px;
  padding:13px 14px;
  background:var(--bg-card);
  border:1px solid var(--border-light); border-top:none;
  font-size:12.5px; cursor:pointer;
  transition:background .15s ease;
}
.res-row:hover { background:#F8FAFF; }
.res-row.open { background:#EFF6FF; }
.res-td { display:flex; align-items:center; min-width:0; }
.res-td.cls-name { gap:9px; }
.res-td.cls-name span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.res-released-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:999px;
  font-size:10.5px; font-weight:700; white-space:nowrap;
}
.res-released-badge.pending  { background:rgba(217,119,6,.1);  color:#D97706; border:1px solid rgba(217,119,6,.25); }
.res-released-badge.released { background:rgba(22,163,74,.1);  color:#16A34A; border:1px solid rgba(22,163,74,.25); }

.res-publish-btn, .res-marks-btn {
  display:inline-flex; align-items:center; gap:6px;
  height:32px; padding:0 12px;
  border-radius:8px;
  font-size:11.5px; font-weight:700; line-height:1;
  cursor:pointer; white-space:nowrap;
  border:1.5px solid transparent;
  transition:all .18s ease;
  font-family:inherit;
}
.res-publish-btn { background:rgba(22,163,74,.1); color:#16A34A; }
.res-publish-btn:hover { background:#16A34A; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(22,163,74,.3); }
.res-publish-btn.released { background:rgba(220,38,38,.1); color:#DC2626; }
.res-publish-btn.released:hover { background:#DC2626; color:#fff; box-shadow:0 4px 12px rgba(220,38,38,.3); }
.res-publish-btn i { font-size:11px; }

.res-marks-btn { background:rgba(30,64,175,.1); color:#1E40AF; }
.res-marks-btn:hover { background:#1E40AF; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(30,64,175,.3); }

.res-download-btn {
  width:32px; height:32px; border-radius:8px;
  display:inline-flex; align-items:center; justify-content:center;
  font-size:12.5px; cursor:pointer; flex-shrink:0;
  background:rgba(22,163,74,.1); color:#16A34A;
  border:1.5px solid transparent;
  transition:all .18s ease;
}
.res-download-btn:hover { background:#16A34A; color:#fff; transform:translateY(-1px); box-shadow:0 4px 12px rgba(22,163,74,.3); }

.res-detail {
  background:#F8FAFF;
  border:1px solid var(--border-light); border-top:none;
  max-height:0; padding:0 18px; overflow:hidden;
  transition: max-height .3s ease, padding .3s ease;
}
.res-detail.open { max-height:3000px; padding:14px 18px; }

.res-student-scroll { overflow-x:auto; }
.res-student-table {
  width:100%; min-width:900px; border-collapse:collapse;
  background:var(--bg-card);
  border:1px solid var(--border-light);
  border-radius:var(--radius-md); overflow:hidden;
}
.res-student-table thead { background:linear-gradient(135deg,#F8FAFC,#F1F5F9); }
.res-student-table th {
  padding:10px 11px; font-size:10px; font-weight:800;
  color:var(--text-muted); text-align:left;
  text-transform:uppercase; letter-spacing:.4px;
  border-bottom:1px solid var(--border-light);
}
.res-student-table td {
  padding:11px; font-size:12px; vertical-align:middle;
  border-bottom:1px solid var(--border-light); color:var(--text-secondary);
}
.res-student-table tbody tr:last-child td { border-bottom:none; }
.res-student-table tbody tr:hover { background:rgba(30,64,175,.04); }

.res-st-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 9px; border-radius:999px;
  font-size:10.5px; font-weight:700; white-space:nowrap;
}
.res-st-badge.complete   { background:rgba(22,163,74,.1); color:#16A34A; border:1px solid rgba(22,163,74,.25); }
.res-st-badge.incomplete { background:rgba(30,64,175,.1); color:#1E40AF; border:1px solid rgba(30,64,175,.25); }
.res-st-badge.absent     { background:rgba(217,119,6,.1); color:#D97706; border:1px solid rgba(217,119,6,.25); }

.res-grade-chip {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:30px; padding:3px 9px; border-radius:6px;
  color:#fff; font-size:11px; font-weight:800;
}

.res-action-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 10px; border-radius:7px;
  font-size:11px; font-weight:700; line-height:1;
  cursor:pointer; white-space:nowrap;
  background:rgba(30,64,175,.08); color:#1E40AF;
  border:1.5px solid transparent; font-family:inherit;
  transition:all .18s ease;
}
.res-action-btn:hover { background:#1E40AF; color:#fff; transform:translateY(-1px); box-shadow:0 4px 10px rgba(30,64,175,.25); }
.res-action-btn i { font-size:10px; }
.res-action-btn.view { background:rgba(124,58,237,.1); color:#7C3AED; }
.res-action-btn.view:hover { background:#7C3AED; color:#fff; box-shadow:0 4px 10px rgba(124,58,237,.3); }
.res-action-btn.remarks { background:rgba(217,119,6,.1); color:#D97706; }
.res-action-btn.remarks:hover { background:#D97706; color:#fff; box-shadow:0 4px 10px rgba(217,119,6,.3); }

/* Absent toggle (Update Marks modal) */
.res-toggle-wrap {
  position:relative; display:inline-block;
  width:42px; height:24px;
}
.res-toggle-wrap input { opacity:0; width:0; height:0; }
.res-toggle-slider {
  position:absolute; cursor:pointer; inset:0;
  background:#CBD5E1; border-radius:12px;
  transition:.25s;
}
.res-toggle-slider::before {
  content:''; position:absolute;
  width:18px; height:18px; left:3px; bottom:3px;
  background:#fff; border-radius:50%;
  transition:.25s; box-shadow:0 1px 3px rgba(0,0,0,.2);
}
.res-toggle-wrap input:checked + .res-toggle-slider { background:#D97706; }
.res-toggle-wrap input:checked + .res-toggle-slider::before { transform:translateX(18px); }

@media (max-width: 820px) {
  .res-table-head, .res-row { grid-template-columns: 46px 1.2fr 50px 100px 130px 110px 90px; }
}
@media (max-width: 640px) {
  .res-table-head { display:none; }
  .res-row { grid-template-columns: 1fr; gap:6px; padding:14px; }
}

body.dark .res-row { background:var(--bg-card); }
body.dark .res-row:hover { background:rgba(30,64,175,.08); }
body.dark .res-row.open { background:rgba(30,64,175,.12); }
body.dark .res-detail { background:rgba(30,64,175,.05); }
body.dark .res-student-table { background:var(--bg-card); }
body.dark .res-student-table tbody tr:hover { background:rgba(30,64,175,.08); }
body.dark .res-table-head,
body.dark .res-student-table thead { background:linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.04)); }

/* ═══════════════════════════════════════════════════════════════════
   COMBINED ASSESSMENT — group cards, class rows, student table
   ═══════════════════════════════════════════════════════════════════ */
.cbr-tab {
  display:inline-flex; align-items:center; gap:7px;
  padding:9px 20px; border-radius:10px;
  font-family:inherit; font-size:13px; font-weight:700;
  background:var(--bg-card); color:var(--text-secondary);
  border:2px solid var(--border-light);
  cursor:pointer; transition:.18s;
}
.cbr-tab:hover { color:#1E40AF; border-color:#BFDBFE; }
.cbr-tab.active {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
  border-color:#1E40AF; box-shadow:0 4px 14px rgba(30,64,175,.28);
}

.cbr-group {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:14px; margin-bottom:12px; overflow:hidden;
  box-shadow:0 2px 8px rgba(15,23,42,.04);
  transition:.2s;
}
.cbr-group.active {
  border-color:#1E40AF;
  box-shadow:0 4px 18px rgba(30,64,175,.12);
}

.cbr-group-head {
  display:flex; align-items:center; gap:14px;
  padding:14px 18px; cursor:pointer;
  transition:background .18s ease;
}
.cbr-group.active .cbr-group-head { background:rgba(30,64,175,.06); }
.cbr-group-head:hover { background:var(--bg-muted); }
.cbr-group-icon {
  width:38px; height:38px; border-radius:10px;
  background:rgba(30,64,175,.1); color:#1E40AF;
  display:flex; align-items:center; justify-content:center;
  font-size:15px; flex-shrink:0;
}
.cbr-group.active .cbr-group-icon { background:#1E40AF; color:#fff; }

.cbr-group-name {
  font-size:14px; font-weight:800; color:var(--text-primary);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.cbr-group-meta {
  display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;
  align-items:center;
}
.cbr-group-meta > span { font-size:10.5px; color:var(--text-muted); display:inline-flex; align-items:center; gap:3px; }
.cbr-sub-chip {
  font-size:10px; font-weight:600;
  padding:1px 7px; border-radius:999px;
  background:rgba(124,58,237,.1); color:#7C3AED;
  border:1px solid rgba(124,58,237,.15);
}
.cbr-group-side {
  display:flex; flex-direction:column; align-items:flex-end;
  gap:4px; flex-shrink:0;
}
.cbr-status {
  font-size:10.5px; font-weight:700;
  padding:2px 10px; border-radius:999px;
  white-space:nowrap;
}

.cbr-group-body {
  border-top:1.5px solid var(--border-light);
  background:var(--bg-muted);
  padding:10px 14px;
}
.cbr-group-body-label {
  font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:.7px; color:var(--text-muted); margin-bottom:10px;
}

.cbr-class-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:10px; margin-bottom:8px; overflow:hidden;
}
.cbr-class-row {
  display:grid;
  grid-template-columns: 50px 1.5fr 130px 1fr;
  align-items:center; gap:10px;
  padding:11px 14px; cursor:pointer;
  transition:background .15s ease;
}
.cbr-class-row:hover { background:#F8FAFF; }
.cbr-class-row.open { background:rgba(30,64,175,.06); }
.cbr-cls-sno { color:#1E40AF; font-size:11px; font-weight:700; }
.cbr-cls-name { display:flex; align-items:center; gap:9px; min-width:0; }
.cbr-cls-actions { display:flex; align-items:center; justify-content:flex-end; gap:6px; }

.cbr-class-detail {
  border-top:1.5px solid var(--border-light);
  padding:12px 14px;
  background:#FCFCFD;
  animation:fadeSlide .25s ease;
}
.cbr-table-wrap { overflow-x:auto; }
.cbr-student-table {
  width:100%; min-width:980px;
  border-collapse:collapse;
  background:var(--bg-card);
  border:1px solid var(--border-light);
  border-radius:8px; overflow:hidden;
}
.cbr-student-table thead {
  background:linear-gradient(135deg,#F8FAFC,#F1F5F9);
}
.cbr-student-table th {
  padding:9px 11px; font-size:10px; font-weight:800;
  color:var(--text-muted); text-align:left;
  text-transform:uppercase; letter-spacing:.4px;
  border-bottom:1px solid var(--border-light);
}
.cbr-student-table th.cbr-sub-th {
  text-align:center; background:rgba(124,58,237,.06);
  border-left:2.5px solid rgba(124,58,237,.2);
  color:#7C3AED;
  text-transform:uppercase; letter-spacing:.4px;
}
.cbr-student-table th.cbr-sub-th > span:first-child {
  display:block; font-size:10px; font-weight:800;
}
.cbr-student-table td {
  padding:9px 11px; font-size:12px;
  border-bottom:1px solid var(--border-light);
  color:var(--text-secondary); vertical-align:middle;
}
.cbr-student-table td.cbr-sub-cell {
  border-left:2px solid rgba(124,58,237,.1);
}
.cbr-student-table tbody tr:last-child td { border-bottom:none; }
.cbr-student-table tbody tr:hover { background:rgba(30,64,175,.04); }

@media (max-width: 820px) {
  /* Class row stacks: header line (sno + name) on row 1, full-width status, full-width actions */
  .cbr-class-row {
    grid-template-columns: 1fr; gap:10px;
    padding:14px 14px;
  }
  .cbr-class-row > .cbr-cls-sno {
    display:inline-flex; align-items:center; gap:8px;
  }
  .cbr-class-row > .cbr-cls-sno::after {
    content:''; flex:1; height:1px; background:var(--border-light);
  }
  .cbr-cls-name {
    width:100%; min-width:0;
  }
  .cbr-cls-name span { white-space:normal !important; }
  .cbr-class-row > div:nth-child(3) {
    align-self:flex-start;
  }
  .cbr-cls-actions {
    width:100%; justify-content:flex-start; flex-wrap:wrap;
  }
  .cbr-cls-actions .res-publish-btn { flex:1 1 auto; min-width:0; }

  /* Group header: lighter side panel, wraps below the name */
  .cbr-group-head { flex-wrap:wrap; padding:14px 16px; gap:10px; }
  .cbr-group-side { align-items:flex-start; flex-direction:row; gap:8px; flex-wrap:wrap; }
  .cbr-group-name { white-space:normal; }
  .cbr-group-meta { gap:4px; }

  /* Pad the student table area a bit on mobile */
  .cbr-class-detail { padding:12px 10px; }
}
@media (max-width: 480px) {
  /* Even tighter: shrink Publish label so all action buttons stay on one row */
  .cbr-class-row .res-publish-btn { padding:0 10px; font-size:11px; }
  .cbr-class-row .res-publish-btn .fa-solid { margin-right:2px; }
}

body.dark .cbr-group { background:var(--bg-card); }
body.dark .cbr-group-head:hover { background:rgba(30,64,175,.08); }
body.dark .cbr-group.active .cbr-group-head { background:rgba(30,64,175,.12); }
body.dark .cbr-class-card { background:var(--bg-card); }
body.dark .cbr-class-row:hover { background:rgba(30,64,175,.08); }
body.dark .cbr-class-row.open { background:rgba(30,64,175,.14); }
body.dark .cbr-class-detail { background:rgba(255,255,255,.02); }
body.dark .cbr-student-table { background:var(--bg-card); }
body.dark .cbr-student-table thead { background:linear-gradient(135deg,rgba(255,255,255,.02),rgba(255,255,255,.04)); }
body.dark .cbr-student-table tbody tr:hover { background:rgba(30,64,175,.08); }

/* ═══════════════════════════════════════════════════════════════════
   RESULT HISTORY — search + filters + student grid
   ═══════════════════════════════════════════════════════════════════ */
.rh-search-shell {
  position:relative;
  margin-bottom:20px;
}
.rh-search-wrap {
  position:relative;
  display:flex; align-items:center; gap:12px;
  padding:12px 18px;
  background:var(--bg-card);
  border:2px solid var(--border-light);
  border-radius:14px;
  box-shadow:0 2px 12px rgba(30,64,175,.07);
  transition:.2s;
}
.rh-search-wrap:focus-within {
  border-color:#1E40AF;
  box-shadow:0 4px 20px rgba(30,64,175,.15);
}
.rh-search-icon { color:#1E40AF; font-size:16px; flex-shrink:0; }
.rh-search-wrap input {
  flex:1;
  border:none; outline:none; background:transparent;
  font-size:13.5px; color:var(--text-primary);
  font-family:inherit;
}
.rh-search-clear {
  width:26px; height:26px; border-radius:7px;
  border:none; background:var(--bg-muted); color:var(--text-muted);
  cursor:pointer; font-size:11px;
  display:inline-flex; align-items:center; justify-content:center;
  transition:.18s;
}
.rh-search-clear:hover { background:#FEE2E2; color:#DC2626; }

/* Live search dropdown */
.rh-search-drop {
  position:absolute;
  top:calc(100% + 6px); left:0; right:0;
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:12px;
  box-shadow:0 8px 32px rgba(0,0,0,.12);
  z-index:500;
  max-height:360px; overflow-y:auto;
  animation:fadeSlide .15s ease;
}
.rh-search-empty {
  padding:16px 18px;
  text-align:center;
  color:var(--text-muted);
  font-size:12.5px;
}
.rh-search-row {
  display:flex; align-items:center; gap:12px;
  padding:12px 16px; cursor:pointer;
  border-bottom:1px solid var(--border-light);
  transition:background .15s ease;
}
.rh-search-row:last-child { border-bottom:none; }
.rh-search-row:hover { background:var(--bg-muted); }
.rh-search-avatar {
  width:38px; height:38px; border-radius:50%;
  background:linear-gradient(135deg,#1E3A8A,#7C3AED);
  color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:15px; font-weight:800; flex-shrink:0;
}
.rh-search-meta { flex:1; min-width:0; }
.rh-search-name {
  font-weight:700; color:var(--text-primary); font-size:13px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.rh-search-sub {
  font-size:10.5px; color:var(--text-muted);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.rh-search-side {
  text-align:right; flex-shrink:0;
}
.rh-search-count {
  font-size:11.5px; font-weight:700; color:#1E40AF;
}
.rh-search-avg {
  font-size:10px; color:var(--text-muted);
}

body.dark .rh-search-drop { background:var(--bg-card); }
body.dark .rh-search-row:hover { background:rgba(30,64,175,.08); }

/* Student detail view */
.rh-back-btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:7px 14px; border-radius:9px;
  border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-secondary);
  font-size:12.5px; font-weight:600; cursor:pointer;
  margin-bottom:16px; font-family:inherit;
  transition:.18s;
}
.rh-back-btn:hover { border-color:#1E40AF; color:#1E40AF; }

.rh-profile-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:16px; overflow:hidden;
  margin-bottom:16px;
  box-shadow:0 2px 12px rgba(30,64,175,.06);
}
.rh-banner {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#4F46E5 100%);
  padding:20px 24px;
  display:flex; align-items:center; gap:18px;
}
.rh-banner-avatar {
  width:64px; height:64px; border-radius:50%;
  background:rgba(255,255,255,.15);
  border:3px solid rgba(255,255,255,.4);
  color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:24px; font-weight:900;
  flex-shrink:0;
}
.rh-kpi-strip {
  display:grid; grid-template-columns:repeat(5, 1fr);
  border-top:1px solid var(--border-light);
}

.rh-history-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:14px; overflow:hidden;
  margin-bottom:16px;
}
.rh-history-head {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 18px;
  border-bottom:1px solid var(--border-light);
  background:var(--bg-muted);
}
.rh-timeline-row {
  display:flex; align-items:flex-start; flex-wrap:wrap;
  gap:14px; padding:14px 16px;
  border-bottom:1px solid var(--border-light);
  transition:background .15s ease;
}
.rh-timeline-row:last-child { border-bottom:none; }
.rh-timeline-row:hover { background:var(--bg-muted); }

@media (max-width: 720px) {
  .rh-kpi-strip { grid-template-columns:repeat(2, 1fr); }
  .rh-kpi-strip > div { border-right:none !important; border-bottom:1px solid var(--border-light); }
  .rh-banner { flex-wrap:wrap; padding:18px 20px; gap:14px; }
}

body.dark .rh-profile-card { background:var(--bg-card); }
body.dark .rh-history-card { background:var(--bg-card); }
body.dark .rh-history-head { background:rgba(255,255,255,.02); }
body.dark .rh-timeline-row:hover { background:rgba(30,64,175,.08); }

/* Detail view 2-col layout */
.rh-two-col {
  display:grid;
  grid-template-columns:1fr 340px;
  gap:16px; align-items:start;
}
@media (max-width: 980px) {
  .rh-two-col { grid-template-columns:1fr; }
}

/* Performance Trends */
.rh-trend-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:14px; overflow:hidden;
  padding:16px 18px;
}
.rh-trend-scroll {
  overflow-x:auto; padding-bottom:6px;
  -webkit-overflow-scrolling:touch;
}
.rh-trend-bars {
  display:flex; align-items:flex-end; gap:10px;
  height:120px; padding:0 4px; min-width:min-content;
}
.rh-trend-item {
  display:flex; flex-direction:column; align-items:center; gap:4px;
  min-width:60px; flex-shrink:0;
}
.rh-trend-pct { font-size:9.5px; font-weight:700; }
.rh-trend-track {
  width:100%; background:var(--bg-muted);
  border-radius:5px 5px 0 0; height:85px;
  display:flex; align-items:flex-end;
  overflow:hidden;
}
.rh-trend-fill {
  width:100%; min-height:4px;
  border-radius:5px 5px 0 0;
  transition: height .4s ease;
}
.rh-trend-lbl {
  font-size:9px; color:var(--text-muted);
  text-align:center; line-height:1.2; max-width:64px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  font-weight:600;
}

/* Right column cards */
.rh-side-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:14px; padding:16px 18px;
}

/* Subject performance */
.rh-subj-row {
  display:flex; align-items:center; gap:10px;
  margin-bottom:9px;
}
.rh-subj-name {
  font-size:11.5px; color:var(--text-secondary);
  width:110px; flex-shrink:0; font-weight:600;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.rh-subj-bar {
  flex:1; height:8px; background:var(--border-light);
  border-radius:4px; overflow:hidden;
}

/* Academic Insights */
.rh-insight {
  display:flex; align-items:flex-start; gap:10px;
  padding:10px 12px; border-radius:10px;
  margin-bottom:8px;
}
.rh-insight i { font-size:14px; margin-top:1px; flex-shrink:0; }
.rh-insight:last-child { margin-bottom:0; }
.rh-insight--good { background:rgba(22,163,74,.08); border-left:3px solid #16A34A; }
.rh-insight--good i { color:#16A34A; }
.rh-insight--warn { background:rgba(217,119,6,.08); border-left:3px solid #D97706; }
.rh-insight--warn i { color:#D97706; }
.rh-insight--bad  { background:rgba(220,38,38,.08); border-left:3px solid #DC2626; }
.rh-insight--bad i { color:#DC2626; }
.rh-insight-title { font-size:11px; font-weight:700; line-height:1.3; }
.rh-insight--good .rh-insight-title { color:#16A34A; }
.rh-insight--warn .rh-insight-title { color:#D97706; }
.rh-insight--bad  .rh-insight-title { color:#DC2626; }
.rh-insight-sub { font-size:12px; color:var(--text-primary); font-weight:600; margin-top:2px; }

/* Download Report cards */
.rh-report-card {
  border:1.5px solid var(--border-light);
  border-radius:10px;
  padding:11px 13px;
  background:var(--bg-card);
}
.rh-report-btn {
  width:100%;
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  padding:7px 0; border-radius:7px;
  border:1.5px solid var(--acc, #1E40AF);
  background:transparent; color:var(--acc, #1E40AF);
  font-family:inherit; font-size:11px; font-weight:700;
  cursor:pointer; transition:.18s;
}
.rh-report-btn:hover {
  background:var(--acc, #1E40AF); color:#fff;
  transform:translateY(-1px);
  box-shadow:0 4px 12px rgba(0,0,0,.12);
}

body.dark .rh-trend-card,
body.dark .rh-side-card,
body.dark .rh-report-card { background:var(--bg-card); }
body.dark .rh-trend-track { background:rgba(255,255,255,.04); }

.rh-filter {
  padding:8px 12px; border-radius:10px;
  border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-primary);
  font-size:12.5px; font-family:inherit;
  cursor:pointer; outline:none;
  transition:.18s;
}
.rh-filter:hover { border-color:#BFDBFE; }
.rh-filter:focus { border-color:#1E40AF; box-shadow:0 0 0 3px rgba(30,64,175,.12); }

.rh-grid {
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));
  gap:16px;
}
.rh-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:14px;
  padding:16px; cursor:pointer;
  position:relative; overflow:hidden;
  transition:transform .2s, border-color .2s, box-shadow .2s;
}
.rh-card:hover {
  transform:translateY(-2px);
  border-color:#1E40AF;
  box-shadow:0 6px 24px rgba(30,64,175,.12);
}
.rh-card-accent {
  position:absolute; top:0; left:0; right:0; height:3px;
}
.rh-card-head {
  display:flex; align-items:center; gap:12px;
  margin-top:6px; margin-bottom:14px;
}
.rh-avatar {
  width:48px; height:48px; border-radius:50%;
  background:linear-gradient(135deg,#1E3A8A,#7C3AED);
  color:#fff;
  display:flex; align-items:center; justify-content:center;
  font-size:18px; font-weight:900; flex-shrink:0;
}
.rh-id { flex:1; min-width:0; }
.rh-name {
  font-size:14px; font-weight:800; color:var(--text-primary);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.rh-father { font-size:11px; color:var(--text-muted); }
.rh-cls    { font-size:10.5px; color:var(--text-secondary); margin-top:2px; }
.rh-grade { text-align:center; flex-shrink:0; }

.rh-kpis {
  display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;
  margin-bottom:12px;
}
.rh-kpi {
  text-align:center; padding:8px 4px;
  background:var(--bg-muted); border-radius:8px;
}
.rh-bar {
  height:6px; background:var(--border-light);
  border-radius:3px; overflow:hidden;
  margin-bottom:10px;
}
.rh-bar > div { height:100%; border-radius:3px; transition:width .3s; }

.rh-foot {
  display:flex; align-items:center; justify-content:space-between;
  gap:8px;
}

@media (max-width: 640px) {
  .rh-grid { grid-template-columns:1fr; }
}

body.dark .rh-card { background:var(--bg-card); }
body.dark .rh-search-wrap { background:var(--bg-card); }
body.dark .rh-kpi { background:rgba(255,255,255,.03); }
body.dark .rh-filter { background:var(--bg-card); color:var(--text-primary); }

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE — Examination coverage. Brand-gradient buttons and badges
   keep their identity; surfaces, inputs, tabs and modals dark-flip.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Top tabs (Exam Setup / Date Sheet / Syllabus / Results) ─── */
[data-theme="dark"] .exam-tabs-row { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-sm); }
[data-theme="dark"] .exam-tab { color:var(--text-muted); }
[data-theme="dark"] .exam-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
[data-theme="dark"] .exam-term-chips { background:transparent; }
[data-theme="dark"] .exam-term-chip { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .exam-term-chip:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }

/* ─── Exam list table ─── */
[data-theme="dark"] .exam-action-bar { background:transparent; }
[data-theme="dark"] .exam-add-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .exam-add-btn:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .exam-table-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .exam-th { color:var(--text-muted); }
[data-theme="dark"] .exam-row-wrap { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .exam-row { background:var(--bg-card); }
[data-theme="dark"] .exam-row:hover,
[data-theme="dark"] .exam-row.open { background:var(--bg-muted); }
[data-theme="dark"] .exam-td { color:var(--text-primary); }
[data-theme="dark"] .exam-td.sno { color:var(--text-muted); }
[data-theme="dark"] .exam-name-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .exam-edit-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .exam-edit-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .exam-del-btn { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.3); color:#FCA5A5; }
[data-theme="dark"] .exam-del-btn:hover { background:var(--error); color:#fff; border-color:var(--error); }
[data-theme="dark"] .exam-expand-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .exam-expand-btn:hover,
[data-theme="dark"] .exam-expand-btn.open { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .exam-detail { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .exam-detail-inner { color:var(--text-primary); }
[data-theme="dark"] .exam-detail-label { color:var(--text-muted); }
[data-theme="dark"] .exam-detail-value { color:var(--text-primary); }
[data-theme="dark"] .no-data { color:var(--text-muted); background:var(--bg-card); }

/* Export buttons (PDF / Word) used across all results screens */
[data-theme="dark"] .export-btn.pdf { background:linear-gradient(135deg,#EF4444,#DC2626); color:#fff; }
[data-theme="dark"] .export-btn.word { background:linear-gradient(135deg,#2563EB,#1E40AF); color:#fff; }

/* ─── Exam add/edit modal ─── */
[data-theme="dark"] .exam-modal-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .exam-modal { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-xl); }
[data-theme="dark"] .exam-modal-header { background:linear-gradient(135deg,rgba(59,130,246,.08),transparent); border-bottom-color:var(--border-light); }
[data-theme="dark"] .exam-modal-header-icon { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .exam-modal-title { color:var(--text-primary); }
[data-theme="dark"] .exam-modal-sub { color:var(--text-muted); }
[data-theme="dark"] .exam-modal-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .exam-modal-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }
[data-theme="dark"] .exam-modal-body { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .exam-modal-footer { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .exam-field-group { color:var(--text-primary); }
[data-theme="dark"] .exam-field-label { color:var(--text-secondary); }
[data-theme="dark"] .exam-input,
[data-theme="dark"] .exam-input-wrap input,
[data-theme="dark"] .exam-textarea { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .exam-input::placeholder,
[data-theme="dark"] .exam-textarea::placeholder { color:var(--text-muted); }
[data-theme="dark"] .exam-input:focus,
[data-theme="dark"] .exam-textarea:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .exam-input-icon { color:var(--text-muted); }
[data-theme="dark"] .exam-input-wrap { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); }
[data-theme="dark"] .exam-input-wrap:focus-within { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .exam-class-list { background:transparent; border-color:var(--border-light); }
[data-theme="dark"] .exam-class-chip { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .exam-class-chip.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }
[data-theme="dark"] .exam-class-chip-x:hover { background:rgba(220,38,38,.2); color:#FCA5A5; }
[data-theme="dark"] .exam-submit-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .exam-submit-btn:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }

/* ─── Date Sheet tab ─── */
[data-theme="dark"] .ds-exam-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .ds-exam-btn:hover { background:var(--bg-muted); border-color:var(--border-med); color:var(--text-primary); }
[data-theme="dark"] .ds-exam-btn.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }
[data-theme="dark"] .ds-empty { color:var(--text-muted); background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ds-table-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .ds-th { color:var(--text-muted); }
[data-theme="dark"] .ds-row-wrap { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ds-row { background:var(--bg-card); }
[data-theme="dark"] .ds-row:hover,
[data-theme="dark"] .ds-row.open { background:var(--bg-muted); }
[data-theme="dark"] .ds-td { color:var(--text-primary); }
[data-theme="dark"] .ds-cls-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .ds-has-badge { background:rgba(34,197,94,.15); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .ds-edit-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .ds-edit-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .ds-report-btn { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.3); color:#FCA5A5; }
[data-theme="dark"] .ds-report-btn:hover { background:rgba(220,38,38,.2); border-color:var(--error); }
[data-theme="dark"] .ds-copy-btn,
[data-theme="dark"] .ds-copy-row-btn { background:rgba(99,102,241,.15); border-color:rgba(99,102,241,.3); color:#A5B4FC; }
[data-theme="dark"] .ds-copy-btn:hover,
[data-theme="dark"] .ds-copy-row-btn:hover { background:rgba(99,102,241,.25); border-color:#818CF8; }
[data-theme="dark"] .ds-del-btn { background:rgba(220,38,38,.12); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .ds-del-btn:hover { background:var(--error); color:#fff; border-color:var(--error); }
[data-theme="dark"] .ds-expand-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .ds-expand-btn:hover,
[data-theme="dark"] .ds-expand-btn.open { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .ds-detail { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .ds-detail-inner { color:var(--text-primary); }
[data-theme="dark"] .ds-bell-btn { background:rgba(217,119,6,.12); border-color:rgba(217,119,6,.3); color:#FCD34D; }
[data-theme="dark"] .ds-actions-cell { background:transparent; }

/* Date Sheet subject table inside detail */
[data-theme="dark"] .ds-subj-table-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .ds-subj-th { color:var(--text-muted); }
[data-theme="dark"] .ds-subj-row { background:var(--bg-card); border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .ds-subj-row:hover { background:var(--bg-muted); }
[data-theme="dark"] .ds-subj-td { color:var(--text-primary); }

/* Date Sheet edit modal */
[data-theme="dark"] .ds-edit-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ds-edit-body { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .ds-edit-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .ds-edit-card-head { background:var(--bg-card); border-bottom-color:var(--border-light); }
[data-theme="dark"] .ds-edit-card-title { color:var(--text-primary); }
[data-theme="dark"] .ds-edit-card-remove { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .ds-edit-card-remove:hover { background:var(--error); color:#fff; border-color:var(--error); }
[data-theme="dark"] .ds-edit-num { color:var(--text-secondary); }
[data-theme="dark"] .ds-edit-fields { color:var(--text-primary); }
[data-theme="dark"] .ds-edit-field,
[data-theme="dark"] .ds-edit-field-wide { color:var(--text-primary); }
[data-theme="dark"] .ds-edit-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .ds-edit-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .ds-edit-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .ds-edit-add { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .ds-edit-add:hover { background:rgba(59,130,246,.2); border-color:#3B82F6; }
[data-theme="dark"] .ds-edit-empty { color:var(--text-muted); }
[data-theme="dark"] .ds-edit-empty-sub { color:var(--text-muted); }

/* ─── Syllabus tab ─── */
[data-theme="dark"] .syl-table-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .syl-th { color:var(--text-muted); }
[data-theme="dark"] .syl-row-wrap { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .syl-row { background:var(--bg-card); }
[data-theme="dark"] .syl-row:hover,
[data-theme="dark"] .syl-row.open { background:var(--bg-muted); }
[data-theme="dark"] .syl-td { color:var(--text-primary); }
[data-theme="dark"] .syl-cls-icon { background:rgba(124,58,237,.15); color:#C4B5FD; }
[data-theme="dark"] .syl-status-badge.added { background:rgba(34,197,94,.15); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .syl-status-badge.notadded { background:rgba(220,38,38,.12); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .syl-status-badge.partial { background:rgba(217,119,6,.15); color:#FCD34D; border-color:rgba(217,119,6,.3); }
[data-theme="dark"] .syl-edit-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .syl-edit-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .syl-report-btn { background:rgba(220,38,38,.12); border-color:rgba(220,38,38,.3); color:#FCA5A5; }
[data-theme="dark"] .syl-report-btn:hover { background:rgba(220,38,38,.2); border-color:var(--error); }
[data-theme="dark"] .syl-del-btn { background:rgba(220,38,38,.12); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .syl-del-btn:hover { background:var(--error); color:#fff; border-color:var(--error); }
[data-theme="dark"] .syl-expand-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .syl-expand-btn:hover,
[data-theme="dark"] .syl-expand-btn.open { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .syl-detail { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .syl-detail-inner { color:var(--text-primary); }
[data-theme="dark"] .syl-subj-table-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .syl-subj-th { color:var(--text-muted); }
[data-theme="dark"] .syl-subj-row { background:var(--bg-card); border-bottom-color:var(--border-light); }
[data-theme="dark"] .syl-subj-td { color:var(--text-primary); }
[data-theme="dark"] .syl-subj-icon { background:rgba(124,58,237,.15); color:#C4B5FD; }

/* Syllabus edit modal + RTE */
[data-theme="dark"] .syl-edit-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .syl-edit-body { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .syl-edit-subj { color:var(--text-primary); }
[data-theme="dark"] .syl-edit-subj-name { color:var(--text-primary); }
[data-theme="dark"] .syl-tb { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .syl-tb-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .syl-tb-btn:hover { background:var(--bg-muted); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .syl-editor { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .syl-editor:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }

/* ─── Results — sub-tabs + L2 ─── */
[data-theme="dark"] .res-sub-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .res-sub-tab { color:var(--text-muted); }
[data-theme="dark"] .res-sub-tab:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .res-sub-tab.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .rs-l2-tabs { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rs-l2-tab { color:var(--text-muted); }
[data-theme="dark"] .rs-l2-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }

/* ─── Result Setup ─── */
[data-theme="dark"] .rs-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rs-card-header { background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); border-bottom-color:var(--border-light); }
[data-theme="dark"] .rs-card-title { color:var(--text-primary); }
[data-theme="dark"] .rs-card-sub { color:var(--text-muted); }
[data-theme="dark"] .rs-section-header { color:var(--text-primary); }
[data-theme="dark"] .rs-section-label { color:var(--text-secondary); }
[data-theme="dark"] .rs-grade-row,
[data-theme="dark"] .rs-sig-row { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .rs-grade-chip { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rs-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rs-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .rs-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .rs-select { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rm-remark-card,
[data-theme="dark"] .rm-remark-bot,
[data-theme="dark"] .rm-remark-top { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .rs-add { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .rs-add:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .rs-del { background:rgba(220,38,38,.12); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .rs-del:hover { background:var(--error); color:#fff; border-color:var(--error); }
[data-theme="dark"] .rs-grade-list,
[data-theme="dark"] .rs-sig-list,
[data-theme="dark"] .rm-remark-list { background:transparent; }
[data-theme="dark"] .rs-absent-toggle { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rs-absent-toggle.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }
[data-theme="dark"] .rs-icon-circle { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .rs-modal-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .rs-modal,
[data-theme="dark"] .rs-modal-card { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-xl); }
[data-theme="dark"] .rs-modal-header { border-bottom-color:var(--border-light); background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); }
[data-theme="dark"] .rs-modal-title { color:var(--text-primary); }
[data-theme="dark"] .rs-modal-sub { color:var(--text-muted); }
[data-theme="dark"] .rs-modal-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .rs-modal-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }
[data-theme="dark"] .rs-modal-body { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .rs-modal-footer { background:var(--bg-muted); border-top-color:var(--border-light); }

/* ─── Result Card Options (RCO) ─── */
[data-theme="dark"] .rco-grid { background:transparent; }
[data-theme="dark"] .rco-row { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .rco-row-lbl { color:var(--text-primary); }
[data-theme="dark"] .rco-group-label { color:var(--text-secondary); }
[data-theme="dark"] .rco-group-bar { background:var(--brand-mid); }
[data-theme="dark"] .rco-foot { background:var(--bg-muted); border-top-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .rco-foot-hint { color:var(--text-muted); }
[data-theme="dark"] .rco-toggle { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rco-toggle.on { background:linear-gradient(135deg,#1E3A8A,#2563EB); border-color:transparent; }
[data-theme="dark"] .rco-dot { background:var(--text-muted); }
[data-theme="dark"] .rco-toggle.on .rco-dot { background:#fff; }

/* Result card template selector */
[data-theme="dark"] .rct-grid { background:transparent; }
[data-theme="dark"] .rct-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rct-card:hover { border-color:var(--border-med); }
[data-theme="dark"] .rct-card.selected { border-color:#3B82F6; background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(37,99,235,.06)); }
[data-theme="dark"] .rct-title { color:var(--text-primary); }
[data-theme="dark"] .rct-sub { color:var(--text-muted); }
[data-theme="dark"] .rct-preview-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .rct-preview-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .rct-tag { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }

/* ─── Single Assessment (res-) table ─── */
[data-theme="dark"] .res-table-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .res-th { color:var(--text-muted); }
[data-theme="dark"] .res-row-wrap { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .res-row { background:var(--bg-card); }
[data-theme="dark"] .res-row:hover,
[data-theme="dark"] .res-row.open { background:var(--bg-muted); }
[data-theme="dark"] .res-td { color:var(--text-primary); }
[data-theme="dark"] .res-publish-btn { background:rgba(34,197,94,.15); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .res-publish-btn:hover { background:rgba(34,197,94,.25); border-color:var(--success); }
[data-theme="dark"] .res-publish-btn.released { background:rgba(217,119,6,.15); color:#FCD34D; border-color:rgba(217,119,6,.3); }
[data-theme="dark"] .res-publish-btn.released:hover { background:rgba(217,119,6,.25); border-color:var(--warning); }
[data-theme="dark"] .res-marks-btn { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .res-marks-btn:hover { background:rgba(59,130,246,.2); border-color:#3B82F6; }
[data-theme="dark"] .res-download-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .res-download-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .res-action-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .res-action-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .res-action-btn.view:hover { border-color:#0891B2; color:#22D3EE; background:rgba(8,145,178,.1); }
[data-theme="dark"] .res-action-btn.remarks:hover { border-color:#D97706; color:#FCD34D; background:rgba(217,119,6,.1); }
[data-theme="dark"] .res-grade-chip { color:#fff; }
[data-theme="dark"] .res-update-modal,
[data-theme="dark"] .res-remarks-modal,
[data-theme="dark"] .res-tm-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .res-update-table th,
[data-theme="dark"] .res-tm-table th { background:var(--bg-muted); color:var(--text-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .res-update-table td,
[data-theme="dark"] .res-tm-table td { background:var(--bg-card); border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .res-update-table tbody tr:hover { background:var(--bg-muted); }
[data-theme="dark"] .res-update-input,
[data-theme="dark"] .res-tm-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .res-update-input:focus,
[data-theme="dark"] .res-tm-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .res-update-input.absent { background:rgba(217,119,6,.1); color:#FCD34D; }
[data-theme="dark"] .res-abs-chip { background:rgba(217,119,6,.15); color:#FCD34D; border-color:rgba(217,119,6,.3); }
[data-theme="dark"] .res-abs-chip.active { background:var(--warning); color:#fff; border-color:var(--warning); }
[data-theme="dark"] .res-rem-textarea { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .res-rem-textarea:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .res-rem-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .res-rem-counter { color:var(--text-muted); }
[data-theme="dark"] .res-confirm-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .confirm-card,
[data-theme="dark"] .confirm-msg-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .confirm-icon { color:#FCA5A5; background:rgba(220,38,38,.12); }
[data-theme="dark"] .confirm-title { color:var(--text-primary); }
[data-theme="dark"] .confirm-message,
[data-theme="dark"] .confirm-msg { color:var(--text-secondary); }
[data-theme="dark"] .confirm-footer { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .confirm-btn.confirm-btn--cancel { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .confirm-btn.confirm-btn--cancel:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .confirm-btn.confirm-btn--confirm { background:linear-gradient(135deg,#DC2626,#B91C1C); color:#fff; }
[data-theme="dark"] .confirm-btn.confirm-btn--confirm.primary-style { background:linear-gradient(135deg,#1E3A8A,#2563EB); }

/* ─── Combined Assessment (cbr-) ─── */
[data-theme="dark"] .cbr-tab { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .cbr-tab:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .cbr-tab.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }
[data-theme="dark"] .cbr-group { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .cbr-group-head { background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); border-bottom-color:var(--border-light); }
[data-theme="dark"] .cbr-group-name { color:var(--text-primary); }
[data-theme="dark"] .cbr-group-meta { color:var(--text-muted); }
[data-theme="dark"] .cbr-group-side { color:var(--text-secondary); }
[data-theme="dark"] .cbr-group-icon { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .cbr-group-body { background:var(--bg-card); }
[data-theme="dark"] .cbr-group-body-label { color:var(--text-muted); }
[data-theme="dark"] .cbr-class-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .cbr-class-row { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .cbr-class-row:hover { background:var(--bg-muted); }
[data-theme="dark"] .cbr-cls-name { color:var(--text-primary); }
[data-theme="dark"] .cbr-cls-sno { color:var(--text-muted); }
[data-theme="dark"] .cbr-cls-actions { background:transparent; }
[data-theme="dark"] .cbr-class-detail { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .cbr-status { color:var(--text-secondary); }
[data-theme="dark"] .cbr-table-wrap { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .cbr-student-table th { background:var(--bg-muted); color:var(--text-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .cbr-student-table td { background:var(--bg-card); border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .cbr-student-table tbody tr:hover { background:var(--bg-muted); }
[data-theme="dark"] .cbr-sub-th { color:var(--text-muted); }
[data-theme="dark"] .cbr-sub-cell { color:var(--text-primary); }
[data-theme="dark"] .cbr-sub-chip { background:rgba(59,130,246,.15); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .cbr-create-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .cbr-create-section { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .cbr-create-section-label { color:var(--text-secondary); }
[data-theme="dark"] .cbr-create-card { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .cbr-create-card:hover { border-color:var(--border-med); }
[data-theme="dark"] .cbr-create-card.selected { border-color:#3B82F6; background:linear-gradient(135deg,rgba(59,130,246,.12),rgba(37,99,235,.06)); }
[data-theme="dark"] .cbr-weight-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .cbr-cls-chip { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .cbr-cls-chip.selected { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }

/* ─── Result History (rh-) — beyond the four existing body.dark rules ─── */
[data-theme="dark"] .rh-search-wrap { border-color:var(--border-light); }
[data-theme="dark"] .rh-search-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rh-search-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .rh-search-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .rh-search-icon { color:var(--text-muted); }
[data-theme="dark"] .rh-filter-row { background:transparent; }
[data-theme="dark"] .rh-filter { border-color:var(--border-light); }
[data-theme="dark"] .rh-card { border-color:var(--border-light); }
[data-theme="dark"] .rh-card-head { color:var(--text-primary); background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); }
[data-theme="dark"] .rh-st-name { color:var(--text-primary); }
[data-theme="dark"] .rh-st-meta { color:var(--text-muted); }
[data-theme="dark"] .rh-kpi { border-color:var(--border-light); }
[data-theme="dark"] .rh-kpi-val { color:var(--text-primary); }
[data-theme="dark"] .rh-kpi-lbl { color:var(--text-muted); }
[data-theme="dark"] .rh-exam-row { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rh-exam-row:hover { background:var(--bg-muted); }
[data-theme="dark"] .rh-exam-name { color:var(--text-primary); }
[data-theme="dark"] .rh-exam-meta { color:var(--text-muted); }
[data-theme="dark"] .rh-report-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .rh-report-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .rh-empty,
[data-theme="dark"] .rh-no-result { color:var(--text-muted); }
[data-theme="dark"] .rh-trend-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rh-trend-title { color:var(--text-primary); }

/* ─── Report Picker overlay shared across exam screens ─── */
[data-theme="dark"] .rp-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .rp-modal { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-xl); }
[data-theme="dark"] .rp-header { background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); border-bottom-color:var(--border-light); }
[data-theme="dark"] .rp-title { color:var(--text-primary); }
[data-theme="dark"] .rp-sub { color:var(--text-muted); }
[data-theme="dark"] .rp-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .rp-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }
[data-theme="dark"] .rp-body { color:var(--text-primary); }
[data-theme="dark"] .rp-section-label { color:var(--text-secondary); }
[data-theme="dark"] .rp-option,
[data-theme="dark"] .rp-format-row { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rp-option:hover,
[data-theme="dark"] .rp-format-row:hover { background:var(--bg-card); border-color:var(--border-med); }
[data-theme="dark"] .rp-option.selected,
[data-theme="dark"] .rp-format-row.selected,
[data-theme="dark"] .rp-format-row.selected-pdf,
[data-theme="dark"] .rp-format-row.selected-word { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.10)); border-color:#3B82F6; }
[data-theme="dark"] .rp-footer { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .rp-btn.cancel { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rp-btn.go { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* Result card preview overlay (shared rendering shell) */
[data-theme="dark"] .rc-preview-overlay { background:rgba(0,0,0,.7); }
[data-theme="dark"] .rc-preview-shell { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rc-preview-header { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* Tutorial button */
[data-theme="dark"] .tutorial-btn,
[data-theme="dark"] .page-tutorial-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .tutorial-btn:hover,
[data-theme="dark"] .page-tutorial-btn:hover { border-color:#3B82F6; color:#3B82F6; }

/* Section card (generic surface used across multiple screens) */
[data-theme="dark"] .section-card { background:var(--bg-card); border-color:var(--border-light); }

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — internal Examination screen layouts (≤ 600px)
   Add-only. Print / result-card / report-card / mark-sheet PDF, and
   any signed-letter CSS deliberately untouched.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 600px) {
  /* Page header — stack */
  .page-header { flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 14px; }
  .page-title { font-size: 20px; }
  .page-title-icon { width: 40px; height: 40px; font-size: 17px; }

  /* Exam top tabs row — scroll */
  .exam-tabs-row { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; gap: 4px; padding: 4px; }
  .exam-tabs-row::-webkit-scrollbar { display: none; }
  .exam-tabs-row > * { flex: 0 0 auto; white-space: nowrap; font-size: 12px; padding: 8px 12px; }

  /* Exam action bar — wrap actions full width */
  .exam-action-bar { flex-direction: column; align-items: stretch; gap: 10px; padding: 10px; }
  .exam-action-bar > * { width: 100%; }
  .exam-add-btn { width: 100%; justify-content: center; }
  .exam-term-chips { flex-wrap: wrap; gap: 6px; }

  /* Exam list — table → cards style */
  .exam-table-head { display: none !important; }
  .exam-row-wrap { display: block; padding: 12px; margin-bottom: 10px; border-radius: 12px; }
  .exam-row-wrap .exam-td { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; font-size: 12.5px; border: none !important; min-width: 0; }
  .exam-row-wrap .exam-td.sno { display: none; }
  .exam-row-wrap .exam-td.name { font-size: 14px; font-weight: 700; flex-direction: column; align-items: stretch; }
  .exam-detail-icon { width: 22px; height: 22px; font-size: 12px; }
  .exam-detail-item { gap: 6px; font-size: 12px; }
  .exam-detail-label { font-size: 10.5px; }
  .exam-detail-val { font-size: 12px; }
  .exam-detail-val.classes-list { flex-wrap: wrap; gap: 4px; }

  /* Exam form modal */
  .exam-modal { width: 96vw !important; max-width: 96vw !important; max-height: 95dvh; }
  .exam-modal-header { padding: 12px 14px; gap: 8px; flex-wrap: wrap; }
  .exam-modal-header-left { gap: 8px; min-width: 0; }
  .exam-modal-header-icon { width: 36px; height: 36px; font-size: 14px; }
  .exam-modal-title { font-size: 14px; }
  .exam-modal-sub { font-size: 11px; }
  .exam-modal-body { padding: 14px !important; }
  .exam-modal-footer { padding: 12px 14px; flex-wrap: wrap; gap: 8px; }
  .exam-modal-footer > * { flex: 1 1 auto; min-width: 0; }
  .exam-submit-btn,
  .exam-cancel-btn { width: 100%; justify-content: center; }
  .exam-class-select-wrap { gap: 6px; }
  .exam-class-pill { flex-wrap: wrap; }

  /* Date Sheet (ds-) — head + rows */
  .ds-table-head { display: none !important; }
  .ds-row-wrap { display: block; padding: 12px; margin-bottom: 10px; border-radius: 12px; }
  .ds-row-wrap .ds-td { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 12.5px; border: none !important; }
  .ds-row-wrap .ds-td.cls-name { font-size: 14px; font-weight: 700; }
  .ds-row-wrap .ds-actions-cell { justify-content: flex-end; flex-wrap: wrap; gap: 6px; padding-top: 6px; }
  .ds-detail-inner { padding: 12px; }
  .ds-subj-table-head { display: none !important; }
  .ds-subj-row { display: block; padding: 10px; }
  .ds-subj-td { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 12px; }
  .ds-subj-td.name { font-size: 13px; font-weight: 700; }
  .ds-edit-card { padding: 12px; }
  .ds-edit-card-head { flex-wrap: wrap; gap: 8px; }
  .ds-edit-fields { grid-template-columns: 1fr !important; gap: 8px; }
  .ds-edit-field.ds-edit-field-wide { grid-column: 1 / -1; }

  /* Syllabus (syl-) */
  .syl-table-head { display: none !important; }
  .syl-row-wrap { display: block; padding: 12px; margin-bottom: 10px; border-radius: 12px; }
  .syl-td { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 12.5px; border: none !important; }
  .syl-td.cls-name { font-size: 14px; font-weight: 700; }
  .syl-detail-inner { padding: 12px; }
  .syl-subj-table-head { display: none !important; }
  .syl-subj-row { display: block; padding: 10px; }
  .syl-subj-tabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; }
  .syl-subj-tabs::-webkit-scrollbar { display: none; }
  .syl-subj-tabs > * { flex: 0 0 auto; white-space: nowrap; }
  .syl-rte-toolbar { flex-wrap: wrap; gap: 4px; }
  .syl-rte-editor { min-height: 180px; font-size: 12.5px; }

  /* Results — sub-tabs (Per-Class / All-Students etc.) */
  .res-sub-tabs { overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; -ms-overflow-style: none; gap: 4px; padding: 4px; }
  .res-sub-tabs::-webkit-scrollbar { display: none; }
  .res-sub-tabs > * { flex: 0 0 auto; white-space: nowrap; font-size: 12px; }
  .res-table-head { display: none !important; }
  .res-row-wrap { display: block; padding: 12px; margin-bottom: 10px; border-radius: 12px; }
  .res-row-wrap .res-td { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 12.5px; border: none !important; }
  .res-row-wrap .res-td.cls-name { font-size: 14px; font-weight: 700; }
  .res-detail-inner { padding: 12px; }
  .res-student-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .res-student-table { min-width: 760px; font-size: 12px; }
  .res-student-table th,
  .res-student-table td { padding: 8px 10px !important; white-space: nowrap; }
  /* Sticky first column (student name) for horizontal scroll */
  .res-student-table th:first-child,
  .res-student-table td:first-child { position: sticky; left: 0; background: var(--bg-card); z-index: 2; box-shadow: 2px 0 4px rgba(15,23,42,.06); }
  .res-marks-btn,
  .res-action-btn { padding: 6px 10px; font-size: 11.5px; }
  .res-toggle-wrap { flex-wrap: wrap; gap: 6px; }
  .res-download-btn { width: 100%; justify-content: center; }

  /* Result history / RH tab */
  .rh-kpi-strip,
  .rh-kpis { grid-template-columns: 1fr 1fr !important; gap: 8px; }
  .rh-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .rh-two-col { grid-template-columns: 1fr !important; }
  .rh-filter { flex-direction: column; align-items: stretch; gap: 8px; padding: 10px; }
  .rh-filter > * { width: 100%; }
  .rh-card,
  .rh-profile-card,
  .rh-report-card,
  .rh-history-card,
  .rh-trend-card,
  .rh-side-card { padding: 14px 12px; }
  .rh-card-head,
  .rh-history-head { flex-wrap: wrap; gap: 8px; }
  .rh-banner { flex-direction: column; align-items: stretch; gap: 10px; padding: 12px; }
  .rh-search-wrap { width: 100%; }
  .rh-search-shell { width: 100%; }
  .rh-trend-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .rh-trend-bars { min-width: 520px; }
  .rh-subj-row { flex-wrap: wrap; gap: 6px; }

  /* CBR — tabs scrollable, table scrollable */
  .cbr-tab { white-space: nowrap; padding: 8px 12px; font-size: 12px; }
  .cbr-class-card,
  .cbr-class-detail { padding: 12px; }
  .cbr-cls-actions { flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .cbr-cls-name { font-size: 13.5px; }
  .cbr-group-head { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px; }
  .cbr-group-body { padding: 12px; }
  .cbr-group-meta { flex-wrap: wrap; gap: 6px; }
  .cbr-group-side { width: 100%; flex-wrap: wrap; gap: 6px; }
  .cbr-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .cbr-student-table { min-width: 760px; font-size: 11.5px; }
  .cbr-student-table th,
  .cbr-student-table td { padding: 6px 8px !important; white-space: nowrap; }
  .cbr-student-table th:first-child,
  .cbr-student-table td:first-child { position: sticky; left: 0; background: var(--bg-card); z-index: 2; box-shadow: 2px 0 4px rgba(15,23,42,.06); }
  .cbr-sub-chip { font-size: 10.5px; padding: 2px 6px; }

  /* RCT / RCO config layouts */
  .rco-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .rco-row { flex-wrap: wrap; gap: 6px; padding: 10px; }
  .rco-foot { flex-wrap: wrap; gap: 8px; padding: 10px; }
  .rct-grid { grid-template-columns: 1fr !important; gap: 10px; }
  .rct-pages { gap: 6px; }
  .rct-pages-row { flex-wrap: wrap; gap: 6px; }
  .rct-title-row { flex-wrap: wrap; gap: 8px; }
  .rct-tags { flex-wrap: wrap; gap: 4px; }

  /* Remarks modal lists */
  .rm-remark-row { padding: 10px 0; gap: 8px; }
  .rm-remark-top,
  .rm-remark-bot { flex-wrap: wrap; gap: 6px; }

  /* Result-sheet config (rs-) */
  .rs-card { padding: 14px 12px; }
  .rs-card-head { flex-wrap: wrap; gap: 8px; }
  .rs-grade-row { flex-wrap: wrap; gap: 6px; }
  .rs-abs-body { padding: 12px; }
  .rs-abs-chips { flex-wrap: wrap; gap: 6px; }
  .rs-cf-bar { flex-wrap: wrap; gap: 6px; }

  /* Section card padding */
  .section-card { border-radius: 12px; }
}

@media (max-width: 480px) {
  /* KPI strips collapse to 1-col on ultra-narrow (320-480px) */
  .rh-kpi-strip, .rh-kpis { grid-template-columns: 1fr !important; }
  /* Reset KPI strip borders when stacked 1-col */
  .rh-kpi-strip > div {
    border-right: none !important;
    border-bottom: 1px solid var(--border-light) !important;
  }
  .rh-kpi-strip > div:nth-child(odd) { border-right: none !important; }
  .rh-kpi-strip > div:last-child { border-bottom: none !important; }

  /* Result student tables — keep horizontal scroll w/ sticky col */
  .res-student-table, .cbr-student-table { min-width: 640px; }
  .page-title { font-size: 18px; }

  /* Performance Trends — auto-fit (no horizontal scroll, per spec) */
  .rh-trend-bars {
    min-width: 0 !important;
    width: 100% !important;
    gap: 3px !important;
  }
  .rh-trend-pct { font-size: 9px !important; }
  .rh-trend-lbl { font-size: 8px !important; }

  /* Result History filter selects — 1-col on ultra-narrow */
  .rh-filter {
    flex: 1 1 100% !important;
    width: 100% !important;
  }

  /* Student card stats — give each stat tile breathing room */
  .rh-kpi {
    padding: 8px 6px !important;
    text-align: center;
  }

  /* Student profile banner — tighter on ultra-narrow */
  .rh-banner {
    padding: 12px !important;
    gap: 10px !important;
  }
  .rh-banner-avatar {
    width: 42px !important;
    height: 42px !important;
    font-size: 16px !important;
  }
  /* Make name + Overall grade share Row 1; meta lines drop below */
  .rh-banner > div:nth-child(2) > div:first-child { font-size: 15px !important; }
  .rh-banner > div:nth-child(2) > div:nth-child(2) { font-size: 10.5px !important; }
  .rh-banner > div:nth-child(2) > div:last-child {
    font-size: 9.5px !important;
    word-break: break-word;
  }
  .rh-banner > div:last-child > div:first-child { font-size: 24px !important; }

  /* Timeline rows — even tighter spacing */
  .rh-timeline-row {
    gap: 6px !important;
    padding: 10px !important;
  }
  .rh-timeline-row > div:nth-child(2) > div:first-child { font-size: 12.5px !important; }

  /* Insight cards — wrap long subject names */
  .rh-insight-sub { white-space: normal !important; }

  /* Subject Performance row — allow name to wrap on ultra-narrow */
  .rh-subj-name {
    flex: 0 0 70px !important;
    font-size: 11px !important;
    white-space: normal !important;
    line-height: 1.2;
  }

  /* Search dropdown sized to viewport */
  .rh-search-drop {
    width: calc(100vw - 16px) !important;
    max-width: calc(100vw - 16px) !important;
  }
  .rh-search-row { padding: 8px 10px !important; }
  .rh-search-side { flex: 1 1 100% !important; align-items: flex-end !important; }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — Examination module (≤ 767px)
   Pure CSS, no JSX/logic changes. Converts wide div-based table
   rows into stacked cards. Tab strips horizontal-scroll. Action
   buttons wrap. Wide student-result tables keep horizontal scroll
   with a sticky first column (set up in existing CSS).
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 767px) {
  /* ─── Page header ─── */
  .page-header { padding: 14px 12px; }
  .page-title-row { flex-wrap: wrap; gap: 10px; }
  .page-title { font-size: 18px; }
  .page-sub { font-size: 11.5px; }

  /* ─── MAIN TAB BAR (Exam Setup / Date Sheet / Syllabus / Results) ─── */
  .exam-tabs-row {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap !important;
    white-space: nowrap;
    padding-bottom: 4px;
  }
  .exam-tabs-row::-webkit-scrollbar { display: none; }
  .exam-tab {
    flex: 0 0 auto;
    min-width: 130px;
    padding: 10px 14px;
    font-size: 12.5px;
  }

  /* ─── Action bar (Add exam / filters) ─── */
  .exam-action-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  /* ═══════ EXAM SETUP — row → COMPACT 3-ROW CARD ═══════
     Target layout at ≤ 767px (verified against JSX at lines 616–664):
       Row 1: [icon] Final Term  ·  meta-line  [Past badge wraps right]
       Row 2: [────── Edit ──────] (full width)
       Row 3: [PDF] [Word] [🗑] [v] (single row, PDF/Word flex-equal,
              Delete + Chevron 36×36 at the right end)
     JSX cells inside .exam-row in source order:
       1. .exam-td.sno       — # number  (hidden on mobile)
       2. .exam-td.name      — icon + title + meta
       3. .exam-td (badge)   — Past / Active badge
       4. .exam-td (Edit)    — .exam-edit-btn
       5. .exam-td (PDF/Word) — .export-btn.pdf + .export-btn.word
       6. .exam-td (Del/Chev) — .exam-del-btn + .exam-expand-btn
     We use the parent .exam-row as a flex-wrap row container and assign
     widths per nth-of-type so cells 2+3 share row-1, cell 4 wraps to
     row-2 as 100%, cells 5+6 share row-3.                              */
  .exam-table-head { display: none !important; }
  .exam-row-wrap {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    margin-bottom: 10px;
  }
  .exam-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 12px !important;
    background: transparent;
    grid-template-columns: none !important;
    min-height: unset !important;
    height: auto !important;
  }

  /* ─── Row 1 — hide #, fit name + Past badge on one row ─── */
  .exam-row > .exam-td.sno,
  .exam-row > .exam-td:first-child { display: none !important; }
  .exam-row > .exam-td.name,
  .exam-row > .exam-td:nth-of-type(2) {
    flex: 1 1 60% !important;
    width: auto !important;
    min-width: 0;
    padding: 0 !important;
    justify-content: flex-start !important;
  }
  .exam-row > .exam-td:nth-of-type(3) {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    justify-content: flex-end !important;
    margin-left: auto;
  }
  .exam-status-badge { display: inline-flex; }

  /* ─── Row 2 — Edit button full width ─── */
  .exam-row > .exam-td:nth-of-type(4) {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin-top: 2px;
  }
  .exam-row > .exam-td:nth-of-type(4) .exam-edit-btn {
    width: 100% !important;
    justify-content: center;
    padding: 8px 14px;
  }

  /* ─── Row 3 — PDF + Word + Delete + Chevron on ONE row ─── */
  .exam-row > .exam-td:nth-of-type(5) {
    flex: 1 1 auto !important;
    width: auto !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 6px !important;
    margin-top: 0 !important;
    min-width: 0;
    overflow: hidden;
  }
  .exam-row > .exam-td:nth-of-type(5) > button,
  .exam-row > .exam-td:nth-of-type(5) .export-btn {
    flex: 1 1 0 !important;
    width: 0 !important;
    min-width: 0 !important;
    max-width: 100% !important;
    justify-content: center;
    padding: 7px 8px;
    font-size: 11px;
  }
  .exam-row > .exam-td:last-child {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 6px !important;
    margin-top: 0 !important;
  }
  .exam-row > .exam-td:last-child .exam-del-btn,
  .exam-row > .exam-td:last-child .exam-expand-btn {
    flex-shrink: 0 !important;
    width: 36px !important;
    height: 36px !important;
    padding: 6px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* ═══════ DATE SHEET — COMPACT card layout (≤ 767px) ═══════
     Target at ≤ 767px (verified against JSX at lines 802–855):
       Row 1: #1
       Row 2: [icon] Grade 1 - Section A          [A]
       Row 3: ✅ 5 Subjects
       Row 4: [Edit] [Basic PDF] [Copy] [🗑] [v]
     JSX cells inside .ds-row in source order:
       1. .ds-td               — # number
       2. .ds-td.cls-name      — .ds-cls-icon + Grade name
       3. .ds-td               — section letter "A"
       4. .ds-td               — .ds-has-badge "5 Subjects"
       5. .ds-td               — .ds-edit-btn
       6. .ds-td.ds-actions-cell — .ds-report-btn + .ds-copy-row-btn
       7. .ds-td.ds-actions-cell — .ds-del-btn + .ds-expand-btn               */
  .ds-table-head { display: none !important; }
  .ds-row-wrap {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    margin-bottom: 10px;
    overflow: visible !important;
  }
  .ds-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: unset !important;
    height: auto !important;
    min-width: unset !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  /* ─── Row 1 — # number, compact on its own line ─── */
  .ds-row > .ds-td:first-child {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 11px;
    line-height: 1.1;
  }

  /* ─── Row 2 — icon + Grade name + section letter on one row ─── */
  .ds-row > .ds-td.cls-name {
    flex: 1 1 60% !important;
    width: auto !important;
    min-width: 0;
    padding: 0 !important;
    margin: 0 !important;
    justify-content: flex-start !important;
  }
  .ds-row > .ds-td:nth-of-type(3) {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    margin: 0 0 0 auto !important;
    font-size: 13px !important;
    color: var(--text-secondary);
  }

  /* ─── Row 3 — Subjects badge on its own line, compact ─── */
  .ds-row > .ds-td:nth-of-type(4) {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .ds-row .ds-has-badge {
    display: inline-flex !important;
    margin: 0 !important;
    padding: 3px 8px !important;
    font-size: 12px !important;
  }

  /* ─── Row 4 — ALL action buttons in ONE single row.
        Cell 5 (.ds-edit-btn), cell 6 (.ds-actions-cell: Basic PDF + Copy)
        and cell 7 (.ds-actions-cell: Delete + Chevron) share row 4.
        Edit + Basic PDF + Copy = three flexible buttons.
        Delete + Chevron = fixed-size icon buttons. ─── */
  .ds-row > .ds-td:nth-of-type(5) {
    flex: 1 1 0 !important;
    width: 0 !important;
    min-width: 0 !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
  }
  .ds-row > .ds-td.ds-actions-cell:nth-of-type(6) {
    flex: 2 1 0 !important;
    width: 0 !important;
    min-width: 0 !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 6px !important;
    justify-content: flex-start !important;
    overflow: visible !important;
  }
  .ds-row > .ds-td.ds-actions-cell:last-child {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 4px !important;
  }

  /* ─── Edit / Basic PDF / Copy — flexible buttons ─── */
  .ds-row .ds-edit-btn,
  .ds-row .ds-report-btn,
  .ds-row .ds-copy-row-btn {
    flex: 1 1 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    padding: 6px 8px !important;
    font-size: 11px !important;
    justify-content: center !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ds-row > .ds-td.ds-actions-cell:nth-of-type(6) > * {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    width: 0 !important;
  }

  /* ─── Delete + Chevron — fixed 32×32 icon buttons ─── */
  .ds-row .ds-del-btn,
  .ds-row .ds-expand-btn {
    flex-shrink: 0 !important;
    width: 32px !important;
    height: 32px !important;
    padding: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* ─── Strip any empty spacer divs ─── */
  .ds-row > div:empty,
  .ds-row-wrap > div:empty { display: none !important; }

  /* ═══════ SYLLABUS — COMPACT card layout (≤ 767px) ═══════
     Same flex-wrap pattern as Date Sheet. Target layout:
       Row 1: #1
       Row 2: [icon] Grade 1 - Section A           [A]
       Row 3: ⚠ Partially Added  (status badge)
       Row 4: [Edit] [Report] [🗑] [v]
     JSX cells inside .syl-row in source order (lines 974–1015):
       1. .syl-td               — # number
       2. .syl-td.cls-name      — .syl-cls-icon + Grade name
       3. .syl-td               — section letter "A"
       4. .syl-td               — .syl-status-badge
       5. .syl-td               — .syl-edit-btn
       6. .syl-td               — .syl-report-btn
       7. .syl-td (last)        — .syl-del-btn + .syl-expand-btn               */
  .syl-row-wrap {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    margin-bottom: 10px;
    overflow: visible !important;
  }
  .syl-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: unset !important;
    height: auto !important;
    min-width: unset !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  /* ─── Row 1 — # number, compact on its own line ─── */
  .syl-row > .syl-td:first-child {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 11px;
    line-height: 1.1;
  }

  /* ─── Row 2 — icon + Grade name + section letter on one row ─── */
  .syl-row > .syl-td.cls-name {
    flex: 1 1 60% !important;
    width: auto !important;
    min-width: 0;
    padding: 0 !important;
    margin: 0 !important;
    justify-content: flex-start !important;
  }
  .syl-row > .syl-td:nth-of-type(3) {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    margin: 0 0 0 auto !important;
    font-size: 13px !important;
    color: var(--text-secondary);
  }

  /* ─── Row 3 — Status badge on its own line, compact ─── */
  .syl-row > .syl-td:nth-of-type(4) {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .syl-row .syl-status-badge {
    display: inline-flex !important;
    margin: 0 !important;
    padding: 3px 8px !important;
    font-size: 12px !important;
  }

  /* ─── Row 4 — ALL action buttons in ONE row.
        Cell 5 (.syl-edit-btn), cell 6 (.syl-report-btn) and
        cell 7 (.syl-del-btn + .syl-expand-btn) share row 4.
        Edit + Report = two flexible buttons; Delete + Chevron =
        fixed-size icon buttons. ─── */
  .syl-row > .syl-td:nth-of-type(5),
  .syl-row > .syl-td:nth-of-type(6) {
    flex: 1 1 0 !important;
    width: 0 !important;
    min-width: 0 !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
    overflow: visible !important;
  }
  .syl-row > .syl-td:last-child {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 4px !important;
  }

  /* ─── Edit / Report — flexible buttons ─── */
  .syl-row .syl-edit-btn,
  .syl-row .syl-report-btn {
    flex: 1 1 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    padding: 6px 8px !important;
    font-size: 11px !important;
    justify-content: center !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ─── Delete + Chevron — fixed 32×32 icon buttons ─── */
  .syl-row .syl-del-btn,
  .syl-row .syl-expand-btn {
    flex-shrink: 0 !important;
    width: 32px !important;
    height: 32px !important;
    padding: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* ─── Strip any empty spacer divs ─── */
  .syl-row > div:empty,
  .syl-row-wrap > div:empty { display: none !important; }

  /* ═══════ SINGLE ASSESSMENT — COMPACT card layout (≤ 767px) ═══════
     Same flex-wrap pattern as Date Sheet / Syllabus. Target layout:
       Row 1: #1
       Row 2: [icon] Grade 1 - Section A          [A]
       Row 3: ⏰ Not Released   (.res-released-badge)
       Row 4: [Publish] [Total Marks] [⬇] [🗑] [v]
     JSX cells inside .res-row in source order (lines 1450–1512):
       1. .res-td               — # number
       2. .res-td.cls-name      — .ds-cls-icon + Grade name
       3. .res-td               — section letter "A"
       4. .res-td               — .res-released-badge
       5. .res-td               — .res-publish-btn (Publish Result)
       6. .res-td               — .res-marks-btn (Total Marks)
       7. .res-td (last)        — .res-download-btn + .ds-del-btn + .ds-expand-btn   */
  .res-table-head { display: none !important; }
  .res-row-wrap {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    margin-bottom: 10px;
    overflow: visible !important;
  }
  .res-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: unset !important;
    height: auto !important;
    min-width: unset !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  /* Row 1 — # number */
  .res-row > .res-td:first-child {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 11px;
    line-height: 1.1;
  }

  /* Row 2 — icon + Grade name + section letter on one row */
  .res-row > .res-td.cls-name {
    flex: 1 1 60% !important;
    width: auto !important;
    min-width: 0;
    padding: 0 !important;
    margin: 0 !important;
    justify-content: flex-start !important;
  }
  .res-row > .res-td:nth-of-type(3) {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    margin: 0 0 0 auto !important;
    font-size: 13px !important;
    color: var(--text-secondary);
  }

  /* Row 3 — Released / Not Released badge */
  .res-row > .res-td:nth-of-type(4) {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .res-row .res-released-badge {
    display: inline-flex !important;
    margin: 0 !important;
    padding: 3px 8px !important;
    font-size: 12px !important;
  }

  /* Row 4 — Publish + Total Marks + icon actions in ONE row.
     Publish + Total Marks share ~equal space via flex: 1 1 0; width: 0.
     Cell 7 (download + delete + chevron) sits at the right with 3 fixed icons. */
  .res-row > .res-td:nth-of-type(5),
  .res-row > .res-td:nth-of-type(6) {
    flex: 1 1 0 !important;
    width: 0 !important;
    min-width: 0 !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
    overflow: visible !important;
  }
  .res-row > .res-td:last-child {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 4px !important;
  }
  .res-row .res-publish-btn,
  .res-row .res-marks-btn {
    flex: 1 1 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    padding: 6px 8px !important;
    font-size: 11px !important;
    justify-content: center !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .res-row .res-download-btn,
  .res-row .ds-del-btn,
  .res-row .ds-expand-btn {
    flex-shrink: 0 !important;
    width: 32px !important;
    height: 32px !important;
    padding: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Strip empty spacer divs */
  .res-row > div:empty,
  .res-row-wrap > div:empty { display: none !important; }

  /* ═══════ COMBINED ASSESSMENT — COMPACT card layout (≤ 767px) ═══════
     Two surfaces:
       (A) .cbr-group-head     — outer group header (Final Term Combined etc.)
       (B) .cbr-class-row      — inner per-class card

     (B) Target layout:
       Row 1: #1
       Row 2: [icon] Grade 1 / Section A · N students
       Row 3: ⏰ Not Published   (.res-released-badge)
       Row 4: [Publish] [⬇] [🗑] [v]
     JSX inside .cbr-class-row (lines 1753–1801):
       1. .cbr-cls-sno          — # number
       2. .cbr-cls-name         — .ds-cls-icon + Grade + meta
       3. <div> (no className)  — .res-released-badge
       4. .cbr-cls-actions      — .res-publish-btn + .res-download-btn
                                  + .ds-del-btn + .ds-expand-btn          */

  /* ─── Outer group header — stack vertically ─── */
  .cbr-group-head {
    display: flex !important;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
    padding: 10px 12px !important;
  }
  .cbr-group-icon {
    align-self: flex-start;
    width: 34px !important;
    height: 34px !important;
  }
  .cbr-group-side {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 8px !important;
  }
  .cbr-group-meta {
    flex-wrap: wrap !important;
    gap: 4px 8px !important;
  }
  .cbr-sub-chip { font-size: 10px !important; padding: 1px 6px !important; }

  /* ─── Inner class card — flex-wrap row pattern ─── */
  .cbr-class-card { overflow: visible !important; }
  .cbr-class-row {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 10px 12px !important;
    grid-template-columns: none !important;
    min-height: unset !important;
    height: auto !important;
    min-width: unset !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
  }

  /* Row 1 — # number */
  .cbr-class-row > .cbr-cls-sno {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 11px;
  }

  /* Row 2 — icon + Grade name + meta line, full width */
  .cbr-class-row > .cbr-cls-name {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    justify-content: flex-start !important;
  }

  /* Row 3 — Published / Not Published badge (the 3rd direct <div>) */
  .cbr-class-row > div:nth-of-type(3) {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* Row 4 — Publish + Download + Delete + Chevron all in one row */
  .cbr-class-row > .cbr-cls-actions {
    flex: 1 1 100% !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 4px 0 0 0 !important;
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 6px !important;
    overflow: visible !important;
  }
  .cbr-cls-actions .res-publish-btn {
    flex: 1 1 0 !important;
    width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    padding: 6px 8px !important;
    font-size: 11px !important;
    justify-content: center !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cbr-cls-actions .res-download-btn,
  .cbr-cls-actions .ds-del-btn,
  .cbr-cls-actions .ds-expand-btn {
    flex-shrink: 0 !important;
    width: 32px !important;
    height: 32px !important;
    padding: 4px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* Strip empty spacer divs */
  .cbr-class-row > div:empty,
  .cbr-class-card > div:empty { display: none !important; }

  /* ═══════ RESULT HISTORY — COMPACT layout (≤ 767px) ═══════
     Two modes:
       (A) Grid view: search + filters + .rh-grid of student .rh-card
       (B) Detail view: .rh-back-btn + .rh-profile-card (.rh-banner +
           .rh-kpi-strip) + subject-average grids                     */

  /* ─── (A) Search bar — full width, compact ─── */
  .rh-search-shell {
    margin-bottom: 12px !important;
    width: 100%;
  }
  .rh-search-wrap {
    width: 100% !important;
    box-sizing: border-box;
  }
  .rh-search-wrap input {
    width: 100%;
    box-sizing: border-box;
    font-size: 13px !important;
    padding: 8px 32px 8px 34px !important;
  }
  .rh-search-icon { left: 11px !important; font-size: 12px !important; }
  .rh-search-clear { right: 8px !important; }

  /* Search dropdown — full width, capped height */
  .rh-search-drop {
    width: calc(100vw - 24px) !important;
    max-width: 100% !important;
    max-height: 60vh !important;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    left: 0 !important;
    right: 0 !important;
  }
  .rh-search-row {
    flex-wrap: wrap !important;
    gap: 8px !important;
    padding: 10px 12px !important;
  }
  .rh-search-avatar {
    width: 36px !important;
    height: 36px !important;
    font-size: 12px !important;
  }
  .rh-search-meta {
    flex: 1 1 60% !important;
    min-width: 0;
  }
  .rh-search-name { font-size: 13px !important; }
  .rh-search-sub {
    font-size: 11px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rh-search-side {
    flex: 0 0 auto !important;
    align-items: flex-end !important;
    text-align: right;
  }
  .rh-search-count,
  .rh-search-avg { font-size: 11px !important; }

  /* ─── (A) Filter row — selects stack to 2-col, meta count wraps to new line ─── */
  .rh-filter {
    flex: 1 1 calc(50% - 6px) !important;
    min-width: 0 !important;
    width: auto !important;
    padding: 7px 10px !important;
    font-size: 12px !important;
    box-sizing: border-box;
  }
  /* The "Showing X students…" meta — its parent has marginLeft: auto via
     inline style. On mobile, push it to its own row by forcing 100% width. */
  .rh-search-shell + div > div:last-child,
  .rh-search-shell ~ div > div[style*="marginLeft: auto"] {
    flex: 1 1 100% !important;
    margin-left: 0 !important;
    text-align: left;
    margin-top: 4px;
  }

  /* ─── (A) Student card polish ─── */
  .rh-card {
    padding: 12px !important;
    width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }
  .rh-card-head {
    gap: 10px !important;
    align-items: flex-start !important;
    flex-wrap: nowrap !important;
  }
  .rh-avatar {
    width: 40px !important;
    height: 40px !important;
    font-size: 13px !important;
    flex-shrink: 0;
  }
  .rh-id {
    min-width: 0 !important;
    flex: 1 1 0 !important;
    width: 0 !important;
    overflow: hidden;
  }
  .rh-name {
    font-size: 14px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rh-father,
  .rh-cls {
    font-size: 11px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rh-grade {
    flex-shrink: 0;
    text-align: center;
    min-width: 36px;
  }
  /* Student card KPI stats (Avg / Best / Att.) — no overflow */
  .rh-kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 6px !important;
  }
  .rh-kpi {
    padding: 8px 6px !important;
    min-width: 0 !important;
    overflow: hidden;
  }
  .rh-kpi > div:first-child {
    font-size: 14px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rh-kpi > div:last-child {
    font-size: 9px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rh-bar { margin-top: 8px !important; }
  .rh-foot {
    flex-wrap: wrap !important;
    gap: 6px 10px !important;
    font-size: 11px !important;
  }
  .rh-foot > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ─── (B) Back button — full width, comfortable tap target ─── */
  .rh-back-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 10px 12px !important;
    margin-bottom: 12px !important;
    box-sizing: border-box;
  }

  /* ─── (B) Profile banner — stack avatar / info / overall grade ─── */
  .rh-profile-card {
    border-radius: 12px !important;
    overflow: hidden;
    margin-bottom: 12px !important;
  }
  .rh-banner {
    flex-direction: row !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    gap: 12px !important;
    padding: 14px 14px !important;
  }
  .rh-banner-avatar {
    width: 48px !important;
    height: 48px !important;
    font-size: 18px !important;
    border-width: 2px !important;
    flex-shrink: 0;
  }
  /* Info block — takes most of the row, can shrink without breaking layout */
  .rh-banner > div:nth-child(2) {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    width: 0 !important;
  }
  .rh-banner > div:nth-child(2) > div:first-child {
    font-size: 16px !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .rh-banner > div:nth-child(2) > div:nth-child(2) {
    font-size: 11px !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  .rh-banner > div:nth-child(2) > div:last-child {
    font-size: 10px !important;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  /* The "Overall grade" block on the right — fixed minimal width so it never overlaps */
  .rh-banner > div:last-child {
    flex: 0 0 auto !important;
    min-width: 44px;
    text-align: center;
  }
  .rh-banner > div:last-child > div:first-child { font-size: 28px !important; }
  .rh-banner > div:last-child > div:last-child { font-size: 9px !important; }

  /* ─── (B) KPI strip — 5 cols → 2 cols on mobile, with proper row borders ─── */
  .rh-kpi-strip {
    grid-template-columns: 1fr 1fr !important;
  }
  /* The inline border-right separators get awkward at 2-col → use border-bottom
     and last-row-trim. Each kpi cell is just an unclassed div; target via :nth-child. */
  .rh-kpi-strip > div {
    padding: 10px 8px !important;
    border-right: none !important;
    border-bottom: 1px solid var(--border-light) !important;
  }
  .rh-kpi-strip > div:nth-child(odd) {
    border-right: 1px solid var(--border-light) !important;
  }
  /* Hide bottom border on the last row (4th + 5th cells when 5 items in 2 cols) */
  .rh-kpi-strip > div:nth-last-child(-n+2) { border-bottom: none !important; }
  .rh-kpi-strip > div > div:first-child { font-size: 9px !important; }
  .rh-kpi-strip > div > div:last-child { font-size: 17px !important; }

  /* ─── Strip empty spacer divs in the result-history surfaces ─── */
  .rh-card > div:empty,
  .rh-profile-card > div:empty,
  .rh-kpi-strip > div:empty { display: none !important; }

  /* ═══════ RESULT HISTORY — student DETAIL VIEW inner sections ═══════
     Sections inside the .rh-two-col layout (lines 2001–2208):
       Left column:
         .rh-history-card     — exam history list
           .rh-history-head   — title + count
           .rh-timeline-row   — each exam row
         .rh-trend-card       — performance trend bars chart
           .rh-trend-scroll   — horizontal scroll container
           .rh-trend-bars     — bars wrapper
             .rh-trend-item   — each bar (.rh-trend-pct + .rh-trend-track + .rh-trend-lbl)
       Right column:
         .rh-side-card        — generic side panel
           .rh-subj-row       — subject performance row
             .rh-subj-name + .rh-subj-bar
           .rh-insight        — insight badge (--good, --warn, --bad)
             .rh-insight-title + .rh-insight-sub
           .rh-report-card    — download report card
             .rh-report-btn   — download button                          */

  /* ─── Two-column layout collapses to single column already at 980px ─── */
  .rh-two-col {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
  }

  /* ─── Exam History card ─── */
  .rh-history-card { border-radius: 12px !important; margin-bottom: 12px !important; }
  .rh-history-head {
    flex-wrap: wrap !important;
    gap: 6px !important;
    padding: 10px 12px !important;
  }

  /* Timeline row — stack into compact card layout */
  .rh-timeline-row {
    flex-wrap: wrap !important;
    gap: 8px !important;
    padding: 12px !important;
    align-items: flex-start !important;
  }
  /* Timeline dot — stays at top-left */
  .rh-timeline-row > div:first-child { margin-top: 4px !important; }
  /* Exam name + meta block — full width on its own line */
  .rh-timeline-row > div:nth-child(2) {
    flex: 1 1 calc(100% - 22px) !important;
    min-width: 0;
  }
  /* Score bar wrapper — full width on its own line */
  .rh-timeline-row > div:nth-child(3) {
    flex: 1 1 100% !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: 100% !important;
    margin: 0 !important;
  }
  /* Grade letter + Position — sit side by side */
  .rh-timeline-row > div:nth-child(4),
  .rh-timeline-row > div:nth-child(5) {
    flex: 0 0 auto !important;
    width: auto !important;
    padding: 0 8px !important;
    text-align: center !important;
  }
  /* Actions cluster — push to right end of last visual row */
  .rh-timeline-row > div:last-child {
    flex: 1 1 auto !important;
    justify-content: flex-end !important;
    align-items: center !important;
    margin-left: auto;
  }
  .rh-timeline-row .res-action-btn,
  .rh-timeline-row .res-action-btn.view {
    padding: 6px 10px !important;
    font-size: 11px !important;
  }

  /* ─── Performance Trends chart — auto-fit (no horizontal scroll) ─── */
  .rh-trend-card {
    border-radius: 12px !important;
    padding: 12px !important;
    margin-bottom: 12px !important;
    overflow: hidden !important;
  }
  .rh-trend-scroll {
    overflow-x: hidden !important;
    overflow-y: visible !important;
    width: 100% !important;
  }
  .rh-trend-bars {
    min-width: 0 !important;
    width: 100% !important;
    display: flex !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    align-items: flex-end !important;
  }
  .rh-trend-item {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    max-width: none !important;
    padding: 0 !important;
  }
  .rh-trend-pct {
    font-size: 9.5px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .rh-trend-track {
    width: 100% !important;
    min-width: 0 !important;
  }
  .rh-trend-lbl {
    font-size: 8.5px !important;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 1px;
  }

  /* ─── Right column side cards (Subject Performance / Insights / Downloads) ─── */
  .rh-side-card {
    border-radius: 12px !important;
    padding: 12px !important;
    margin-bottom: 0 !important;
  }

  /* Subject Performance rows */
  .rh-subj-row {
    gap: 8px !important;
    padding: 7px 0 !important;
  }
  .rh-subj-name {
    flex: 0 0 90px !important;
    min-width: 0;
    font-size: 11.5px !important;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rh-subj-bar {
    flex: 1 1 auto !important;
    min-width: 0;
  }

  /* Academic Insight chips */
  .rh-insight {
    padding: 10px 12px !important;
    gap: 9px !important;
    align-items: flex-start !important;
    margin-bottom: 8px !important;
  }
  .rh-insight i { font-size: 14px !important; margin-top: 1px; }
  .rh-insight-title { font-size: 12px !important; }
  .rh-insight-sub {
    font-size: 11px !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Download report cards */
  .rh-report-card {
    padding: 10px 12px !important;
  }
  .rh-report-btn {
    width: 100% !important;
    justify-content: center !important;
    padding: 8px 12px !important;
    font-size: 12px !important;
    box-sizing: border-box;
  }

  /* Empty spacers inside detail view sections */
  .rh-history-card > div:empty,
  .rh-trend-card > div:empty,
  .rh-side-card > div:empty,
  .rh-timeline-row > div:empty { display: none !important; }

  /* ─── Subject tab strip inside Syllabus editor ─── */
  .syl-subj-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap !important;
  }
  .syl-subj-tabs::-webkit-scrollbar { display: none; }
  .syl-subj-tab { flex: 0 0 auto; }

  /* ─── RESULTS SUB-TAB BAR (Result Setup / Single / Combined / History) ─── */
  .res-sub-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap !important;
    white-space: nowrap;
  }
  .res-sub-tabs::-webkit-scrollbar { display: none; }
  .res-sub-tab {
    flex: 0 0 auto;
    min-width: 140px;
    padding: 10px 14px;
    font-size: 12.5px;
  }

  /* ─── Term filter pills — wrap (short pills) ─── */
  .rh-term-pills,
  .res-term-pills,
  .rh-filter-pills,
  .res-filter-bar {
    flex-wrap: wrap;
    gap: 6px;
  }

  /* ─── RESULT HISTORY CARDS (.rh-card) ─── */
  .rh-grid {
    grid-template-columns: 1fr !important;
    gap: 10px;
  }
  .rh-card { padding: 12px 14px; }
  .rh-card-head { gap: 10px; }
  .rh-name { font-size: 14px; }
  .rh-father { font-size: 11px; }
  .rh-cls { font-size: 11px; }
  .rh-kpis { grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .rh-kpi { padding: 8px 6px; }
  .rh-foot { flex-wrap: wrap; gap: 6px 12px; }

  /* ─── RH KPI strip / sections ─── */
  .rh-kpi-strip {
    grid-template-columns: 1fr 1fr !important;
    gap: 8px;
  }
  .rh-two-col,
  .rco-grid,
  .rct-grid {
    grid-template-columns: 1fr !important;
    gap: 10px;
  }

  /* ─── STUDENT STATS (Avg / Best / Worst / Attend) ─── */
  .stu-stats,
  .student-stats {
    grid-template-columns: 1fr 1fr !important;
    gap: 10px;
    padding: 12px;
  }
  .stu-stats .stat-item,
  .student-stats .stat-item {
    text-align: center;
    padding: 8px;
    border-radius: 8px;
  }

  /* ─── Result student tables — keep horizontal scroll w/ sticky col ─── */
  .res-student-scroll,
  .cbr-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .res-student-table,
  .cbr-student-table { min-width: 760px; }

  /* ─── Result trend bars chart — horizontal scroll ─── */
  .rh-trend-bars {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    min-width: 520px;
  }

  /* ─── CBR group head/body — stack ─── */
  .cbr-group-head {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .cbr-group-side { justify-content: flex-start !important; gap: 8px; }

  /* ─── Modals (exam-modal, rs-modal, syl-edit-modal, ds-edit-modal, etc.) ─── */
  .exam-modal,
  .exam-modal.ds-edit-modal,
  .exam-modal.syl-edit-modal,
  .exam-modal.rs-modal,
  .report-picker,
  .rc-preview-shell {
    max-width: 95vw !important;
    max-height: 90vh !important;
    border-radius: 12px;
  }
  .exam-modal-head,
  .exam-modal-body,
  .exam-modal-foot { padding-left: 14px !important; padding-right: 14px !important; }
  .exam-modal-foot {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  .exam-modal-foot > button { width: 100%; }

  /* ─── Edit form grids — 1 col ─── */
  .ds-edit-fields,
  .ds-edit-fields-row,
  .exam-form-grid {
    grid-template-columns: 1fr !important;
    gap: 10px;
  }

  /* ─── Result setup config grids ─── */
  .rs-cfg-grid,
  .rs-grade-grid { grid-template-columns: 1fr !important; gap: 10px; }

  /* ─── Confirm delete dialog (.confirm-overlay / .confirm-dialog) ─── */
  .confirm-dialog { max-width: 95vw !important; }
  .confirm-footer { flex-direction: column; gap: 8px; }
  .confirm-footer .confirm-btn { width: 100%; }
}

/* ═══════════════════════════════════════════════════════════════════
   TABLET RESPONSIVE — Examination (768px – 1023px)
   ═══════════════════════════════════════════════════════════════════ */
@media (min-width: 768px) and (max-width: 1023px) {
  .rh-grid { grid-template-columns: repeat(2, 1fr); }
  .rh-kpi-strip { grid-template-columns: repeat(2, 1fr); }
  .stu-stats,
  .student-stats { grid-template-columns: repeat(2, 1fr); }
  .rco-grid,
  .rct-grid { grid-template-columns: repeat(2, 1fr); }
}
`;
