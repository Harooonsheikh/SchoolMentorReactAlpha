import React, { useEffect, useMemo, useRef, useState } from 'react';
import Tooltip from './Tooltip';
import * as academicsService from '../services/academicsService';
import useAsync from '../hooks/useAsync';
import { buildUrl } from '../../utils/apiConfig';
import { termsCrud, termsBranchID, termsSessionYearID } from './Academics';

/* ═══════════════════════════════════════════════════════════════════
   LESSON PLANS — port from
   ~/Desktop/ERP-html/Complete Academics and Examination.html
   (panel-lp, ss-card-*, tb-*, clp2-*, clpm-*, umgr-*, nb-*)
   ═══════════════════════════════════════════════════════════════════ */

const LP_CLASSES = [
  'Nursery', 'KG-1', 'KG-2',
  'Class I', 'Class II', 'Class III', 'Class IV', 'Class V',
  'Class VI', 'Class VII', 'Class VIII',
  'Class IX Sci', 'Class IX Arts', 'Class X Sci', 'Class X Arts',
  'FSc I Pre-Med', 'FSc I Pre-Eng', 'FSc II Pre-Med', 'FSc II Pre-Eng',
  'O-Levels',
];

const LP_SUBJECTS_BY_CLASS = {
  default: ['English', 'Urdu', 'Mathematics', 'Science', 'Social Studies', 'Islamiat'],
  'Nursery': ['English', 'Urdu', 'Numeracy', 'Rhymes'],
  'KG-1': ['English', 'Urdu', 'Numeracy', 'Activities'],
  'KG-2': ['English', 'Urdu', 'Numeracy', 'Activities'],
};

/* Academic session + vacations now load via academicsService
   (src/services/academicsService.js). Edits stay in-memory until backend
   wires the matching endpoints. */

const PER_WEEK_BY_CLASS = {
  'Class I':   [{s:'English', n:5}, {s:'Urdu', n:5}, {s:'Mathematics', n:5}, {s:'Science', n:3}, {s:'Islamiat', n:2}],
  'Class II':  [{s:'English', n:5}, {s:'Urdu', n:5}, {s:'Mathematics', n:5}, {s:'Science', n:3}, {s:'SST', n:2}, {s:'Islamiat', n:2}],
  'Class III': [{s:'English', n:6}, {s:'Urdu', n:5}, {s:'Mathematics', n:5}, {s:'Science', n:4}, {s:'SST', n:3}, {s:'Islamiat', n:2}],
  'Class IX Sci': [{s:'Physics', n:5}, {s:'Chemistry', n:5}, {s:'Biology', n:5}, {s:'Maths', n:5}, {s:'English', n:5}, {s:'Urdu', n:4}, {s:'Islamiat', n:2}],
};

/* Term breakup classes, units, notebook units, and sub-screen seeds now load
   via academicsService.{getTermBreakupClasses, getUnits, getNbUnits,
   getSubLpData, getSubNbData}. Edits stay in-memory until backend wires
   the matching endpoints. */

const TERM_BREAKUP_TERMS = ['Term 1', 'Term 2', 'Term 3'];
const TERM_BREAKUP_SUBJECTS = ['English', 'Urdu', 'Mathematics', 'Science', 'Islamiat'];



// NB_QUESTION_TYPES replaced by AQ_TYPES (verbatim from HTML — see below).

/* ═══════════════════════════════════════════════════════════════════
   ADD QUESTIONS — types + config — verbatim from HTML
   ═══════════════════════════════════════════════════════════════════ */
const AQ_TYPES = [
  { id:'word_opposite',   label:'Word/Opposite',           icon:'fa-arrows-left-right' },
  { id:'singular_plural', label:'Singular/Plural',          icon:'fa-clone' },
  { id:'word_synonyms',   label:'Word/Synonyms',            icon:'fa-spell-check' },
  { id:'word_sentences',  label:'Word Sentences',           icon:'fa-pen-line' },
  { id:'mcqs',            label:'MCQs Field',               icon:'fa-list-ol' },
  { id:'fill_blanks',     label:'Fill in the Blanks',       icon:'fa-underline' },
  { id:'true_false',      label:'True / False',             icon:'fa-check-to-slot' },
  { id:'match_columns',   label:'Match the Columns',        icon:'fa-table-columns' },
  { id:'short_questions', label:'Short Questions',          icon:'fa-comment-dots' },
  { id:'circle_words',    label:'Circle the Correct Words', icon:'fa-circle-dot' },
  { id:'punctuation',     label:'Punctuation',              icon:'fa-exclamation' },
  { id:'long_question',   label:'Long Question',            icon:'fa-align-left' },
  { id:'paragraph',       label:'Paragraph Writing',        icon:'fa-paragraph' },
  { id:'comprehension',   label:'Comprehension',            icon:'fa-book-open' },
  { id:'letter',          label:'Letter',                   icon:'fa-envelope' },
  { id:'application',     label:'Application',              icon:'fa-file-pen' },
  { id:'stories',         label:'Stories',                  icon:'fa-book-bookmark' },
  { id:'essays',          label:'Essays',                   icon:'fa-feather-pointed' },
];

const AQ_CONFIG = {
  word_opposite:   { title:'Word / Opposite',         fields:[{key:'word',label:'Word',ph:'e.g. Big'},{key:'opposite',label:'Opposite',ph:'e.g. Small'}],                                                             layout:'two-col', arrow:'↔' },
  singular_plural: { title:'Singular / Plural',        fields:[{key:'singular',label:'Singular',ph:'e.g. Cat'},{key:'plural',label:'Plural',ph:'e.g. Cats'}],                                                         layout:'two-col', arrow:'→' },
  word_synonyms:   { title:'Word / Synonyms',          fields:[{key:'word',label:'Word',ph:'e.g. Happy'},{key:'synonym',label:'Synonym',ph:'e.g. Joyful'}],                                                           layout:'two-col', arrow:'=' },
  word_sentences:  { title:'Word Sentences',           layout:'word-sentence' },
  mcqs:            { title:'MCQs Field',               layout:'mcq' },
  fill_blanks:     { title:'Fill in the Blanks',       layout:'fill-blanks' },
  true_false:      { title:'True / False',             layout:'true_false' },
  match_columns:   { title:'Match the Columns',        layout:'match' },
  short_questions: { title:'Short Questions',          layout:'short-q' },
  circle_words:    { title:'Circle the Correct Words', layout:'circle' },
  punctuation:     { title:'Punctuation',              layout:'punctuation' },
  long_question:   { title:'Long Question',            layout:'long' },
  paragraph:       { title:'Paragraph Writing',        fields:[{key:'title',label:'Title',ph:'Enter title',rte:true},{key:'body',label:'Paragraph Body',ph:'Write paragraph here…',rte:true}],                          layout:'vertical-expand' },
  comprehension:   { title:'Comprehension Question',   layout:'comprehension' },
  letter:          { title:'Letter',                   fields:[{key:'subject',label:'Subject',ph:'Enter subject',rte:true},{key:'body',label:'Body',ph:'Write letter body…',rte:true}],                                 layout:'vertical-expand' },
  application:     { title:'Application',              fields:[{key:'subject',label:'Subject',ph:'Enter subject',rte:true},{key:'body',label:'Body',ph:'Write application body…',rte:true}],                            layout:'vertical-expand' },
  stories:         { title:'Stories',                  fields:[{key:'title',label:'Title',ph:'Enter story title',rte:true},{key:'body',label:'Story Body',ph:'Write the story…',rte:true},{key:'moral',label:'Moral',ph:'Moral of the story…',rte:true}], layout:'vertical-expand' },
  essays:          { title:'Essays',                   fields:[{key:'title',label:'Title',ph:'Enter essay title',rte:true},{key:'body',label:'Essay Body',ph:'Write the essay…',rte:true},{key:'conclusion',label:'Conclusion',ph:'Write conclusion…',rte:true}], layout:'vertical-expand' },
};

let _aqRowCounter = 0;
function aqEmptyRow(typeId) {
  const cfg = AQ_CONFIG[typeId];
  const _id = `aqr_${++_aqRowCounter}`;
  if (!cfg) return { _id };
  if (cfg.layout === 'mcq')             return { _id, question:'', opt1:'', opt2:'', opt3:'', opt4:'', correct:'' };
  if (cfg.layout === 'true_false')      return { _id, question:'', answer:'' };
  if (cfg.layout === 'match')           return { _id, colA:'', colB:'' };
  if (cfg.layout === 'comprehension')   return { _id, question:'', answer:'' };
  if (cfg.layout === 'word-sentence')   return { _id, word:'', sentence:'' };
  if (cfg.layout === 'fill-blanks')     return { _id, question:'', answer:'' };
  if (cfg.layout === 'short-q')         return { _id, question:'', answer:'' };
  if (cfg.layout === 'circle')          return { _id, statement:'', answer:'' };
  if (cfg.layout === 'punctuation')     return { _id, question:'', answer:'' };
  if (cfg.layout === 'long')            return { _id, question:'', answer:'' };
  const row = { _id };
  (cfg.fields || []).forEach(f => { row[f.key] = ''; });
  return row;
}

function aqOrdinal(n) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th'; }

/* ═══════════════════════════════════════════════════════════════════
   SUBMISSIONS — data verbatim from HTML (SUB_LP_DATA, SUB_NB_DATA)
   ═══════════════════════════════════════════════════════════════════ */


const SUB_NB_QTYPE_META = {
  word_opposite:   { label:'Word / Opposite',           icon:'fa-arrows-left-right', color:'linear-gradient(135deg,#1E3A8A,#1E40AF)' },
  singular_plural: { label:'Singular / Plural',          icon:'fa-clone',             color:'linear-gradient(135deg,#0891B2,#0E7490)' },
  word_synonyms:   { label:'Word / Synonyms',            icon:'fa-spell-check',       color:'linear-gradient(135deg,#7C3AED,#6D28D9)' },
  word_sentences:  { label:'Word Sentences',             icon:'fa-pen-line',          color:'linear-gradient(135deg,#D97706,#B45309)' },
  mcqs:            { label:'MCQs',                       icon:'fa-list-ol',           color:'linear-gradient(135deg,#1E3A8A,#2563EB)' },
  fill_blanks:     { label:'Fill in the Blanks',         icon:'fa-underline',         color:'linear-gradient(135deg,#0891B2,#06B6D4)' },
  true_false:      { label:'True / False',               icon:'fa-check-to-slot',     color:'linear-gradient(135deg,#16A34A,#15803D)' },
  match_columns:   { label:'Match the Columns',          icon:'fa-table-columns',     color:'linear-gradient(135deg,#E11D48,#BE123C)' },
  short_questions: { label:'Short Questions',            icon:'fa-comment-dots',      color:'linear-gradient(135deg,#D97706,#B45309)' },
  circle_words:    { label:'Circle the Correct Words',   icon:'fa-circle-dot',        color:'linear-gradient(135deg,#1E40AF,#1E3A8A)' },
  punctuation:     { label:'Punctuation',                icon:'fa-exclamation',       color:'linear-gradient(135deg,#6D28D9,#7C3AED)' },
  long_question:   { label:'Long Questions',             icon:'fa-align-left',        color:'linear-gradient(135deg,#7C3AED,#6D28D9)' },
  paragraph:       { label:'Paragraph Writing',          icon:'fa-paragraph',         color:'linear-gradient(135deg,#1E40AF,#1E3A8A)' },
  comprehension:   { label:'Comprehension',              icon:'fa-book-open',         color:'linear-gradient(135deg,#1E3A8A,#1E40AF)' },
  letter:          { label:'Letter',                     icon:'fa-envelope',          color:'linear-gradient(135deg,#D97706,#92400E)' },
  application:     { label:'Application',                icon:'fa-file-pen',          color:'linear-gradient(135deg,#DC2626,#B91C1C)' },
  stories:         { label:'Stories',                    icon:'fa-book-bookmark',     color:'linear-gradient(135deg,#0369A1,#0891B2)' },
  essays:          { label:'Essays',                     icon:'fa-feather-pointed',   color:'linear-gradient(135deg,#16A34A,#1E40AF)' },
};

const SUB_CLASSES  = ['Class-I','Class-II','Class-III','Class-IV','Class-V','Class-VI','Class-VII','Class-VIII','Class-IX','Class-X'];
const SUB_SECTIONS = ['A','B','C'];
const SUB_SUBJECTS = ['English','Urdu','Mathematics','Science','Social Studies','Islamiat'];

/* ── ADMIN OVERVIEW DATA — verbatim from HTML SUB_ADMIN_TEACHERS ── */
const SUB_ADMIN_TEACHERS = [
  { name:'Mr. Ahmed Ali',    subject:'Science', class:'Class V',    lp:{ total:15, submitted:15 }, nb:{ total:35, submitted:35 } },
  { name:'Ms. Fatima Noor',  subject:'English', class:'Class VI',   lp:{ total:12, submitted:8  }, nb:{ total:28, submitted:20 } },
  { name:'Mr. Usman Raza',   subject:'Math',    class:'Class VII',  lp:{ total:18, submitted:10 }, nb:{ total:42, submitted:28 } },
  { name:'Ms. Ayesha Khan',  subject:'Urdu',    class:'Class IV',   lp:{ total:14, submitted:6  }, nb:{ total:30, submitted:12 } },
  { name:'Mr. Bilal Hassan', subject:'SST',     class:'Class VIII', lp:{ total:16, submitted:3  }, nb:{ total:35, submitted:10 } },
];

const SUB_ADMIN_CLASSES = [
  { cls:'Class IV',   subj:'Urdu',    teacher:'Ms. Ayesha Khan',   lp:14, lpSub:6,  nb:30, nbSub:12 },
  { cls:'Class V',    subj:'Science', teacher:'Mr. Ahmed Ali',     lp:15, lpSub:15, nb:35, nbSub:35 },
  { cls:'Class VI',   subj:'English', teacher:'Ms. Fatima Noor',   lp:12, lpSub:8,  nb:28, nbSub:20 },
  { cls:'Class VII',  subj:'Math',    teacher:'Mr. Usman Raza',    lp:18, lpSub:10, nb:42, nbSub:28 },
  { cls:'Class VIII', subj:'SST',     teacher:'Mr. Bilal Hassan',  lp:16, lpSub:3,  nb:35, nbSub:10 },
];

const SUB_ADMIN_SUBJECTS = [
  { subj:'Science', icon:'🔬', total:50, submitted:50, teachers:['Mr. Ahmed Ali'] },
  { subj:'English', icon:'📖', total:40, submitted:28, teachers:['Ms. Fatima Noor'] },
  { subj:'Math',    icon:'📐', total:60, submitted:38, teachers:['Mr. Usman Raza'] },
  { subj:'Urdu',    icon:'✍️', total:44, submitted:18, teachers:['Ms. Ayesha Khan'] },
  { subj:'SST',     icon:'🌍', total:51, submitted:13, teachers:['Mr. Bilal Hassan'] },
];

/* Rich-text editor sections — verbatim from HTML CLPM_SECTIONS / CLPM_SECTIONS_URDU */
const LESSON_SECTIONS_EN = [
  { key: 'slo',   title: '🎯 Student Learning Objective',  hint: "What will students be able to do by the end of this lesson?", mins: '05' },
  { key: 'intro', title: '📖 Lesson Introduction',          hint: "How will you start the lesson to grab students' attention?", mins: '05' },
  { key: 'devel', title: '🔬 Development / Main Teaching',  hint: 'Step-by-step explanation of the new concept or skill',       mins: '20' },
  { key: 'recap', title: '✅ Recap / Consolidation',         hint: 'How will you check what students have learned today?',      mins: '10' },
];
const LESSON_SECTIONS_UR = [
  { key: 'slo',   title: '🎯 طلباء کا سیکھنے کا مقصد',         hint: 'اس سبق کے اختتام پر طلباء کیا کر سکیں گے؟', mins: '05' },
  { key: 'intro', title: '📖 سبق کا تعارف',                    hint: 'آپ طلباء کی توجہ حاصل کرنے کے لیے سبق کا آغاز کیسے کریں گے؟', mins: '05' },
  { key: 'devel', title: '🔬 ترقی / مرکزی تدریس',              hint: 'نئے مفہوم یا مہارت کی مرحلہ وار وضاحت',     mins: '20' },
  { key: 'recap', title: '✅ خلاصہ / اعادہ',                    hint: 'آپ کیسے جانچیں گے کہ طلباء نے آج کیا سیکھا؟', mins: '10' },
];

/* ═══════════════════════════════════════════════════════════════════
   MAIN MODULE
   ═══════════════════════════════════════════════════════════════════ */
export default function LessonPlans({ toast, openConfirm }) {
  const [tab, setTab] = useState('session'); // session | breakup | create | view

  /* Session summary + vacations load live from getsessionsummarybybranchid
     (see loadSessionSummary). Seed sensible defaults so the cards render before
     the fetch resolves. */
  const [session, setSession]     = useState({ year: '', start: '', end: '', workingDaysPerWeek: 5, workingDays: 0, workingWeeks: 0, totalOnDays: 0, holidays: 0, vacationDays: 0 });
  const [vacations, setVacations] = useState([]);

  /* Persist the academic session via lpsessionsummarycrud, then reload from
     the server. Existing summary (has id) → update, otherwise insert. */
  const saveSession = async base => {
    const wpw = Number(base.workingDaysPerWeek) || 0;
    const computed = computeSession({ ...session, ...base, workingDaysPerWeek: wpw }, vacations);
    const grossWorkingDays = computed.workingDays + computed.vacationDays; // before vacation subtraction
    try {
      await lpPost('/api/lpsessionsummarycrud', {
        id: session.id || 0,
        branchID: sessionStorage.getItem('branchID') || '',
        sessionYearID: sessionStorage.getItem('sessionID') || sessionStorage.getItem('SessionID') || '',
        sessionStart: lpToIso(base.start),
        sessionEnd: lpToIso(base.end),
        workingDaysPerWeek: String(wpw),
        remainingWorkingDays: String(grossWorkingDays),
        action: session.id ? 'update' : 'insert',
      });
      toast('Academic session saved', 'success');
      loadSessionSummary();
    } catch (e) {
      console.error('Error saving session:', e);
      toast('Could not save session', 'error');
    }
  };

  const loadSessionSummary = async () => {
    try {
      const branchID  = sessionStorage.getItem('branchID');
      /* Prefer the switched session so its record loads; fall back to login session. */
      const sessionID = sessionStorage.getItem('changeSessionId') || sessionStorage.getItem('sessionID') || sessionStorage.getItem('SessionID') || '';
      const token     = sessionStorage.getItem('token') || '';
      const res = await fetch(
        buildUrl(`/api/getsessionsummarybybranchid?branchID=${branchID}&sessionID=${sessionID}&pageNo=1`),
        { method: 'GET', headers: { Accept: '*/*', Authorization: `bearer ${token}` } },
      );
      const json = await res.json();
      const rows = json?.data || [];
      if (!rows.length) return;
      const fmt = d => (d ? String(d).slice(0, 10) : '');
      const palette = ['#1E40AF', '#22C55E', '#F59E0B', '#7C3AED', '#EF4444', '#0EA5E9'];
      const first = rows[0];
      /* Each row repeats the session and carries one vacation detail; keep the real ones. */
      const vacs = rows
        .filter(r => r.vacationName && r.vacationName !== 'string' && fmt(r.vacationStart) > '0001-01-01')
        .map((r, i) => ({
          id: r.detailID ?? Date.now() + i,
          name: r.vacationName,
          start: fmt(r.vacationStart),
          end: fmt(r.vacationEnd),
          color: palette[i % palette.length],
        }));
      const base = {
        id: first.id,
        year: session.year,
        start: fmt(first.sessionStart),
        end: fmt(first.sessionEnd),
        workingDaysPerWeek: Number(first.workingDaysPerWeek) || 0,
      };
      setSession(computeSession(base, vacs));
      setVacations(vacs);
    } catch (e) {
      console.error('Error loading session summary:', e);
    }
  };

  useEffect(() => { loadSessionSummary(); }, []);

  const [sessionEditOpen, setSessionEditOpen] = useState(false);
  const [vacationEditOpen, setVacationEditOpen] = useState(false);
  const [perWeekEditOpen, setPerWeekEditOpen] = useState(false);
  /* Bumped after the Per Week modal saves so the view card refetches its counts. */
  const [pwRefresh, setPwRefresh] = useState(0);
  /* Resolved ids (branchID/classID/sectionID/subjectID) for the fetched lesson
     plans — used by the ULP class-master CRUD (the API returns sectionID 0, so we
     keep the real selected ids here). */
  const [clpCtx, setClpCtx] = useState({});

  /* Term Breakup state */
 const [tbModalClass, setTbModalClass] = useState(null);
const [tbRefreshKey, setTbRefreshKey] = useState(0);

  /* Per Week Lesson Plans selected class — lifted so report can read it */
  const [pwSelectedClass, setPwSelectedClass] = useState('');

  /* Create Lesson Plans state — lifted so selections survive L2 tab changes
     (CreateLessonPlans unmounts when you leave the Create tab). */
  const [clpClass,   setClpClass]   = useState('');
  const [clpSection, setClpSection] = useState('');
  const [clpSubject, setClpSubject] = useState('');
  const [clpSections, setClpSections] = useState([]);
  const [clpSubjects, setClpSubjects] = useState([]);
  const [clpFetched, setClpFetched] = useState(false);
  const [clpSubtab,  setClpSubtab]  = useState('lesson');
  /* Bumped when a lesson/unit modal closes so CreateLessonPlans re-fetches. */
  const [clpRefresh, setClpRefresh] = useState(0);
  const bumpClpRefresh = () => setClpRefresh(n => n + 1);
  const { data: units = [],   setData: setUnits }   = useAsync(academicsService.getUnits,   []);
  const { data: nbUnits = [], setData: setNbUnits } = useAsync(academicsService.getNbUnits, []);
  const { data: termBreakupClasses = [] } = useAsync(academicsService.getTermBreakupClasses, []);

  const [unitMgrSource, setUnitMgrSource] = useState(null); // 'lesson' | 'notebook' | null
  const [lessonEdit,    setLessonEdit]    = useState(null); // { unitId, lessonId, lesson }
  const [nbAddCtx,      setNbAddCtx]      = useState(null); // { unitId }
  const [nbEdit,        setNbEdit]        = useState(null); // { unitId, qId }

  /* Reports */
  const [reportPicker, setReportPicker] = useState(null); // { name, format }
  const openReport = (name, format = 'pdf') => setReportPicker({ name, format });
  const [classesData, setClassesData] = useState([]);
const getClassesData = async () => {
  try {
    const branchID = sessionStorage.getItem("branchID");
    const empID = sessionStorage.getItem("employee_ID");

    const res = await fetch(
      buildUrl(`/get-classlist-sectionlist-studentlist-by-branch/${branchID}/${empID}`),
      {
        method: "GET",
        headers: {
          Accept: "*/*",
        },
      }
    );

    const json = await res.json();

    console.log("API Response:", json);

    setClassesData(json.data || []);
  } catch (error) {
    console.error("Error loading classes:", error);
  }
};

  /* Load classes on mount so every module (Session Settings, Term Breakups,
     Create Lesson Plans, Submissions) has the class list without needing a tab
     click — the default 'session' tab otherwise renders before any fetch. */
  useEffect(() => { getClassesData(); }, []);

  return (
    <>
      <style>{LP_CSS}</style>

      {/* ─── L2 sub-tabs ─── */}
      <div className="lp-l2-tabs">
        <button className={`lp-l2-tab${tab === 'session' ? ' active' : ''}`} onClick={() =>{setTab('session'); getClassesData();}}>
          <i className="fa-solid fa-gear"></i> Session Settings
        </button>
        <button className={`lp-l2-tab${tab === 'breakup' ? ' active' : ''}`} onClick={() => {
    setTab('breakup');
    getClassesData(); // Call the function here
  }}>
          <i className="fa-solid fa-layer-group"></i> Term Breakups
        </button>
        <button className={`lp-l2-tab${tab === 'create' ? ' active' : ''}`} onClick={() => {setTab('create'); getClassesData();}}>
          <i className="fa-solid fa-plus-circle"></i> Create Lesson Plans
        </button>
        <button className={`lp-l2-tab${tab === 'view' ? ' active' : ''}`} onClick={() => {setTab('view'); getClassesData();}}>
          <i className="fa-solid fa-table-list"></i> Submissions
        </button>
      </div>

      {tab === 'session' && (
        <SessionSettings
          session={session}
          vacations={vacations}
          selectedClass={pwSelectedClass}
          setSelectedClass={setPwSelectedClass}
          onEditSession={() => setSessionEditOpen(true)}
          onEditVacations={() => setVacationEditOpen(true)}
          onEditPerWeek={() => setPerWeekEditOpen(true)}
          onReport={openReport}
          classesData={classesData}  // Pass the fetched data
          pwRefresh={pwRefresh}
        />
      )}

      {tab === 'breakup' && (
        <TermBreakups
         classesData={classesData}
         refreshKey={tbRefreshKey}  // Pass the fetched data
          onUpdate={c => setTbModalClass(c)}
          onReport={openReport}
          openConfirm={openConfirm}
          toast={toast}
        />
      )}

      {tab === 'create' && (
        <CreateLessonPlans
                 classesData={classesData}  // Pass the fetched data

          clpClass={clpClass} setClpClass={setClpClass}
          clpSubject={clpSubject} setClpSubject={setClpSubject}
          clpSection={clpSection} setClpSection={setClpSection}
          sections={clpSections} setSections={setClpSections}
          subjects={clpSubjects} setSubjects={setClpSubjects}
          clpFetched={clpFetched} setClpFetched={setClpFetched}
          clpSubtab={clpSubtab} setClpSubtab={setClpSubtab}
          clpRefresh={clpRefresh}
          units={units} setUnits={setUnits}
          nbUnits={nbUnits} setNbUnits={setNbUnits}
          setClpCtx={setClpCtx}
          onManageUnits={src => setUnitMgrSource(src)}
          onEditLesson={async (unitId, lessonId, lesson, unit) => {
            /* Load the lesson-plan detail for this topic so the modal opens pre-filled. */
            let detail = null;
            const masterId = lesson?.record?.id;
            if (masterId && clpCtx.classID && clpCtx.subjectID) {
              try {
                const token = sessionStorage.getItem('token') || '';
                const res = await fetch(
                  buildUrl(`/api/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${masterId}&classID=${clpCtx.classID}&subjectID=${clpCtx.subjectID}&pageNo=1`),
                  { method: 'GET', headers: { Accept: '*/*', Authorization: `bearer ${sessionStorage.getItem('token') || ''}` } },
                );
                const json = await res.json();
                detail = (json?.data || [])[0] || null;
              } catch (e) { console.error('Error loading lesson detail:', e); }
            }
            setLessonEdit({ unitId, lessonId, lesson, unit, clpClass, clpSubject, ...clpCtx, detail });
          }}
          onAddQuestionType={unitId => setNbAddCtx({ unitId })}
          onEditQuestionType={(unitId, qId) => setNbEdit({ unitId, qId })}
          onReport={openReport}
          openConfirm={openConfirm}
          toast={toast}
        />
      )}

      {tab === 'view' && <Submissions toast={toast}  classesData={classesData}  />}

      {/* ─── modals ─── */}
      <SessionEditModal
        open={sessionEditOpen}
        session={session}
        vacations={vacations}
        onSession={saveSession}
        onClose={() => setSessionEditOpen(false)}
        toast={toast}
        openConfirm={openConfirm}
      />

      <VacationEditModal
        open={vacationEditOpen}
        vacations={vacations}
        session={session}
        sessionSummaryId={session.id}
        onReload={loadSessionSummary}
        onClose={() => setVacationEditOpen(false)}
        toast={toast}
        openConfirm={openConfirm}
      />

      <PerWeekEditModal
        open={perWeekEditOpen}
        classesData={classesData}
        onClose={() => setPerWeekEditOpen(false)}
        onSaved={() => setPwRefresh(n => n + 1)}
        toast={toast}
      />
{/* subject get thorup gradeID, SectionId */}
      <TermBreakupModal
  cls={tbModalClass?.name}
  gradeId={tbModalClass?.gradeId}
  sectionId={tbModalClass?.sectionId}
  onSaved={() => setTbRefreshKey(k => k + 1)}
  onClose={() => setTbModalClass(null)}
  toast={toast}
/>

      <UnitMgrModal
        open={unitMgrSource !== null}
        source={unitMgrSource}
        units={unitMgrSource === 'lesson' ? units : nbUnits}
        clpCtx={clpCtx}
        onSave={next => {
          if (unitMgrSource === 'lesson') setUnits(next); else setNbUnits(next);
          setUnitMgrSource(null);
          bumpClpRefresh();
          toast('Units saved', 'success');
        }}
        onClose={() => { setUnitMgrSource(null); bumpClpRefresh(); }}
        openConfirm={openConfirm}
        toast={toast}
      />

      <LessonEditModal
        ctx={lessonEdit}
        onSave={updated => {
          setUnits(prev => prev.map(u =>
            u.id !== lessonEdit.unitId ? u : {
              ...u,
              lessons: u.lessons.map(l => l.id === lessonEdit.lessonId ? updated : l),
            },
          ));
          setLessonEdit(null);
          bumpClpRefresh();
          toast('Lesson plan saved', 'success');
        }}
        onClose={() => { setLessonEdit(null); bumpClpRefresh(); }}
        toast={toast}
      />

      <NbAQModal
        ctx={nbAddCtx}
        unit={nbAddCtx ? nbUnits.find(u => u.id === nbAddCtx.unitId) : null}
        onSave={(unitId, payload) => {
          setNbUnits(prev => prev.map(u =>
            u.id !== unitId ? u : { ...u, questions: [...u.questions, { ...payload, id: Date.now() }] },
          ));
          setNbAddCtx(null);
          toast('Questions saved', 'success');
        }}
        onClose={() => setNbAddCtx(null)}
        toast={toast}
      />

      <NbAQModal
        ctx={nbEdit}
        unit={nbEdit ? nbUnits.find(u => u.id === nbEdit.unitId) : null}
        onSave={(unitId, qId, updated) => {
          setNbUnits(prev => prev.map(u =>
            u.id !== unitId ? u : { ...u, questions: u.questions.map(q => q.id === qId ? { ...q, ...updated } : q) },
          ));
          setNbEdit(null);
          toast('Questions updated', 'success');
        }}
        onClose={() => setNbEdit(null)}
        toast={toast}
      />

      <LpReportPicker
        cfg={reportPicker}
        onClose={() => setReportPicker(null)}
        onGenerate={(style, fmt) => {
          generateLessonPlanReport(reportPicker.name, style, fmt, { units, nbUnits, session, vacations, pwSelectedClass, clpClass, clpSubject });
          setReportPicker(null);
        }}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SESSION SETTINGS — 4 cards (EXACT copy of HTML's .ss-card markup)
   ═══════════════════════════════════════════════════════════════════ */
function SessionSettings({
  session,
  vacations,
  setSelectedClass,
  onEditSession,
  onEditVacations,
  onEditPerWeek,
  onReport,
  classesData = [], // Add classesData as a prop
  pwRefresh = 0
}) {
  /* If the user switched to a different session (changeSessionId differs from the
     login session), the view is read-only — disable all edit buttons. */
  const changeSessionId = sessionStorage.getItem('changeSessionId');
  const sessionName  = sessionStorage.getItem('sessionName ');
  const loginSessionId  = sessionStorage.getItem('sessionID') || sessionStorage.getItem('SessionID') || '';
  const isOtherSession  = !!changeSessionId && !!loginSessionId && String(changeSessionId) !== String(loginSessionId);

  /* Per-week card: class+section options + live subjects/counts (read-only view). */
  const pwOptions = useMemo(() => {
    const out = [];
    (classesData || []).forEach(cls => {
      if (cls.sections && cls.sections.length > 0) {
        cls.sections.forEach(sec => out.push({
          id: `${cls.id}_${sec.sectionID}`, gradeId: cls.id, sectionId: sec.sectionID,
          label: `${cls.name}${sec.sectionName ? ` (${sec.sectionName})` : ''}`,
        }));
      } else {
        out.push({ id: `${cls.id}_nosection`, gradeId: cls.id, sectionId: null, label: cls.name });
      }
    });
    return out;
  }, [classesData]);

  const [pwSelId, setPwSelId] = useState('');
  const [pwView, setPwView]   = useState({ subjects: [], counts: {}, loading: false });
  const pwSelLabel = (pwOptions.find(o => o.id === pwSelId) || {}).label || '';

  useEffect(() => {
    if (!pwSelId) { setPwView({ subjects: [], counts: {}, loading: false }); return; }
    const opt = pwOptions.find(o => o.id === pwSelId);
    if (!opt || opt.sectionId == null) { setPwView({ subjects: [], counts: {}, loading: false }); return; }
    let cancelled = false;
    setPwView(v => ({ ...v, loading: true }));
    fetchPerWeekCounts(opt.gradeId, opt.sectionId)
      .then(({ subjects, counts }) => { if (!cancelled) setPwView({ subjects, counts, loading: false }); })
      .catch(() => { if (!cancelled) setPwView({ subjects: [], counts: {}, loading: false }); });
    return () => { cancelled = true; };
  }, [pwSelId, pwOptions, pwRefresh]);

  return (
    <div className="ss-cards-grid">

      {/* ① ACADEMIC SESSION ─────────────────────── */}
      <div className="ss-card ss-card--session">
        <div className="ss-card-orb ss-card-orb--1"></div>
        <div className="ss-card-orb ss-card-orb--2"></div>

        {/* Card header */}
        <div className="ss-card-hdr">
          <div className="ss-card-badge">
            <i className="fa-solid fa-calendar-days"></i>
          </div>
          <div>
            <div className="ss-card-hdr-title">Academic Session</div>
            <div className="ss-card-hdr-sub">{session.year}</div>
          </div>
          <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : 'Edit academic session'}>
            <button className="ss-card-edit-btn" onClick={onEditSession} aria-label="Edit academic session"
              disabled={isOtherSession}
              style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
              <i className="fa-solid fa-pen"></i>
            </button>
          </Tooltip>
        </div>

        {/* Data rows */}
        <div className="ss-data-rows">
          <div className="ss-data-row">
            <div className="ss-data-icon"><i className="fa-solid fa-play"></i></div>
            <div className="ss-data-label">Session Start</div>
            <div className="ss-data-val">{session.start}</div>
          </div>
          <div className="ss-data-row">
            <div className="ss-data-icon"><i className="fa-solid fa-stop"></i></div>
            <div className="ss-data-label">Session End</div>
            <div className="ss-data-val">{session.end}</div>
          </div>
          <div className="ss-data-row">
            <div className="ss-data-icon"><i className="fa-solid fa-briefcase"></i></div>
            <div className="ss-data-label">Working Days / Week</div>
            <div className="ss-data-val">{session.workingDaysPerWeek}</div>
          </div>
        </div>

        {/* Highlight banner */}
        <div className="ss-highlight-banner">
          <i className="fa-solid fa-circle-check" style={{ color: '#22C55E', fontSize: 15, flexShrink: 0 }}></i>
          <span>You have <strong>{session.totalOnDays}</strong> on days in the whole Academic Session</span>
        </div>

        {/* Report bar */}
        <div className="ss-card-report-bar">
          <span className="ss-card-report-label"><i className="fa-solid fa-download"></i> Report</span>
          <div className="ss-card-report-btns">
            <Tooltip text="Download Academic Session report (color PDF)">
              <button className="ss-card-rpt-btn ss-card-rpt-btn--color" onClick={() => onReport('Academic Session', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> Color PDF
              </button>
            </Tooltip>
            <Tooltip text="Download Academic Session report (Colorless PDF)">
              <button className="ss-card-rpt-btn ss-card-rpt-btn--bw" onClick={() => onReport('Academic Session', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> B&amp;W
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ② VACATIONS */}
      <div className="ss-card ss-card--vacations">
        <div className="ss-card-orb ss-card-orb--3"></div>

        <div className="ss-card-hdr">
          <div className="ss-card-badge" style={{ background: 'rgba(255,255,255,.18)' }}>
            <i className="fa-solid fa-umbrella-beach"></i>
          </div>
          <div>
            <div className="ss-card-hdr-title">Vacations</div>
            <div className="ss-card-hdr-sub">{vacations.length} scheduled breaks</div>
          </div>
          <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : 'Edit vacations'}>
            <button className="ss-card-edit-btn" onClick={onEditVacations} aria-label="Edit vacations"
              disabled={isOtherSession}
              style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
              <i className="fa-solid fa-pen"></i>
            </button>
          </Tooltip>
        </div>

        <div className="ss-vac-list">
          {vacations.map((v, i) => {
            const days = vacationDays(v.start, v.end);
            const last = i === vacations.length - 1;
            return (
              <div key={v.id} className="ss-vac-row" style={last ? { borderBottom: 'none', paddingBottom: 0 } : null}>
                <div className="ss-vac-left">
                  <div className="ss-vac-dot" style={{ background: v.color }}></div>
                  <div>
                    <div className="ss-vac-name">{v.name}</div>
                    <div className="ss-vac-range">
                      <i className="fa-solid fa-calendar-range"></i> {v.start} → {v.end}
                    </div>
                  </div>
                </div>
                <div className="ss-vac-days">{days}<span>days</span></div>
              </div>
            );
          })}
        </div>

        {/* Report bar */}
        <div className="ss-card-report-bar">
          <span className="ss-card-report-label"><i className="fa-solid fa-download"></i> Report</span>
          <div className="ss-card-report-btns">
            <Tooltip text="Download Vacations report (color PDF)">
              <button className="ss-card-rpt-btn ss-card-rpt-btn--color" onClick={() => onReport('Vacations', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> Color PDF
              </button>
            </Tooltip>
            <Tooltip text="Download Vacations report (Colorless PDF)">
              <button className="ss-card-rpt-btn ss-card-rpt-btn--bw" onClick={() => onReport('Vacations', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> B&amp;W
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ③ SESSION SUMMARY ───────────────────────── */}
      <div className="ss-card ss-card--summary">
        <div className="ss-card-orb ss-card-orb--4"></div>

        <div className="ss-card-hdr">
          <div className="ss-card-badge" style={{ background: 'rgba(255,255,255,.18)' }}>
            <i className="fa-solid fa-chart-pie"></i>
          </div>
          <div>
            <div className="ss-card-hdr-title">Session Summary</div>
            <div className="ss-card-hdr-sub">Academic year {session.year}</div>
          </div>
        </div>

        {/* Big numbers row */}
        <div className="ss-summ-hero">
          <div className="ss-summ-hero-item">
            <div className="ss-summ-big">{session.workingDays}</div>
            <div className="ss-summ-lbl">Working Days</div>
          </div>
          <div className="ss-summ-divider"></div>
          <div className="ss-summ-hero-item">
            <div className="ss-summ-big">{(session.workingWeeks ?? 0).toFixed(2)}</div>
            <div className="ss-summ-lbl">Working Weeks</div>
          </div>
        </div>

        {/* Mini stat pills */}
        <div className="ss-summ-pills">
          <div className="ss-summ-pill ss-summ-pill--blue">
            <div className="ss-summ-pill-val">{session.totalOnDays}</div>
            <div className="ss-summ-pill-lbl"><i className="fa-solid fa-calendar"></i> Total Days</div>
          </div>
          <div className="ss-summ-pill ss-summ-pill--green">
            <div className="ss-summ-pill-val">{session.workingDays}</div>
            <div className="ss-summ-pill-lbl"><i className="fa-solid fa-briefcase"></i> Working</div>
          </div>
          <div className="ss-summ-pill ss-summ-pill--amber">
            <div className="ss-summ-pill-val">{session.holidays}</div>
            <div className="ss-summ-pill-lbl"><i className="fa-solid fa-umbrella-beach"></i> Holidays</div>
          </div>
        </div>

        {/* Report bar */}
        <div className="ss-card-report-bar">
          <span className="ss-card-report-label"><i className="fa-solid fa-download"></i> Report</span>
          <div className="ss-card-report-btns">
            <Tooltip text="Download Session Summary (color PDF)">
              <button className="ss-card-rpt-btn ss-card-rpt-btn--color" onClick={() => onReport('Session Summary', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> Color PDF
              </button>
            </Tooltip>
            <Tooltip text="Download Session Summary (Colorless PDF)">
              <button className="ss-card-rpt-btn ss-card-rpt-btn--bw" onClick={() => onReport('Session Summary', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> B&amp;W
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* ④ PER WEEK LESSON PLANS — Dynamic classes */}
      <div className="ss-card ss-card--lessons">
        <div className="ss-card-orb ss-card-orb--5"></div>

        {/* Header */}
        <div className="ss-card-hdr">
          <div className="ss-card-badge" style={{ background: 'rgba(255,255,255,.2)', boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
            <i className="fa-solid fa-book-open"></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ss-card-hdr-title">Per week lesson plans</div>
            <div className="ss-card-hdr-sub">
              {pwSelId
                ? `${pwSelLabel} · ${pwView.subjects.length} subjects`
                : `${pwOptions.length} classes · tap one to view subjects`}
            </div>
          </div>
          {pwSelId && (
            <div style={{ background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.35)', color: '#fff', padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {pwSelLabel}
            </div>
          )}
          <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : 'Edit per week lesson plans'}>
            <button className="ss-card-edit-btn" onClick={onEditPerWeek} aria-label="Edit per week lesson plans"
              disabled={isOtherSession}
              style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
              <i className="fa-solid fa-pen"></i>
            </button>
          </Tooltip>
        </div>

        {/* Class chips - class (section) from API */}
        <div className="lp-class-chips">
          <div className="lp-chips-label">Choose a class</div>
          <div className="lp-chips-row">
            {pwOptions.length > 0 ? (
              pwOptions.map(o => (
                <button
                  key={o.id}
                  className={`lp-chip${pwSelId === o.id ? ' active' : ''}`}
                  onClick={() => { setPwSelId(o.id); setSelectedClass(o.label); }}
                >
                  {o.label}
                </button>
              ))
            ) : (
              <div className="lp-pw-empty-text" style={{ color: 'rgba(255,255,255,.6)', padding: '20px' }}>
                Loading classes...
              </div>
            )}
          </div>
        </div>

        {/* Subject output */}
        {pwView.loading ? (
          <div className="lp-pw-empty-text" style={{ color: 'rgba(255,255,255,.7)', padding: '20px', textAlign: 'center' }}>
            Loading subjects…
          </div>
        ) : pwSelId && pwView.subjects.length > 0 ? (
          <div className="lp-pw-grid" style={{ gridTemplateColumns: `repeat(${Math.min(pwView.subjects.length, 3)}, 1fr)` }}>
            {pwView.subjects.map(s => (
              <div key={s.subjectID} className="lp-pw-cell">
                <div className="lp-pw-cell-name">{s.subjectName}</div>
                <div className="lp-pw-cell-num">{pwView.counts[s.subjectID] || 0}</div>
                <div className="lp-pw-cell-lbl">per week</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="lp-pw-empty">
            <div className="lp-pw-empty-icon"><i className="fa-solid fa-chalkboard-user"></i></div>
            <div className="lp-pw-empty-text">Tap a class above to see how many lessons are scheduled per subject each week</div>
            <div className="lp-pw-empty-arrow"><i className="fa-solid fa-arrow-up" style={{ fontSize: 12 }}></i> Pick a class</div>
          </div>
        )}

        {/* Report buttons — always visible at bottom */}
        <div className="lp-report-bar">
          <span className="lp-report-bar-label"><i className="fa-solid fa-download"></i> Download Report</span>
          <div className="lp-report-btns">
            <Tooltip text="Download a combined per-week lesson plans PDF">
              <button className="lp-rpt-btn" onClick={() => onReport('Per Week Lesson Plans — Combined', 'pdf')}>
                <i className="fa-solid fa-layer-group"></i> Combined
              </button>
            </Tooltip>
            <div className="lp-rpt-sep"></div>
            <Tooltip text="Download lesson plans (color PDF)">
              <button className="lp-rpt-btn lp-rpt-btn--pdf" onClick={() => onReport('Per Week Lesson Plans', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> PDF Color
              </button>
            </Tooltip>
            <Tooltip text="Download lesson plans (Colorless PDF)">
              <button className="lp-rpt-btn lp-rpt-btn--bw" onClick={() => onReport('Per Week Lesson Plans', 'pdf')}>
                <i className="fa-solid fa-file-pdf"></i> PDF B&amp;W
              </button>
            </Tooltip>
            <div className="lp-rpt-sep"></div>
            <Tooltip text="Download lesson plans for all classes (color PDF)">
              <button className="lp-rpt-btn lp-rpt-btn--pdf" onClick={() => onReport('Per Week Lesson Plans — All', 'pdf')}>
                <i className="fa-solid fa-files"></i> All Color
              </button>
            </Tooltip>
            <Tooltip text="Download lesson plans for all classes (Colorless PDF)">
              <button className="lp-rpt-btn lp-rpt-btn--bw" onClick={() => onReport('Per Week Lesson Plans — All', 'pdf')}>
                <i className="fa-solid fa-files"></i> All B&amp;W
              </button>
            </Tooltip>
          </div>
        </div>

      </div>

    </div>
  );
}function vacationDays(start, end) {
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

/* Derive session totals from start/end, working-days-per-week and vacations.
   A 7-day week is split into `workingDaysPerWeek` on-days and (7 - that) weekly
   holidays. Vacation days are then subtracted from working days and added to
   holidays. Returns the fields the cards & summary read. */
function computeSession(base, vacations = []) {
  const wpw = Number(base.workingDaysPerWeek) || 0;
  const s = new Date(base.start), e = new Date(base.end);
  let totalDays = 0, calWeeks = 0, grossWorkingDays = 0, weeklyHolidays = 0;
  if (!isNaN(s) && !isNaN(e) && e >= s) {
    totalDays = Math.round((e - s) / 86400000) + 1;
    calWeeks = totalDays / 7;
    grossWorkingDays = Math.round(calWeeks * wpw);
    weeklyHolidays = totalDays - grossWorkingDays;
  }
  const vacDays = (vacations || []).reduce((sum, v) => sum + vacationDays(v.start, v.end), 0);
  const workingDays = Math.max(0, grossWorkingDays - vacDays);
  const workingWeeks = wpw > 0 ? workingDays / wpw : 0;
  return {
    ...base,
    workingDaysPerWeek: wpw,
    totalOnDays: totalDays,
    workingDays,
    workingWeeks,
    holidays: weeklyHolidays + vacDays,
    vacationDays: vacDays,
  };
}

/* ─── LessonPlans session backend helpers ───
   POST /api/lpsessionsummarycrud         → academic session (insert/update)
   POST /api/lpsessionsummarydetailscrud  → vacations (insert/update/delete)
   Auth = bearer token from sessionStorage. */
const lpAuthHeaders = (extra = {}) => ({
  Accept: '*/*',
  Authorization: `bearer ${sessionStorage.getItem('token') || ''}`,
  ...extra,
});
async function lpPost(path, payload) {
  const res = await fetch(buildUrl(path), {
    method: 'POST',
    headers: lpAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`${path} ${payload.action} failed: ${res.status}`);
  return res.json().catch(() => ({}));
}
const lpToIso = d => { const x = new Date(d); return isNaN(x) ? null : x.toISOString(); };

/* Active session: switched session first, else the login session. */
const lpActiveSessionId = () =>
  sessionStorage.getItem('changeSessionId')
  || sessionStorage.getItem('sessionID')
  || sessionStorage.getItem('SessionID')
  || '';

/* Load a class/section's subjects (LaunchSetup) + their saved per-week counts
   (lpcountforsubjectscrud get is per-subject). Returns { subjects, counts, ids }. */
async function fetchPerWeekCounts(gradeId, sectionId) {
  const subRes = await fetch(buildUrl(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`), { method: 'GET', headers: { Accept: '*/*' } });
  const subJson = await subRes.json();
  const subjects = (subJson.success && Array.isArray(subJson.data)) ? subJson.data : [];
  const branchID  = sessionStorage.getItem('branchID') || '';
  const sessionID = lpActiveSessionId();
  const found = await Promise.all(subjects.map(s =>
    lpPost('/api/lpcountforsubjectscrud', {
      id: 0, branchID,
      classID: String(gradeId), sectionID: String(sectionId),
      subjectID: String(s.subjectID), sessionID, totalLectures: '0', action: 'get',
    })
      .then(rows => ({ subjectID: s.subjectID, row: Array.isArray(rows) ? rows[0] : null }))
      .catch(() => ({ subjectID: s.subjectID, row: null }))
  ));
  const counts = {}, ids = {};
  found.forEach(f => {
    counts[f.subjectID] = f.row ? (f.row.totalLectures ?? '') : '';
    ids[f.subjectID]    = f.row ? (f.row.id || 0) : 0;
  });
  return { subjects, counts, ids };
}

/* ═══════════════════════════════════════════════════════════════════
   SESSION EDIT MODAL — Term Setup + Per Week tabs
   ═══════════════════════════════════════════════════════════════════ */
function SessionEditModal({ open, session, vacations, onSession, onVacations, onClose, toast }) {
  const [sub, setSub] = useState('term'); // 'term' | 'perweek'
  const [start, setStart] = useState(session.start);
  const [end,   setEnd]   = useState(session.end);
  const [wpw,   setWpw]   = useState(session.workingDaysPerWeek);

  useEffect(() => {
    if (open) {
      setStart(session.start);
      setEnd(session.end);
      setWpw(session.workingDaysPerWeek);
      setSub('term');
    }
  }, [open, session]);

  /* Live recalculation as the user edits start/end/working-days-per-week.
     Subtracts the current vacations so the preview matches the summary card. */
  const preview = useMemo(
    () => computeSession({ start, end, workingDaysPerWeek: wpw }, vacations),
    [start, end, wpw, vacations],
  );

  const save = () => {
    /* Parent persists via lpsessionsummarycrud and reloads. */
    onSession({ start, end, workingDaysPerWeek: wpw });
    onClose();
  };

  const sessionName = sessionStorage.getItem('sessionName') || '';
  return (
    <div className={`lp-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lp-modal" style={{ maxWidth: 600 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon"><i className="fa-solid fa-gear"></i></div>
            <div>
              <div className="lp-modal-title">Edit Academic Session</div>
              <div className="lp-modal-sub">Configure term setup &amp; per-week lesson plans</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="lp-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="lp-modal-tabrow">
          <button className={`lp-modal-tab${sub === 'term' ? ' active' : ''}`} onClick={() => setSub('term')}>
            <i className="fa-solid fa-calendar-day"></i> Term Setup
          </button>
          <button className={`lp-modal-tab${sub === 'perweek' ? ' active' : ''}`} onClick={() => setSub('perweek')}>
            <i className="fa-solid fa-book-open"></i> Per Week Lesson Plans
          </button>
        </div>

        <div className="lp-modal-body">
          {sub === 'term' ? (
            <>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Session Start</label>
                  <input className="form-input" type="date" value={start} onChange={e => setStart(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Session End</label>
                  <input className="form-input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Working Days / Week</label>
                  <input className="form-input" type="number" min={1} max={7} value={wpw} onChange={e => setWpw(+e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Year</label>
                  <input className="form-input" value={sessionName} readOnly style={{ opacity: .6 }} />
                </div>
              </div>
              {/* Live calculation preview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 6 }}>
                {[
                  { lbl: 'Total Days',    val: preview.totalOnDays },
                  { lbl: 'Working Days',  val: preview.workingDays },
                  { lbl: 'Working Weeks', val: (preview.workingWeeks || 0).toFixed(2) },
                  { lbl: 'Holidays',      val: preview.holidays },
                ].map(c => (
                  <div key={c.lbl} style={{ background: 'var(--bg-muted, #F1F5F9)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-primary, #1E40AF)' }}>{c.val}</div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{c.lbl}</div>
                  </div>
                ))}
              </div>
              <div className="lp-summary-strip" style={{ marginTop: 14 }}>
                <i className="fa-solid fa-circle-info"></i>
                <span>A week = <strong>{wpw}</strong> working days + <strong>{Math.max(0, 7 - (Number(wpw) || 0))}</strong> weekly holidays. Vacations ({preview.vacationDays} days) are subtracted from working days automatically.</span>
              </div>
            </>
          ) : (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Default lessons per week (all subjects)</label>
              <input className="form-input" type="number" min={1} max={10} defaultValue={5} />
              <div className="lp-summary-strip" style={{ marginTop: 14 }}>
                <i className="fa-solid fa-circle-info"></i>
                <span>Override per-subject schedules from the <strong>Per Week Lesson Plans</strong> card on the dashboard.</span>
              </div>
            </div>
          )}
        </div>

        <div className="lp-modal-footer">
          <Tooltip text="Discard changes and close">
            <button className="lp-btn ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Save session settings">
            <button className="lp-btn primary" onClick={save}>
              <i className="fa-solid fa-check"></i> Save
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PER WEEK EDIT MODAL — pick a class (section) and set the weekly
   lesson-plan count per subject. Subjects load from
   /api/LaunchSetup/get-subjects/{classId}/{sectionId}.
   ═══════════════════════════════════════════════════════════════════ */
function PerWeekEditModal({ open, classesData = [], onClose, onSaved, toast }) {
  const [selectedId, setSelectedId] = useState('');
  const [subjects, setSubjects]     = useState([]);
  const [counts, setCounts]         = useState({}); // subjectID -> totalLectures
  const [recordIds, setRecordIds]   = useState({}); // subjectID -> existing record id (0 = none → insert)
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);

  /* Flatten classes → one option per class/section, labelled "Class (Section)". */
  const options = useMemo(() => {
    const out = [];
    classesData.forEach(cls => {
      if (cls.sections && cls.sections.length > 0) {
        cls.sections.forEach(sec => out.push({
          id: `${cls.id}_${sec.sectionID}`,
          gradeId: cls.id,
          sectionId: sec.sectionID,
          label: `${cls.name}${sec.sectionName ? ` (${sec.sectionName})` : ''}`,
        }));
      } else {
        out.push({ id: `${cls.id}_nosection`, gradeId: cls.id, sectionId: null, label: cls.name });
      }
    });
    return out;
  }, [classesData]);

  /* Default-select the first class when the modal opens. */
  useEffect(() => {
    if (!open) return;
    setSelectedId(options.length ? options[0].id : '');
  }, [open, options]);

  /* Fetch subjects for the selected class/section. */
  useEffect(() => {
    if (!open || !selectedId) { setSubjects([]); return; }
    const opt = options.find(o => o.id === selectedId);
    if (!opt || opt.sectionId == null) { setSubjects([]); setCounts({}); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { subjects: list, counts: nextCounts, ids: nextIds } = await fetchPerWeekCounts(opt.gradeId, opt.sectionId);
        if (cancelled) return;
        setSubjects(list);
        setCounts(nextCounts);
        setRecordIds(nextIds);
      } catch (e) {
        console.error('Error fetching subjects:', e);
        if (!cancelled) { setSubjects([]); setCounts({}); setRecordIds({}); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, selectedId, options]);

  const setCount = (id, val) => setCounts(prev => ({ ...prev, [id]: val }));

  /* Save each subject's weekly count via lpcountforsubjectscrud — existing
     record (has id) updates, otherwise inserts. */
  const save = async () => {
    const opt = options.find(o => o.id === selectedId);
    if (!opt) return;
    setSaving(true);
    try {
      const branchID  = sessionStorage.getItem('branchID') || '';
      const sessionID = lpActiveSessionId();
      await Promise.all(subjects.map(s => {
        const recId = recordIds[s.subjectID] || 0;
        return lpPost('/api/lpcountforsubjectscrud', {
          id: recId,
          branchID,
          classID: String(opt.gradeId),
          sectionID: String(opt.sectionId),
          subjectID: String(s.subjectID),
          sessionID,
          totalLectures: String(counts[s.subjectID] || 0),
          action: recId ? 'update' : 'insert',
        });
      }));
      toast(`Per week lesson plans saved${opt ? ` for ${opt.label}` : ''}`, 'success');
      onSaved && onSaved();
      onClose();
    } catch (e) {
      console.error('Error saving per week counts:', e);
      toast('Could not save per week lesson plans', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`lp-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lp-modal" style={{ maxWidth: 720 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon"><i className="fa-solid fa-book-open"></i></div>
            <div>
              <div className="lp-modal-title">Per Week No. of Lesson Plans</div>
              <div className="lp-modal-sub">Pick a class and set the weekly count per subject</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="lp-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="lp-modal-body">
          <div className="form-group">
            <label className="form-label">Select class</label>
            <select className="form-input" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
              {options.length === 0 && <option value="">No classes available</option>}
              {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>

          <div style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--brand-primary, #1E40AF)', margin: '6px 0 16px' }}>
            Per Week No. of lesson plans
          </div>

          {loading ? (
            <div className="lp-pw-empty-text" style={{ textAlign: 'center', padding: 24 }}>Loading subjects…</div>
          ) : subjects.length === 0 ? (
            <div className="lp-pw-empty-text" style={{ textAlign: 'center', padding: 24 }}>No subjects found for this class.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
              {subjects.map(s => (
                <div key={s.subjectID} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{s.subjectName}</label>
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={counts[s.subjectID] ?? ''}
                    onChange={e => setCount(s.subjectID, e.target.value)}
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lp-modal-footer">
          <Tooltip text="Discard and close">
            <button className="lp-btn ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Save per week lesson plans">
            <button className="lp-btn primary" onClick={save} disabled={loading || saving || subjects.length === 0}>
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> {saving ? 'Saving…' : 'Save'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VACATION EDIT MODAL
   ═══════════════════════════════════════════════════════════════════ */
function VacationEditModal({ open, vacations, session = {}, sessionSummaryId, onReload, onClose, toast, openConfirm }) {
  const [draft, setDraft] = useState([]);
  /* ids of vacations that already exist on the server (for insert/update/delete diff). */
  const [origIds, setOrigIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(vacations.map(v => ({ ...v })));
    setOrigIds(new Set(vacations.map(v => v.id)));
  }, [open, vacations]);

  const update = (id, key, val) =>
    setDraft(d => d.map(v => v.id === id ? { ...v, [key]: val } : v));

  const remove = id => {
    const v = draft.find(x => x.id === id);
    openConfirm({
      title: 'Delete Vacation?',
      message: `"<strong>${v?.name || 'this vacation'}</strong>" will be removed from the session.`,
      hint: 'Total on-days will be recalculated.',
      confirmLabel: 'Yes, Delete',
      icon: 'fa-trash',
      onConfirm: () => setDraft(d => d.filter(x => x.id !== id)),
    });
  };

  const add = () => {
    const palette = ['#1E40AF', '#22C55E', '#F59E0B', '#7C3AED', '#EF4444', '#0EA5E9'];
    setDraft([...draft, { id: Date.now(), name: '', start: '', end: '', color: palette[draft.length % palette.length] }]);
  };

  /* Persist via lpsessionsummarydetailscrud: new rows insert, existing rows
     update, removed rows delete. remainingDays/Weeks come from the recomputed
     session totals. */
  const save = async () => {
    if (!sessionSummaryId) { toast('Save the academic session first', 'error'); return; }
    setSaving(true);
    try {
      const computed = computeSession(session, draft);
      const remainingDays  = String(computed.workingDays);
      const remainingWeeks = String(Math.round(computed.workingWeeks || 0));
      const ops = [];
      const present = new Set();
      draft.forEach(v => {
        present.add(v.id);
        if (!v.name || !v.name.trim()) return; // skip empty rows
        const exists = origIds.has(v.id);
        ops.push(lpPost('/api/lpsessionsummarydetailscrud', {
          id: exists ? v.id : 0,
          sessionSummaryID: sessionSummaryId,
          vacationName: v.name.trim(),
          vacationStart: lpToIso(v.start),
          vacationEnd: lpToIso(v.end),
          remainingDays,
          remainingWeeks,
          action: exists ? 'update' : 'insert',
        }));
      });
      origIds.forEach(id => {
        if (!present.has(id)) {
          ops.push(lpPost('/api/lpsessionsummarydetailscrud', {
            id, sessionSummaryID: sessionSummaryId,
            vacationName: '', vacationStart: null, vacationEnd: null,
            remainingDays, remainingWeeks, action: 'delete',
          }));
        }
      });
      await Promise.all(ops);
      toast('Vacations updated', 'success');
      onReload && onReload();
      onClose();
    } catch (e) {
      console.error('Error saving vacations:', e);
      toast('Could not save vacations', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`lp-overlay${open ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lp-modal" style={{ maxWidth: 640 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon"><i className="fa-solid fa-umbrella-beach"></i></div>
            <div>
              <div className="lp-modal-title">Edit Vacations</div>
              <div className="lp-modal-sub">Add or remove scheduled breaks</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="lp-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="lp-modal-body">
          {draft.map(v => (
            <div key={v.id} className="lp-vac-row-edit">
              <div className="lp-vac-color-pill" style={{ background: v.color }}></div>
              <input
                className="form-input"
                placeholder="Vacation name"
                value={v.name}
                onChange={e => update(v.id, 'name', e.target.value)}
              />
              <input
                className="form-input"
                type="date"
                value={v.start}
                onChange={e => update(v.id, 'start', e.target.value)}
              />
              <input
                className="form-input"
                type="date"
                value={v.end}
                onChange={e => update(v.id, 'end', e.target.value)}
              />
              <Tooltip text="Delete vacation">
                <button className="lp-icon-del" onClick={() => remove(v.id)}>
                  <i className="fa-solid fa-trash"></i>
                </button>
              </Tooltip>
            </div>
          ))}
          <Tooltip text="Add another vacation entry">
            <button className="lp-add-row" onClick={add}>
              <i className="fa-solid fa-plus"></i> Add vacation
            </button>
          </Tooltip>
        </div>
        <div className="lp-modal-footer">
          <Tooltip text="Discard changes and close">
            <button className="lp-btn ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Save vacations">
            <button className="lp-btn primary" onClick={save} disabled={saving}>
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> {saving ? 'Saving…' : 'Save'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TERM BREAKUPS — class table with expand details
   ═══════════════════════════════════════════════════════════════════ */
function TermBreakups({ onUpdate, onReport, openConfirm, toast, classesData,  refreshKey }) {
  const [openId, setOpenId] = useState(null);
  const [subjectsData, setSubjectsData] = useState({});
  const [loadingSubjects, setLoadingSubjects] = useState({});
  const [terms, setTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState({});      // { [uniqueId]: termId }
  const [selectedSubject, setSelectedSubject] = useState({}); // { [uniqueId]: subjectID }
  const [termBreakupData, setTermBreakupData] = useState({}); // { [uniqueId]: { loading, units, noData } }

  useEffect(() => {
    const loadTerms = async () => {
      try {
        const json = await termsCrud({
          id: 0,
          branchID: termsBranchID(),
          term: 'string',
          sessionYearID: termsSessionYearID(),
          action: 'get',
        });
        const list = Array.isArray(json) ? json : (json?.data || []);
        setTerms(list.map(t => ({ id: t.id, name: t.term || 'Term' })));
      } catch (e) {
        console.error('Error loading terms:', e);
        setTerms([]);
      }
    };
    loadTerms();
  }, []);
  
  console.log("classesData in TermBreakups:", classesData);

  // Function to fetch subjects for a specific class and section
  const fetchSubjectsForClassSection = async (gradeId, sectionId, uniqueId) => {
    // Set loading state for this specific item
    setLoadingSubjects(prev => ({ ...prev, [uniqueId]: true }));
    
    try {
      const empID = sessionStorage.getItem("employee_ID");
      
      // Fetch subjects for this specific class and section
      const res = await fetch(
        buildUrl(`/get-subjects_byEmployeeID/${gradeId}/${sectionId}/${empID}`),
        {
          method: "GET",
          headers: {
            Accept: "*/*",
          },
        }
      );
      
      const json = await res.json();
      console.log(`Subjects for grade ${gradeId}, section ${sectionId}:`, json);
      
      if (json.success && Array.isArray(json.data)) {
        // Store the subjects data (could be empty array)
        setSubjectsData(prev => ({
          ...prev,
          [uniqueId]: json.data
        }));
        // Auto-select first subject for this row (always default to first on a fresh expand)
        if (json.data.length) {
          setSelectedSubject(prev => ({
            ...prev,
            [uniqueId]: json.data[0].subjectID,
          }));
        }
      } else {
        setSubjectsData(prev => ({
          ...prev,
          [uniqueId]: []
        }));
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
      setSubjectsData(prev => ({
        ...prev,
        [uniqueId]: []
      }));
    } finally {
      // Clear loading state
      setLoadingSubjects(prev => ({ ...prev, [uniqueId]: false }));
    }
  };

  // Handle expand/collapse
  
  // Create a flat list of all class-section combinations
  const flattenedData = [];
  classesData.forEach((classItem) => {
    if (classItem.sections && classItem.sections.length > 0) {
      classItem.sections.forEach((section) => {
        flattenedData.push({
          gradeId: classItem.id,
          gradeName: classItem.name,
          sectionId: section.sectionID,
          sectionName: section.sectionName,
        });
      });
    } else {
      // Handle classes with no sections
      flattenedData.push({
        gradeId: classItem.id,
        gradeName: classItem.name,
        sectionId: null,
        sectionName: null,
      });
    }
  });

  // ── Fetch term-breakup details for a row: gettermbreakups → lptermbreakupdetailscrud
// ── Fetch term-breakup details for a row: gettermbreakups → lptermbreakupdetailscrud
  // ── Fetch term-breakup details for a row: gettermbreakups → lptermbreakupdetailscrud
  const fetchTermBreakupDetails = async (uniqueId, item, termID, subjectID) => {
    setTermBreakupData(prev => ({
      ...prev,
      [uniqueId]: { ...(prev[uniqueId] || {}), loading: true, noData: false, units: [] },
    }));

    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      const branchID = termsBranchID();
      const sessionID = termsSessionYearID();

      // Step 1: gettermbreakups → find termBreakupID
      const params = new URLSearchParams({
        branchID: String(branchID ?? ''),
        classID: String(item.gradeId ?? ''),
        sectionID: String(item.sectionId ?? ''),
        subjectID: String(subjectID ?? ''),
        termID: String(termID ?? ''),
        sessionID: String(sessionID ?? ''),
        pageNo: '1',
      });

      const fullUrl = buildUrl(`/api/gettermbreakups?${params.toString()}`);

      // ── DIAGNOSTIC: yeh URL Swagger me paste karke test karo
      console.log('═══ gettermbreakups PARAMS ═══');
      console.log('branchID:', branchID);
      console.log('classID (gradeId):', item.gradeId);
      console.log('sectionID:', item.sectionId);
      console.log('subjectID:', subjectID);
      console.log('termID:', termID);
      console.log('sessionID:', sessionID);
      console.log('Full URL:', fullUrl);

      const res1 = await fetch(fullUrl, {
        method: 'GET',
        headers: { Accept: '*/*', Authorization: `Bearer ${token}` },
      });

      console.log('gettermbreakups status:', res1.status);

      // 401 / 404 / koi error → crash nahi, sirf "No data" dikhao
      if (!res1.ok) {
        console.warn('gettermbreakups NOT OK:', res1.status, '— is term/subject ke liye breakup exist nahi karta ya param galat hai');
        setTermBreakupData(prev => ({
          ...prev,
          [uniqueId]: { loading: false, noData: true, units: [] },
        }));
        console.log('═══════════════════════════════════');
        return;
      }

      const json1 = await res1.json().catch(() => ({}));
      console.log('gettermbreakups response:', json1);

      const list1 = Array.isArray(json1?.data) ? json1.data : [];

      if (!list1.length || !list1[0]?.id) {
        console.warn('gettermbreakups: data empty');
        setTermBreakupData(prev => ({
          ...prev,
          [uniqueId]: { loading: false, noData: true, units: [] },
        }));
        console.log('═══════════════════════════════════');
        return;
      }
      const termBreakupID = list1[0].id;
      console.log('termBreakupID:', termBreakupID);

      // Step 2: lptermbreakupdetailscrud → actual units/topics
      const res2 = await fetch(buildUrl('/api/lptermbreakupdetailscrud'), {
        method: 'POST',
        headers: { Accept: '*/*', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: termBreakupID,
          termBreakupID,
          unitNumber: '',
          unitName: '',
          weekRequired: '',
          subTopic: '',
          periodRequired: '',
          type: '',
          action: 'get',
        }),
      });
      const json2 = await res2.json().catch(() => ({}));
      console.log('json2 KEYS:', Object.keys(json2));
console.log('json2 FULL:', JSON.stringify(json2).slice(0, 500));

      console.log('lptermbreakupdetailscrud Raw response:', json2);

      const rows = Array.isArray(json2) ? json2
                  : Array.isArray(json2?.data) ? json2.data
                  : Array.isArray(json2?.Data) ? json2.Data
                  : [];

      console.log('Parsed rows:', rows, '| count:', rows.length);

      if (!rows.length) {
        setTermBreakupData(prev => ({
          ...prev,
          [uniqueId]: { loading: false, noData: true, units: [] },
        }));
        console.log('═══════════════════════════════════');
        return;
      }

      // Group rows by unitNumber+unitName+weekRequired
      const unitMap = {};
      const unitOrder = [];
      rows.forEach(r => {
        const unitNumber   = r.unitNumber ?? r.UnitNumber ?? '';
        const unitName     = r.unitName ?? r.UnitName ?? '';
        const weekRequired = r.weekRequired ?? r.WeekRequired ?? '';
        const subTopic       = r.subTopic ?? r.SubTopic ?? '';
        const periodRequired = r.periodRequired ?? r.PeriodRequired ?? '';

        const key = `${unitNumber}__${unitName}__${weekRequired}`;
        if (!unitMap[key]) {
          unitMap[key] = { unitNumber, unitName, weekRequired, topics: [] };
          unitOrder.push(key);
        }
        if (subTopic || periodRequired) {
          unitMap[key].topics.push({ subTopic, periodRequired });
        }
      });

      const units = unitOrder.map(k => unitMap[k]);
      console.log('Grouped units:', units);
      console.log('═══════════════════════════════════');

      setTermBreakupData(prev => ({
        ...prev,
        [uniqueId]: { loading: false, noData: units.length === 0, units },
      }));
    } catch (e) {
      console.error('Error fetching term breakup details:', e);
      setTermBreakupData(prev => ({
        ...prev,
        [uniqueId]: { loading: false, noData: true, units: [] },
      }));
    }
  };
  // Auto-fetch term-breakup details whenever the open row's term or subject selection changes
  // Auto-fetch term-breakup details whenever the open row's term or subject selection changes
  useEffect(() => {
    if (!openId) return;
    const item = flattenedData.find(f => `${f.gradeId}_${f.sectionId || 'nosection'}` === openId);
    if (!item) return;

    const termID = selectedTerm[openId];
    const subjectID = selectedSubject[openId];

    // No term selected yet → nothing to show
    if (termID === undefined) return;

    // Subjects list loaded but empty → there's nothing to fetch breakup for
    const subjList = subjectsData[openId];
    if (Array.isArray(subjList) && subjList.length === 0) {
      setTermBreakupData(prev => ({
        ...prev,
        [openId]: { loading: false, noData: true, units: [] },
      }));
      return;
    }

    // Still waiting on subject selection / subjects fetch
    if (subjectID === undefined) return;

    fetchTermBreakupDetails(openId, item, termID, subjectID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [openId, selectedTerm[openId], selectedSubject[openId], subjectsData[openId], refreshKey]);

  // Handle expand/collapse
  // Handle expand/collapse
  const handleExpand = async (uniqueId, gradeId, sectionId) => {
    if (openId === uniqueId) {
      // Collapse — reset selections so next expand starts fresh at the defaults
      setOpenId(null);
      setSelectedTerm(prev => {
        const next = { ...prev };
        delete next[uniqueId];
        return next;
      });
      setSelectedSubject(prev => {
        const next = { ...prev };
        delete next[uniqueId];
        return next;
      });
    } else {
      // Expand - fetch subjects if not already fetched
      setOpenId(uniqueId);

      // Auto-select first term for this row
      if (terms.length) {
        setSelectedTerm(prev => ({ ...prev, [uniqueId]: terms[0].id }));
      }

      // If subjects already cached, auto-select first subject immediately
      const cachedSubjects = subjectsData[uniqueId];
      if (cachedSubjects && cachedSubjects.length) {
        setSelectedSubject(prev => ({ ...prev, [uniqueId]: cachedSubjects[0].subjectID }));
      } else if (cachedSubjects && cachedSubjects.length === 0) {
        setSelectedSubject(prev => {
          const next = { ...prev };
          delete next[uniqueId];
          return next;
        });
      }

      // Only fetch if we haven't fetched subjects for this class-section yet
      if (!subjectsData[uniqueId]) {
        await fetchSubjectsForClassSection(gradeId, sectionId, uniqueId);
      }
    }
  };

  return (
    <div className="section-card" style={{ overflow: 'visible' }}>
      <div className="tb-breakup-head">
        <div className="tb-bp-th" style={{ width: 90 }}>S. No.</div>
        <div className="tb-bp-th" style={{ flex: 1 }}>Class</div>
        <div className="tb-bp-th" style={{ flex: 1 }}>Section</div>
        <div className="tb-bp-th" style={{ width: 200, textAlign: 'center' }}>Download Report</div>
        <div className="tb-bp-th" style={{ width: 120, textAlign: 'center' }}>Update</div>
        <div className="tb-bp-th" style={{ width: 60, textAlign: 'center' }}>Details</div>
      </div>

      {flattenedData.map((item, i) => {
        const uniqueId = `${item.gradeId}_${item.sectionId || 'nosection'}`;
        const isOpen = openId === uniqueId;
        const className = item.gradeName;
        const subjects = subjectsData[uniqueId] || [];
        const isLoading = loadingSubjects[uniqueId];
        
        return (
          <div key={uniqueId} className="tb-row-wrap">
            <div className="tb-row">
              <div className="tb-bp-td" style={{ width: 90 }}>
                <span className="tb-sno">{i + 1}</span>
              </div>
              <div className="tb-bp-td" style={{ flex: 1 }}>
                <div className="tb-cls-name">
                  <div className="tb-cls-icon"><i className="fa-solid fa-code"></i></div>
                  {className}
                </div>
              </div>
              <div className="tb-bp-td" style={{ flex: 1 }}>
                {item.sectionName ? (
                  <span className="section-pill" style={{ 
                    background: 'rgba(30,58,138,.1)', 
                    padding: '4px 12px', 
                    borderRadius: '20px', 
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'inline-block'
                  }}>
                    {item.sectionName}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No sections
                  </span>
                )}
              </div>
              <div className="tb-bp-td" style={{ width: 200, justifyContent: 'center', gap: 6 }}>
                <Tooltip text={`Download term breakup for ${className} - Section ${item.sectionName || ''} as PDF`}>
                  <button className="export-btn pdf" onClick={() => onReport(`${className} - Section ${item.sectionName || 'No Section'} — Term Breakup`, 'pdf')}>
                    <i className="fa-solid fa-file-pdf"></i> PDF
                  </button>
                </Tooltip>
                <Tooltip text={`Download term breakup for ${className} - Section ${item.sectionName || ''} as Word`}>
                  <button className="export-btn word" onClick={() => onReport(`${className} - Section ${item.sectionName || 'No Section'} — Term Breakup`, 'word')}>
                    <i className="fa-brands fa-microsoft"></i> Word
                  </button>
                </Tooltip>
              </div>
              <div className="tb-bp-td" style={{ width: 120, justifyContent: 'center' }}>
                <Tooltip text={`Update term breakup for ${className} - Section ${item.sectionName || ''}`}>
                  <button className="tb-update-btn" onClick={() => onUpdate({
  name: `${className} - Section ${item.sectionName || ''}`,
  gradeId: item.gradeId,
  sectionId: item.sectionId,
})}>
                    <i className="fa-solid fa-pen"></i> Update
                  </button>
                </Tooltip>
              </div>
              <div className="tb-bp-td" style={{ width: 60, justifyContent: 'center' }}>
                <Tooltip text={isOpen ? 'Hide details' : 'Show details'}>
                  <button
                    className={`expand-btn${isOpen ? ' open' : ''}`}
                    onClick={() => handleExpand(uniqueId, item.gradeId, item.sectionId)}
                  >
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                </Tooltip>
              </div>
            </div>
            {isOpen && (
              <div className="tb-detail">
                <div className="tb-detail-inner">
                  <div className="tb-detail-section">
  <div className="tb-detail-label">Terms</div>
  <div className="tb-detail-pills">
    {terms.length === 0 ? (
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        No terms found
      </span>
    ) : (
      terms.map(t => (
        <button
          key={t.id}
          type="button"
          className={`tb-detail-pill tb-detail-pill--clickable${selectedTerm[uniqueId] === t.id ? ' active' : ''}`}
          onClick={() => setSelectedTerm(prev => ({ ...prev, [uniqueId]: t.id }))}
        >
          {t.name}
        </button>
      ))
    )}
  </div>
</div>
                 <div className="tb-detail-section">
                    <div className="tb-detail-label">Subjects</div>
                    <div className="tb-detail-pills">
                      {isLoading ? (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          <i className="fa-solid fa-spinner fa-spin"></i> Loading subjects...
                        </span>
                      ) : subjects.length > 0 ? (
                        subjects.map((subject) => (
                          <button
                            key={subject.subjectID}
                            type="button"
                            className={`tb-detail-pill tb-detail-pill--clickable subj${selectedSubject[uniqueId] === subject.subjectID ? ' active' : ''}`}
                            onClick={() => setSelectedSubject(prev => ({ ...prev, [uniqueId]: subject.subjectID }))}
                          >
                            {subject.subjectName}
                          </button>
                        ))
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No subjects assigned
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="tb-detail-section">
                    <div className="tb-detail-label">Term Breakup</div>
                    {(() => {
                      const tbd = termBreakupData[uniqueId];
                      if (!tbd || tbd.loading) {
                        return (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            <i className="fa-solid fa-spinner fa-spin"></i> Loading term breakup...
                          </span>
                        );
                      }
                      if (tbd.noData || !tbd.units.length) {
                        return (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No data available for this term.
                          </span>
                        );
                      }
                      return tbd.units.map((u, ui) => (
                        <div key={ui} className="tbview-unit-card">
                          <div className="tbview-unit-hdr">
                            <span>Unit {u.unitNumber} - {u.unitName}</span>
                            <span className="tbview-unit-weeks">{u.weekRequired} weeks</span>
                          </div>
                          <table className="tbview-table">
                            <thead>
                              <tr>
                                <th style={{ width: 60 }}>S/No</th>
                                <th style={{ width: 160 }}>Units</th>
                                <th style={{ width: 120 }}>Weeks Required</th>
                                <th>Topics</th>
                                <th style={{ width: 130 }}>Periods Required</th>
                              </tr>
                            </thead>
                            <tbody>
                              {u.topics.length === 0 ? (
                                <tr>
                                  <td style={{ textAlign: 'center' }}><span className="tbview-cell-pill">{ui + 1}</span></td>
                                  <td><span className="tbview-cell-pill">{u.unitName}</span></td>
                                  <td style={{ textAlign: 'center' }}><span className="tbview-cell-pill">{u.weekRequired}</span></td>
                                  <td colSpan={2}><span className="tbview-cell-pill tbview-cell-pill--empty"></span></td>
                                </tr>
                              ) : u.topics.map((t, ti) => (
                                <tr key={ti}>
                                  {ti === 0 ? (
                                    <>
                                      <td rowSpan={u.topics.length} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                        <span className="tbview-cell-pill">{ui + 1}</span>
                                      </td>
                                      <td rowSpan={u.topics.length} style={{ verticalAlign: 'middle' }}>
                                        <span className="tbview-cell-pill">{u.unitName}</span>
                                      </td>
                                      <td rowSpan={u.topics.length} style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                        <span className="tbview-cell-pill">{u.weekRequired}</span>
                                      </td>
                                    </>
                                  ) : null}
                                  <td>
                                    <span className="tbview-cell-pill">{t.subTopic}</span>
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className="tbview-cell-pill">{t.periodRequired}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ));
                    })()}
                  </div>
                  <div className="tb-detail-actions">
                    <Tooltip text={`Download ${className} - Section ${item.sectionName || ''} term breakup (color PDF)`}>
                      <button className="export-btn pdf" onClick={() => onReport(`${className} - Section ${item.sectionName || ''} — Term Breakup`, 'pdf')}>
                        <i className="fa-solid fa-file-pdf"></i> PDF Color
                      </button>
                    </Tooltip>
                    <Tooltip text={`Download ${className} - Section ${item.sectionName || ''} term breakup as Word`}>
                      <button className="export-btn word" onClick={() => onReport(`${className} - Section ${item.sectionName || ''} — Term Breakup`, 'word')}>
                        <i className="fa-brands fa-microsoft"></i> Word
                      </button>
                    </Tooltip>
                    <Tooltip text="Delete term breakup">
                      <button className="lp-icon-del" onClick={() => openConfirm({
                        title: 'Delete Term Breakup?',
                        message: `Term breakup for <strong>${className} - Section ${item.sectionName || ''}</strong> will be permanently removed.`,
                        hint: 'Linked lesson plans will no longer have a structure to follow.',
                        confirmLabel: 'Yes, Delete',
                        icon: 'fa-trash',
                        onConfirm: () => toast('Term breakup deleted', 'success'),
                      })} aria-label="Delete term breakup">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════
   TERM BREAKUP UPDATE MODAL — EXACT copy of HTML's .tbm-modal popup
   ═══════════════════════════════════════════════════════════════════ */
const TBM_TERMS    = ['2nd', '3rd Term', '5th Term', 'testing', 'combined'];
const TBM_SUBJECTS = ['English', 'Urdu', 'Mathematics', 'Science', 'Islamiat'];

function TermBreakupModal({ cls, gradeId, sectionId,onSaved, onClose, toast }) {
  const [termTab, setTermTab] = useState('');
  const [subjTab, setSubjTab] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [terms, setTerms] = useState([]);
  const [termBreakupID, setTermBreakupID] = useState(null);
const [loadingBreakup, setLoadingBreakup] = useState(false);
const [savingBreakup, setSavingBreakup] = useState(false);
const [totalLectures, setTotalLectures] = useState(0);
  const [units, setUnits] = useState([
    { id: 1, unitNum: '', unitName: '', weeksRequired: '0',
      topics: [{ id: 11, subTopic: '', periodsRequired: '0' }] },
  ]);


  // useEffects PEHLE — early return se pehle
  useEffect(() => {
    if (!cls) return;
    const loadTerms = async () => {
      try {
        const json = await termsCrud({
          id: 0,
          branchID: termsBranchID(),
          term: 'string',
          sessionYearID: termsSessionYearID(),
          action: 'get',
        });
       console.log('termscrud response:', json);

const list = Array.isArray(json)
  ? json
  : Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.Data)
      ? json.Data
      : Array.isArray(json?.result)
        ? json.result
        : [];

const mapped = list.map(t => ({
  id: t.id ?? t.ID ?? t.termID ?? t.TermID,
  name: t.term ?? t.Term ?? t.name ?? t.Name ?? 'Term',
})).filter(t => t.id && t.name);

setTerms(mapped);

if (mapped.length > 0) {
  setTermTab(prev => prev || mapped[0].name);
}
      } catch (e) {
        console.error('Error loading terms:', e);
      }
    };
    loadTerms();
  }, [cls]);

  useEffect(() => {
    if (!gradeId || !sectionId) return;
    console.log('Fetching subjects for gradeId:', gradeId, 'sectionId:', sectionId); // test log
    const loadSubjects = async () => {
  setLoadingSubjects(true);
  try {
    const res = await fetch(
      buildUrl(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`),
      { method: 'GET', headers: { Accept: '*/*' } }
    );
    console.log('Subjects API status:', res.status);
    const json = await res.json().catch(() => ({}));
    console.log('Subjects API response:', json);
    const list = Array.isArray(json) ? json : (json?.data || []);
    console.log('Subjects list:', list);
    setSubjects(list);
    if (list.length > 0) {
      const firstSubject = list[0].subjectName || list[0].name || '';
      console.log('First subject selected:', firstSubject);
      setSubjTab(firstSubject);
    }
  } catch (e) {
    console.error('Error loading subjects:', e);
    setSubjects([]);
  } finally {
    setLoadingSubjects(false);
  }
};
    
    loadSubjects();
  }, [gradeId, sectionId, cls]);
  useEffect(() => {
  if (!cls || !termTab || !subjTab) return;
  loadTermBreakup();
  fetchTotalLectures();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [cls, gradeId, sectionId, termTab, subjTab]);

  //  Early return BAAD mein
  const open = cls !== null && cls !== undefined;
  if (!open) return null;

  const addUnit = () => setUnits([
    ...units,
    { id: Date.now(), unitNum: '', unitName: '', weeksRequired: '0',
      topics: [{ id: Date.now() + 1, subTopic: '', periodsRequired: '0' }] },
  ]);
  const removeUnit = id => {
    if (units.length <= 1) { toast('At least one unit is required', 'error'); return; }
    setUnits(units.filter(u => u.id !== id));
  };
  const updateUnit = (id, key, val) => {
  setUnits(prevUnits => prevUnits.map(u => {
    if (u.id !== id) return u;

    const nextUnit = { ...u, [key]: val };

  if (key === 'weeksRequired' && nextUnit.topics.some(t => !validateTopicPeriods(nextUnit, t))) {
  return u;
}

    return nextUnit;
  }));
};

  const addTopic = unitId => setUnits(units.map(u => u.id !== unitId ? u : {
    ...u,
    topics: [...u.topics, { id: Date.now(), subTopic: '', periodsRequired: '0' }],
  }));
  const removeTopic = (unitId, topicId) => setUnits(units.map(u => {
    if (u.id !== unitId) return u;
    if (u.topics.length <= 1) { toast('At least one topic is required', 'error'); return u; }
    return { ...u, topics: u.topics.filter(t => t.id !== topicId) };
  }));
  const updateTopic = (unitId, topicId, key, val) => {
  setUnits(prevUnits => prevUnits.map(u => {
    if (u.id !== unitId) return u;

    const nextUnit = {
      ...u,
      topics: u.topics.map(t => t.id === topicId ? { ...t, [key]: val } : t),
    };
    const nextTopic = nextUnit.topics.find(t => t.id === topicId);

    if (key === 'periodsRequired' && !validateTopicPeriods(nextUnit,nextTopic)) {
      return u;
    }

    return nextUnit;
  }));
};
    const getAuthHeaders = () => {
  const token = sessionStorage.getItem('token') || localStorage.getItem('token');
  return {
    Accept: '*/*',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const selectedTermID = () => {
  const found = terms.find(t => t.name === termTab);
  return found?.id ?? '';
};

const selectedSubjectID = () => {
  const found = subjects.find(s => (s.subjectName || s.name || '') === subjTab);
  return found?.subjectID || found?.id || '';
};

const emptyUnit = () => ({
  id: Date.now(),
  unitNum: '',
  unitName: '',
  weeksRequired: '0',
  topics: [{ id: Date.now() + 1, subTopic: '', periodsRequired: '0' }],
});

const mapRowsToUnits = rows => {
  const unitMap = {};
  const unitOrder = [];

  rows.forEach(r => {
    const unitNumber = r.unitNumber ?? r.UnitNumber ?? '';
    const unitName = r.unitName ?? r.UnitName ?? '';
    const weekRequired = r.weekRequired ?? r.WeekRequired ?? '0';
    const subTopic = r.subTopic ?? r.SubTopic ?? '';
    const periodRequired = r.periodRequired ?? r.PeriodRequired ?? '0';

    const key = `${unitNumber}__${unitName}__${weekRequired}`;
    if (!unitMap[key]) {
      unitMap[key] = {
        id: r.id ?? r.detailID ?? Date.now() + unitOrder.length,
        detailID: r.id ?? r.detailID ?? null,
        unitNum: unitNumber,
        unitName,
        weeksRequired: String(weekRequired || '0'),
        topics: [],
      };
      unitOrder.push(key);
    }

    unitMap[key].topics.push({
      id: r.id ?? r.detailID ?? Date.now() + Math.random(),
      detailID: r.id ?? r.detailID ?? null,
      subTopic,
      periodsRequired: String(periodRequired || '0'),
    });
  });

  return unitOrder.map(k => ({
    ...unitMap[k],
    topics: unitMap[k].topics.length ? unitMap[k].topics : [
      { id: Date.now(), subTopic: '', periodsRequired: '0' },
    ],
  }));
};

const loadTermBreakup = async () => {
  const termID = selectedTermID();
  const subjectID = selectedSubjectID();

  if (!gradeId || !sectionId || !termID || !subjectID) return;

  setLoadingBreakup(true);

  try {
    const params = new URLSearchParams({
      branchID: String(termsBranchID() ?? ''),
      classID: String(gradeId ?? ''),
      sectionID: String(sectionId ?? ''),
      subjectID: String(subjectID ?? ''),
      termID: String(termID ?? ''),
      sessionID: String(termsSessionYearID() ?? ''),
      pageNo: '1',
    });

    const res = await fetch(buildUrl(`/api/gettermbreakups?${params.toString()}`), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const json = await res.json().catch(() => ({}));
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
    const breakupId = list[0]?.id ?? null;

    setTermBreakupID(breakupId);

    if (!breakupId) {
      setUnits([emptyUnit()]);
      return;
    }

    const detailRes = await fetch(buildUrl('/api/lptermbreakupdetailscrud'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        id: breakupId,
        termBreakupID: breakupId,
        unitNumber: '',
        unitName: '',
        weekRequired: '',
        subTopic: '',
        periodRequired: '',
        type: '',
        action: 'get',
      }),
    });

    const detailJson = await detailRes.json().catch(() => ({}));
    const rows = Array.isArray(detailJson)
      ? detailJson
      : Array.isArray(detailJson?.data)
        ? detailJson.data
        : [];

    setUnits(rows.length ? mapRowsToUnits(rows) : [emptyUnit()]);
  } catch (e) {
    console.error('Error loading term breakup:', e);
    toast('Failed to load term breakup', 'error');
  } finally {
    setLoadingBreakup(false);
  }
};

const toApiNumber = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const readApiJson = async res => {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('API failed:', res.url, res.status, json);
    throw new Error(json?.message || json?.title || JSON.stringify(json) || `API failed: ${res.status}`);
  }
  return json;
};

//total lectres calculate karne ke liye
const fetchTotalLectures = async () => {
  const subjectID = selectedSubjectID();
  if (!gradeId || !sectionId || !subjectID) {
    setTotalLectures(0);
    return;
  }

  try {
    const payload = {
      id: '0',
      branchID: String(termsBranchID() ?? ''),
      classID: String(gradeId ?? ''),
      sectionID: String(sectionId ?? ''),
      subjectID: String(subjectID ?? ''),
      sessionID: String(termsSessionYearID() ?? ''),
      totalLectures: '',
      action: 'get',
    };

    console.log('lpcountforsubjectscrud payload:', payload);

    const res = await fetch(buildUrl('/api/lpcountforsubjectscrud'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    const json = await readApiJson(res);
    console.log('lpcountforsubjectscrud response:', json);

    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.Data)
          ? json.Data
          : json?.data
            ? [json.data]
            : [json];

    const row = rows[0] || {};

    const count =
      row.totalLectures ??
      row.TotalLectures ??
      row.totalLecture ??
      row.TotalLecture ??
      row.totallectures ??
      row.totallectres ??
      row.totalLectres ??
      row.TotalLectres ??
      row.totalLectureCount ??
      row.TotalLectureCount ??
      row.total ??
      row.Total ??
      0;

    console.log('Total lectures parsed:', count);
    setTotalLectures(Number(count) || 0);
  } catch (e) {
    console.error('Error loading total lectures:', e);
    setTotalLectures(0);
  }
};

const getUnitPeriodLimit = unit => {
  return (Number(totalLectures) || 0) * (Number(unit.weeksRequired) || 0);
};

const validateTopicPeriods = (unit, topic) => {
  const limit = getUnitPeriodLimit(unit);
  const entered = Number(topic.periodsRequired) || 0;

  if (limit > 0 && entered > limit) {
    toast(`Limit exceeded! Entered Periods (${entered}) exceed Total Lecture Count (${limit}).`, 'error');
    return false;
  }

  return true;
};

const ensureTermBreakupID = async () => {
  if (termBreakupID) return termBreakupID;

const payload = {
  termBreakupData: '',
  id: '0',
  branchID: String(termsBranchID() ?? ''),
  classID: String(gradeId ?? ''),
  sectionID: String(sectionId ?? ''),
  subjectID: String(selectedSubjectID() ?? ''),
  termID: String(selectedTermID() ?? ''),
  sessionID: String(termsSessionYearID() ?? ''),
  action: 'insert',
};

console.log('lptermbreakupcrud insert payload:', payload);

const res = await fetch(buildUrl('/api/lptermbreakupcrud'), {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify(payload),
});

const json = await readApiJson(res);
const newId = json?.id ?? json?.data?.id ?? json?.data?.[0]?.id ?? json?.termBreakupID ?? json?.data?.termBreakupID;
  if (!newId) throw new Error('lptermbreakupcrud did not return id');

  setTermBreakupID(newId);
  return newId;
};

const saveDetailRow = async ({ unit, topic, action = 'insert' }) => {
  const breakupId = await ensureTermBreakupID();
  if (!String(unit.unitNum || '').trim() || Number.isNaN(Number(unit.unitNum))) {
  throw new Error('Unit number must be numeric. Example: 1, 2, 3');
}
if (!String(unit.unitName || '').trim()) {
  throw new Error('Unit name is required');
}
if (!validateTopicPeriods(unit, topic)) {
  throw new Error('Periods exceeded allowed lecture limit');
}

  const payload = {
  termBreakupDetailsData: '',
  id: String(topic?.detailID || unit?.detailID || 0),
  termBreakupID: String(breakupId ?? ''),
  unitNumber: String(unit.unitNum ?? ''),
  unitName: String(unit.unitName || '').trim(),
  weekRequired: String(unit.weeksRequired ?? '0'),
  subTopic: String(topic?.subTopic || '').trim(),
  periodRequired: String(topic?.periodsRequired ?? '0'),
  type: '',
  action,
};

console.log('lptermbreakupdetailscrud payload:', payload);

const res = await fetch(buildUrl('/api/lptermbreakupdetailscrud'), {
  method: 'POST',
  headers: getAuthHeaders(),
  body: JSON.stringify(payload),
});

return readApiJson(res);
};

const saveUnitDetails = async unit => {
  setSavingBreakup(true);
  try {
    for (const topic of unit.topics) {
      await saveDetailRow({
        unit,
        topic,
        action: topic.detailID ? 'update' : 'insert',
      });
    }
  toast('Unit saved', 'success');
await loadTermBreakup();
onSaved?.();
  } catch (e) {
    console.error('Error saving unit:', e);
  toast(e.message || 'Failed to save unit', 'error');
  } finally {
    setSavingBreakup(false);
  }
};

const saveAllDetails = async () => {
  setSavingBreakup(true);
  try {
    for (const unit of units) {
      for (const topic of unit.topics) {
        await saveDetailRow({
          unit,
          topic,
          action: topic.detailID ? 'update' : 'insert',
        });
      }
    }
   toast('Term breakup saved', 'success');
await loadTermBreakup();
onSaved?.();
onClose();
  } catch (e) {
    console.error('Error saving term breakup:', e);
    toast(e.message || 'Failed to save term breakup', 'error');
  } finally {
    setSavingBreakup(false);
  }
};

const updateWeekRequired = async unit => {
  const breakupId = await ensureTermBreakupID();

  await fetch(buildUrl('/api/lpupdateweekrequired'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      id: unit.detailID || 0,
      termBreakupID: breakupId,
      unitNumber: unit.unitNum,
      unitName: unit.unitName,
      weekRequired: unit.weeksRequired,
      action: 'update',
    }),
  });

  toast('Weeks required updated', 'success');
  await loadTermBreakup();
};

const deleteDetail = async ({ unit, topic }) => {
  const breakupId = await ensureTermBreakupID();

  const res = await fetch(buildUrl('/api/lptermbreakupdetailscrud'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      termBreakupDetailsData: '',
      id: String(topic?.detailID || unit?.detailID || 0),
      termBreakupID: String(breakupId ?? ''),
      unitNumber: String(unit.unitNum ?? ''),
      unitName: String(unit.unitName || '').trim(),
      weekRequired: String(unit.weeksRequired ?? '0'),
      subTopic: String(topic?.subTopic || '').trim(),
      periodRequired: String(topic?.periodsRequired ?? '0'),
      type: '',
      action: 'delete',
    }),
  });

  await readApiJson(res);

  setUnits(prevUnits => {
    const nextUnits = prevUnits.map(u => {
      if (u.id !== unit.id) return u;

      const nextTopics = u.topics.filter(t => t.id !== topic.id);

      return {
        ...u,
        topics: nextTopics.length
          ? nextTopics
          : [{ id: Date.now(), subTopic: '', periodsRequired: '0' }],
      };
    });

    return nextUnits;
  });

  toast('Deleted successfully', 'success');
  onSaved?.();
};

  return (
    <div className="tbm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tbm-modal">

        {/* FIXED: header */}
        <div className="tbm-header">
          <div>
            <div className="tbm-title" >
              <i className="fa-solid fa-layer-group" style={{ fontSize: 14, marginRight: 8, opacity: .8 }}></i>
              Term Breakups
            </div>
            <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 7 }}>
              <div className="tb-cls-icon" style={{ width: 22, height: 22, borderRadius: 5, fontSize: 9, flexShrink: 0 }}>
                <i className="fa-solid fa-code"></i>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{cls}</span>
            </div>
          </div>
          <Tooltip text="Close"><button className="tbm-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        {/* FIXED: term tabs */}
        <div className="tbm-term-tabs">
  {terms.length === 0 ? (
    <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
      Loading terms...
    </span>
  ) : terms.map(t => (
    <button key={t.id}
      className={`tbm-term-tab${termTab === t.name ? ' active' : ''}`}
      onClick={() => setTermTab(t.name)}>
      {t.name}
    </button>
  ))}
</div>

        {/* FIXED: subject tabs */}
        <div className="tbm-subj-tabs-wrap">
  <div className="tbm-subj-tabs">
    {loadingSubjects ? (
      <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 16px', display: 'inline-block' }}>
        <i className="fa-solid fa-spinner fa-spin"></i> Loading subjects...
      </span>
    ) : subjects.length === 0 ? (
      <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 16px', display: 'inline-block' }}>
        No subjects found
      </span>
    ) : subjects.map(s => {
      const name = s.subjectName || s.name || '';
      return (
        <button key={s.subjectID || s.id || name}
          className={`tbm-subj-tab${subjTab === name ? ' active' : ''}`}
          onClick={() => setSubjTab(name)}>
          {name}
        </button>
      );
    })}
  </div>
</div>

        {/* SCROLLABLE: body contains units + add button */}
        <div className="tbm-scroll-area">
          <div className="tbm-body">
  {loadingBreakup ? (
    <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
      <i className="fa-solid fa-spinner fa-spin"></i> Loading term breakup...
    </div>
  ) : units.map(u => (
              <div key={u.id} className="tbm-unit-block">
                <div className="tbm-unit-top">
                  <div>
                    <label className="tbm-label">Unit Number</label>
                    <input className="tbm-input"
                      value={u.unitNum}
                      placeholder="Enter unit number"
                      onChange={e => updateUnit(u.id, 'unitNum', e.target.value)} />
                  </div>
                  <div>
                    <label className="tbm-label">Unit Name</label>
                    <input className="tbm-input"
                      value={u.unitName}
                      placeholder="Enter unit name"
                      onChange={e => updateUnit(u.id, 'unitName', e.target.value)} />
                  </div>
                  <div>
                    <label className="tbm-label">Weeks Required</label>
                    <input className="tbm-input" type="number" min="0"
                      value={u.weeksRequired}
                      style={{ textAlign: 'center' }}
                      onChange={e => updateUnit(u.id, 'weeksRequired', e.target.value)} />
                  </div>
                  <div className="tbm-unit-top-btns">
                    <Tooltip text="Save unit"><button className="tbm-unit-save-btn"
                    disabled={savingBreakup}
                      onClick={() => saveUnitDetails(u)}>
                      <i className="fa-solid fa-floppy-disk"></i>
                    </button></Tooltip>
                    <Tooltip text="Update Week Required"><button className="tbm-unit-save-btn"
                      style={{ borderColor: 'rgba(30,58,138,.25)', background: 'rgba(30,58,138,.07)', color: '#1E3A8A' }}
                     //delete button replace with update button
                      onClick={() => updateWeekRequired(u)}>
                      <i className="fa-solid fa-pen"></i>
                    </button></Tooltip>
                  </div>
                </div>

                <div className="tbm-topics-area">
                  {u.topics.map(t => (
                    <div key={t.id} className="tbm-topic-row">
                      <div>
                        <label className="tbm-label">Sub Topic</label>
                        <input className="tbm-input"
                          value={t.subTopic}
                          placeholder="Enter sub topic"
                          onChange={e => updateTopic(u.id, t.id, 'subTopic', e.target.value)} />
                      </div>
                      <div>
                        <label className="tbm-label">Total Period Required</label>
                        <input className="tbm-input" type="number" min="0"
                          value={t.periodsRequired}
                          style={{ textAlign: 'center' }}
                          onChange={e => updateTopic(u.id, t.id, 'periodsRequired', e.target.value)} />
                      </div>
                      <div className="tbm-topic-action-cell">
                        {/* delete topics */}
                        <Tooltip text="Delete topic"><button className="tbm-topic-del-btn"
                        disabled={savingBreakup}
                         onClick={async () => {
  if (t.detailID) {
    await deleteDetail({ unit: u, topic: t });
  } else {
    removeTopic(u.id, t.id);
    toast('Topic removed', 'success');
  }
}} >
                          <i className="fa-solid fa-trash"></i>
                        </button></Tooltip>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ padding: '0 16px 14px' }}>
                  <Tooltip text="Add a topic to this unit">
                    <button className="tbm-topic-add-btn" onClick={() => addTopic(u.id)}>
                      <i className="fa-solid fa-plus"></i> + Add Topic
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>

          <div className="tbm-add-units-row">
            <Tooltip text="Add another unit">
              <button className="tbm-add-units-btn" onClick={addUnit}>
                <i className="fa-solid fa-circle-plus"></i> Add More Units
              </button>
            </Tooltip>
          </div>
        </div>

        {/* FIXED: footer */}
        <div className="tbm-footer">
          <Tooltip text="Discard changes and close">
            <button className="tbm-btn tbm-btn--cancel" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Save term breakup">
            <button className="tbm-btn tbm-btn--save"
  disabled={savingBreakup || loadingBreakup}
  onClick={saveAllDetails}>
  {savingBreakup ? 'Saving...' : 'Save'}
</button>
          </Tooltip>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CREATE LESSON PLANS — hero filter + sub-tabs + units rows
   ═══════════════════════════════════════════════════════════════════ */
function CreateLessonPlans({
  clpClass, setClpClass, clpSubject, setClpSubject,
  clpFetched, setClpFetched, clpSubtab, setClpSubtab, clpRefresh,
  units, setUnits, nbUnits, setNbUnits, setClpCtx,
  clpSection, setClpSection, sections, setSections, subjects, setSubjects,
  onManageUnits, onEditLesson, onAddQuestionType, onEditQuestionType,
  onReport, openConfirm, toast, classesData  // Add classesData parameter
}) {
  // Extract unique class names from the API response
  const classOptions = classesData?.map(classItem => classItem.name) || [];
  
  // Get subjects based on selected class


/* Resolve the ids the ULP APIs need from the current selections (as strings,
   matching the API contract). */
const resolveCtx = () => {
  const grade = classesData?.find(cls => cls.name === clpClass);
  const subjectID = subjects.find(s => s.subjectName === clpSubject)?.subjectID;
  return {
    branchID:  sessionStorage.getItem('branchID') || '',
    classID:   grade?.id != null ? String(grade.id) : '',
    sectionID: clpSection != null && clpSection !== '' ? String(clpSection) : '',
    subjectID: subjectID != null ? String(subjectID) : '',
  };
};

const fetchLessonPlans = async (opts) => {
  const silent = opts === true || opts?.silent === true;
  if (!clpClass)   { if (!silent) toast("Please select a class", "error");   return; }
  if (!clpSection) { if (!silent) toast("Please select a section", "error"); return; }
  if (!clpSubject) { if (!silent) toast("Please select a subject", "error"); return; }

  const { branchID, classID, sectionID, subjectID } = resolveCtx();
  if (!classID || !subjectID) { if (!silent) toast("Could not resolve class/subject", "error"); return; }
  setClpCtx({ branchID, classID, sectionID, subjectID });

  try {
    const token = sessionStorage.getItem('token') || '';
    const res = await window.fetch(
      buildUrl(`/api/getulpforclassesmaster?branchID=${branchID}&classID=${classID}&SectionID=${sectionID}&subjectID=${subjectID}&pageNo=1`),
      { method: 'GET', headers: { Accept: '*/*', Authorization: `bearer ${token}` } },
    );
    const json = await res.json();
    const rows = json?.data || [];

    /* Group rows by unit (unitNo + unitName mapped once); each row's
       lessonPlanTopic becomes a lesson under that unit. The raw record is kept
       so the Edit button can pass it to the modal. */
    const byUnit = new Map();
    rows.forEach(r => {
      const key = `${r.unitNo}__${r.unitName}`;
      if (!byUnit.has(key)) {
        byUnit.set(key, { id: key, unitNo: r.unitNo, unitName: r.unitName, lessons: [] });
      }
      const unit = byUnit.get(key);
      unit.lessons.push({
        id: r.id,
        num: unit.lessons.length + 1,
        topic: r.lessonPlanTopic,
        source: 'manual',
        record: r,
      });
    });
    setUnits(Array.from(byUnit.values()));
    setClpFetched(true);
    if (!silent) toast(`Loaded plans for ${clpClass} · ${clpSubject}`, "success");
  } catch (e) {
    console.error('Error fetching lesson plans:', e);
    if (!silent) toast('Could not load lesson plans', 'error');
  }
};

/* Re-fetch silently after a lesson/unit modal closes (parent bumps clpRefresh)
   so the table reflects inserts/updates/deletes made in the modal. */
useEffect(() => {
  if (clpRefresh && clpFetched) fetchLessonPlans({ silent: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [clpRefresh]);

const handleClassChange = async (e) => {
  const selectedClass = e.target.value;

  setClpClass(selectedClass);
    setClpSection('');
  setClpSubject("");
  setClpFetched(false);
  setSubjects([]);
  setSections([]);

    const selectedGrade = classesData?.find(cls => cls.name === selectedClass);
  if (!selectedGrade) return;

  setSections(selectedGrade.sections || []);
};

const handleSectionChange = async (e) => {
  const selectedSectionId = e.target.value;
  setClpSection(selectedSectionId);
  setClpSubject('');
  setClpFetched(false);
  setSubjects([]);

  if (!selectedSectionId || !clpClass) return;

  const selectedGrade = classesData?.find(cls => cls.name === clpClass);
  if (!selectedGrade) return;

  try {
    const res = await window.fetch(
      buildUrl(`/api/LaunchSetup/get-subjects/${selectedGrade.id}/${selectedSectionId}`),
      { method: 'GET', headers: { Accept: '*/*' } }
    );
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      const unique = [
        ...new Map(
          json.data.map(s => [s.subjectName.trim().toLowerCase(), s])
        ).values()
      ];
      setSubjects(unique);
    } else {
      setSubjects([]);
    }
  } catch (error) {
    console.error('Error fetching subjects:', error);
    setSubjects([]);
  }
};
  // Rest of your component remains the same...
  /* Delete one ULP class-master row (topic) by id. */
  const deleteUlpRecord = id => lpPost('/api/ulpforclassmastercrud', {
    id, ...resolveCtx(), unitNo: '', unitName: '', lessonPlanTopic: '', action: 'delete',
  });

  const removeUnit = u => openConfirm({
    title: 'Delete Unit?',
    message: `Unit <strong>"${u.unitName || u.unitNo}"</strong> and all its ${u.lessons?.length || u.questions?.length || 0} item(s) will be permanently removed.`,
    hint: 'This cannot be undone.',
    confirmLabel: 'Yes, Delete',
    icon: 'fa-trash',
    onConfirm: async () => {
      if (clpSubtab === 'lesson') {
        /* Delete every topic record under this unit, then drop it locally. */
        const ids = (u.lessons || []).map(l => l.record?.id).filter(Boolean);
        try { await Promise.all(ids.map(deleteUlpRecord)); }
        catch (e) { console.error('Error deleting unit topics:', e); toast('Could not delete unit', 'error'); return; }
        setUnits(units.filter(x => x.id !== u.id));
      } else {
        setNbUnits(nbUnits.filter(x => x.id !== u.id));
      }
      toast('Unit deleted', 'success');
    },
  });

  const removeLesson = (unitId, lesson) => openConfirm({
    title: 'Delete Lesson?',
    message: `Lesson <strong>"${lesson.topic || `Lesson ${lesson.num}`}"</strong> will be permanently removed.`,
    hint: 'This cannot be undone.',
    confirmLabel: 'Yes, Delete',
    icon: 'fa-trash',
    onConfirm: async () => {
      if (lesson.record?.id) {
        try { await deleteUlpRecord(lesson.record.id); }
        catch (e) { console.error('Error deleting lesson topic:', e); toast('Could not delete lesson', 'error'); return; }
      }
      setUnits(units.map(u => u.id !== unitId ? u : { ...u, lessons: u.lessons.filter(l => l.id !== lesson.id) }));
      toast('Lesson deleted', 'success');
    },
  });

  const removeQuestion = (unitId, q) => openConfirm({
    title: 'Delete Question Type?',
    message: `Question type <strong>"${q.type}"</strong> (${q.items.length} items) will be permanently removed.`,
    hint: 'This cannot be undone.',
    confirmLabel: 'Yes, Delete',
    icon: 'fa-trash',
    onConfirm: () => {
      setNbUnits(nbUnits.map(u => u.id !== unitId ? u : { ...u, questions: u.questions.filter(x => x.id !== q.id) }));
      toast('Question type deleted', 'success');
    },
  });

  return (
    <>
      {/* Hero filter card */}
      <div className="clp2-hero-card">
        <div className="clp2-hero-inner">
          <div className="clp2-hero-text">
            <div className="clp2-hero-title">
              <i className="fa-solid fa-book-open-reader clp2-hero-icon"></i>
              Create Lesson Plan
            </div>
            <div className="clp2-hero-sub">Select class and subject to manage units &amp; lessons</div>
          </div>
          
          <div className="clp2-filter-row">
            <div className="clp2-field">
    {/* <label className="clp2-field-label"><i className="fa-solid fa-school"></i> Class</label> */}
     <div className="sub-field">
                <label className="sub-field-label"><i className="fa-solid fa-school"></i> Class</label>
                <div className="sub-select-wrap">
                  <select 
                    className="sub-select" 
                    value={clpClass} 
                    onChange={handleClassChange}
                  >
                    <option value="">Select Class</option>
                    {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down sub-select-arrow"></i>
                </div>
              </div>
    {/* <div className="clp2-select-wrap">
      <select className="clp2-select" value={clpClass} onChange={handleClassChange}>
        <option value="">Select Class</option>
        {classOptions.map(className => (
          <option key={className} value={className}>{className}</option>
        ))}
      </select>
      <i className="fa-solid fa-chevron-down clp2-select-arrow"></i>
    </div> */}
  </div>

  {/* NEW: Section dropdown */}
  {/* <div className="clp2-field">
    <label className="clp2-field-label"><i className="fa-solid fa-users"></i> Section</label>
    <div className="clp2-select-wrap">
      <select
        className="clp2-select"
        value={clpSection}
        onChange={handleSectionChange}
        disabled={!clpClass || sections.length === 0}
      >
        <option value="">Select Section</option>
        {sections.map(sec => (
          <option key={sec.sectionID} value={sec.sectionID}>
            Section {sec.sectionName}
          </option>
        ))}
      </select>
      <i className="fa-solid fa-chevron-down clp2-select-arrow"></i>
    </div>
    
  </div> */}
   <div className="sub-field">
                <label className="sub-field-label"><i className="fa-solid fa-school"></i> Section</label>
                <div className="sub-select-wrap">
                  <select 
                    className="sub-select" 
                    value={clpSection} 
                    onChange={handleSectionChange}
                            disabled={!clpClass}

                  >
                    <option value="">Select Section</option>
                    {sections.map(sec => (
          <option key={sec.sectionID} value={sec.sectionID}>
            Section {sec.sectionName}
          </option>
        ))}
                  </select>
                  <i className="fa-solid fa-chevron-down sub-select-arrow"></i>
                </div>
              </div>

  {/* Subject dropdown — updated onChange */}

  <div className="sub-field">
                <label className="sub-field-label"><i className="fa-solid fa-school"></i> Subject</label>
                <div className="sub-select-wrap">
                  <select 
                    className="sub-select" 
                    value={clpSubject}
        onChange={e => { setClpSubject(e.target.value); setClpFetched(false); }}
                            disabled={!clpSection}
                  >
                    <option value="">Select Subject</option>
                    {subjects.map(subject => (
          <option key={subject.subjectID} value={subject.subjectName}>
            {subject.subjectName}
          </option>
        ))}
                  </select>
                  <i className="fa-solid fa-chevron-down sub-select-arrow"></i>
                </div>
              </div>
  {/* <div className="clp2-field">
    <label className="clp2-field-label"><i className="fa-solid fa-book"></i> Subject</label>
    <div className="clp2-select-wrap">
      <select
        className="clp2-select"
        value={clpSubject}
        onChange={e => { setClpSubject(e.target.value); setClpFetched(false); }}
        disabled={!clpSection}
      >
        <option value="">Select Subject</option>
        {subjects.map(subject => (
          <option key={subject.subjectID} value={subject.subjectName}>
            {subject.subjectName}
          </option>
        ))}
      </select>
      <i className="fa-solid fa-chevron-down clp2-select-arrow"></i>
    </div>
  </div> */}
            <Tooltip text="Load lesson plans for the selected class and subject">
              <button className="clp2-fetch-btn" onClick={fetchLessonPlans}>
                <i className="fa-solid fa-magnifying-glass"></i>
                <span>Fetch</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {clpFetched ? (
        <>
          {/* Toolbar */}
          <div className="clp2-toolbar">
            <div className="clp2-subtabs">
              <Tooltip text="Switch to Lesson Plans">
                <button className={`clp2-subtab${clpSubtab === 'lesson' ? ' active' : ''}`} onClick={() => setClpSubtab('lesson')}>
                  <i className="fa-solid fa-list-ul"></i> Lesson Plans
                </button>
              </Tooltip>
              <Tooltip text="Switch to Notebook Plans">
                <button className={`clp2-subtab${clpSubtab === 'notebook' ? ' active' : ''}`} onClick={() => setClpSubtab('notebook')}>
                  <i className="fa-solid fa-book"></i> Notebook Plans
                </button>
              </Tooltip>
            </div>
            <Tooltip text="Manage units (add, rename, reorder)">
              <button className="clp2-add-btn" onClick={() => onManageUnits(clpSubtab)}>
                <i className="fa-solid fa-plus"></i><span>Add Unit</span>
              </button>
            </Tooltip>
          </div>

          <div className="clp2-table-card">
            {clpSubtab === 'lesson' ? (
              units.length === 0 ? (
                <EmptyUnits label="Click 'Add Unit' to create your first unit" onAdd={() => onManageUnits('lesson')} />
              ) : (
                units.map((u, i) => (
                  <UnitRow
                    key={u.id}
                    unit={u}
                    index={i}
                    onReport={onReport}
                    onDeleteUnit={() => removeUnit(u)}
                    onEditLesson={l => onEditLesson(u.id, l.id, l, u)}
                    onDeleteLesson={l => removeLesson(u.id, l)}
                  />
                ))
              )
            ) : (
              nbUnits.length === 0 ? (
                <EmptyUnits label="Click 'Add Unit' to create your first notebook unit" onAdd={() => onManageUnits('notebook')} />
              ) : (
                nbUnits.map((u, i) => (
                  <NbUnitRow
                    key={u.id}
                    unit={u}
                    index={i}
                    onReport={onReport}
                    onDeleteUnit={() => removeUnit(u)}
                    onAddType={() => onAddQuestionType(u.id)}
                    onEditType={q => onEditQuestionType(u.id, q.id)}
                    onDeleteType={q => removeQuestion(u.id, q)}
                  />
                ))
              )
            )}
          </div>
        </>
      ) : (
        <div className="clp2-empty-state">
          <div className="clp2-empty-icon"><i className="fa-solid fa-book-open-reader"></i></div>
          <div className="clp2-empty-title">No lesson plans loaded</div>
          <div className="clp2-empty-sub">Select a class and subject above, then click <strong>Fetch</strong></div>
        </div>
      )}
    </>
  );
}
function EmptyUnits({ label, onAdd }) {
  return (
    <div className="clp2-empty-state" style={{ background: 'transparent', border: 'none' }}>
      <div className="clp2-empty-icon"><i className="fa-solid fa-layer-group"></i></div>
      <div className="clp2-empty-title">No units yet</div>
      <div className="clp2-empty-sub">{label}</div>
      <Tooltip text="Add the first unit">
        <button className="lp-btn primary" style={{ marginTop: 16 }} onClick={onAdd}>
          <i className="fa-solid fa-plus"></i> Add Unit
        </button>
      </Tooltip>
    </div>
  );
}

/* ─── Lesson-plans unit row (lessons) ─── */
function UnitRow({ unit, index, onReport, onDeleteUnit, onEditLesson, onDeleteLesson }) {
  const [open, setOpen] = useState(false);
  const manualCount = unit.lessons.filter(l => l.source === 'manual').length;
  const aiCount     = unit.lessons.filter(l => l.source === 'mentorai').length;

  return (
    <div className="clpr-unit">
      <div className="clpr-unit-row">
        <div className="clpr-unit-sno">{index + 1}</div>
        <div className="clpr-unit-no">Unit {unit.unitNo}</div>
        <div className="clpr-unit-name">{unit.unitName || '(no name)'}</div>
        <div className="clpr-unit-stats">
          <Tooltip text="Total lesson plans in this unit">
            <span className="clpr-stat clpr-stat--total">
              <i className="fa-solid fa-book"></i> {unit.lessons.length} lesson{unit.lessons.length !== 1 ? 's' : ''}
            </span>
          </Tooltip>
          <span className="clpr-stat-sep">·</span>
          <Tooltip text="Lessons added manually">
            <span className="clpr-stat clpr-stat--manual">
              <i className="fa-solid fa-pen-to-square"></i> {manualCount} manual
            </span>
          </Tooltip>
          <span className="clpr-stat-sep">·</span>
          <Tooltip text="Lessons generated by Mentor AI">
            <span className="clpr-stat clpr-stat--ai">
              <i className="fa-solid fa-robot"></i> {aiCount} AI
            </span>
          </Tooltip>
        </div>
        <div className="clpr-unit-actions">
          <Tooltip text="Download unit lesson plan as PDF">
            <button className="export-btn pdf" onClick={() => onReport(`Unit ${unit.unitNo} — ${unit.unitName}`, 'pdf')}>
              <i className="fa-solid fa-file-pdf"></i> PDF
            </button>
          </Tooltip>
          <Tooltip text="Download unit lesson plan as Word">
            <button className="export-btn word" onClick={() => onReport(`Unit ${unit.unitNo} — ${unit.unitName}`, 'word')}>
              <i className="fa-brands fa-microsoft"></i> Word
            </button>
          </Tooltip>
          <Tooltip text="Delete unit"><button className="lp-icon-del" onClick={onDeleteUnit} aria-label="Delete unit">
            <i className="fa-solid fa-trash"></i>
          </button></Tooltip>
          <Tooltip text={open ? 'Collapse unit' : 'Expand unit'}>
            <button className={`expand-btn${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse unit' : 'Expand unit'}>
              <i className="fa-solid fa-chevron-down"></i>
            </button>
          </Tooltip>
        </div>
      </div>

      {open && (
        <div className="clpr-lessons-panel">
          {unit.lessons.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, fontStyle: 'italic' }}>
              No lessons in this unit
            </div>
          ) : unit.lessons.map((l, li) => (
            <div key={l.id} className="clpr-lesson-card">
              <div className="clpr-lesson-top">
                <div className="clpr-lesson-meta">
                  <span className="clpr-lesson-num">#{li + 1}</span>
                  <span className="clpr-lesson-num-tag">{l.num}</span>
                  <i className="fa-regular fa-file-lines clpr-lesson-file-icon"></i>
                  <span className="clpr-lesson-name">{l.topic || <span style={{ opacity: .5, fontStyle: 'italic' }}>Untitled</span>}</span>
                </div>
                <span className={`clp-src-badge ${l.source === 'mentorai' ? 'ai' : 'manual'}`}>
                  {l.source === 'mentorai'
                    ? <><i className="fa-solid fa-wand-magic-sparkles"></i> Mentor AI</>
                    : <><i className="fa-solid fa-pen-nib"></i> Manual</>}
                </span>
                <div className="clpr-lesson-actions" onClick={e => e.stopPropagation()}>
                  <Tooltip text="Edit this lesson">
                    <button className="clpr-action-btn clpr-action-edit" onClick={() => onEditLesson(l)}>
                      <i className="fa-solid fa-pen"></i> <span>Edit</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Download lesson as PDF">
                    <button className="clpr-action-btn clpr-action-pdf" onClick={() => onReport(`Lesson ${l.num} — ${l.topic || 'Untitled'} · Unit ${unit.unitNo}`, 'pdf')}>
                      <i className="fa-solid fa-file-pdf"></i> <span>PDF</span>
                    </button>
                  </Tooltip>
                  <Tooltip text="Delete this lesson">
                    <button className="clpr-action-btn clpr-action-del" onClick={() => onDeleteLesson(l)}>
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Notebook-plans unit row — verbatim from HTML ─── */
function NbUnitRow({ unit, index, onReport, onDeleteUnit, onAddType, onEditType, onDeleteType }) {
  const [open, setOpen] = useState(false);
  const total  = unit.questions.length;
  const manual = unit.questions.filter(q => q.source === 'manual').length;

  return (
    <div className={`clpr-unit-card${open ? ' open' : ''}`}>
      <div className="clpr-unit-header" onClick={() => setOpen(o => !o)}>

        {/* Row 1: icon + name */}
        <div className="clpr-unit-left">
          <div className="clpr-unit-icon-wrap">
            <i className="fa-solid fa-book-open"></i>
          </div>
          <div className="clpr-unit-info">
            <div className="clpr-unit-name">{unit.unitName || '(no name)'}</div>
            <div className="clpr-unit-sub">Unit {unit.unitNo}</div>
          </div>
        </div>

        {/* Stats (hidden on mobile via media query) */}
        <div className="clpr-unit-stats">
          <span className="clpr-stat clpr-stat--total">
            <i className="fa-solid fa-circle-question"></i> {total} type{total !== 1 ? 's' : ''}
          </span>
          <span className="clpr-stat-sep">·</span>
          <span className="clpr-stat clpr-stat--manual">
            <i className="fa-solid fa-pen-to-square"></i> {manual} manual
          </span>
        </div>

        {/* Actions: Add Questions · PDF · Delete · Expand */}
        <div className="clpr-unit-right" onClick={e => e.stopPropagation()}>
          <Tooltip text="Add Questions"><button className="nb-aq-pill" onClick={onAddType}>
            <i className="fa-solid fa-plus nb-aq-icon"></i>
            <span className="nb-aq-label">Add Questions</span>
          </button></Tooltip>
          <Tooltip text="Download PDF"><button className="clpr-icon-btn clpr-icon-btn--pdf"
            onClick={() => onReport(`Unit ${unit.unitNo} — Notebook`, 'pdf')}>
            <i className="fa-solid fa-file-pdf"></i>
          </button></Tooltip>
          <Tooltip text="Delete unit"><button className="clpr-icon-btn clpr-icon-btn--del" onClick={onDeleteUnit} aria-label="Delete unit">
            <i className="fa-solid fa-trash-can"></i>
          </button></Tooltip>
          <Tooltip text={open ? 'Collapse unit' : 'Expand unit'}>
            <button className={`clpr-icon-btn clpr-icon-btn--expand${open ? ' open' : ''}`}
              onClick={() => setOpen(o => !o)} aria-label={open ? 'Collapse unit' : 'Expand unit'}>
              <i className="fa-solid fa-chevron-down"></i>
            </button>
          </Tooltip>
        </div>
      </div>

      {open && (
        <div className="clpr-lessons-panel">
          {unit.questions.length === 0 ? (
            <div className="clpr-no-lessons">
              <i className="fa-solid fa-circle-question" style={{ fontSize: 20, color: 'var(--brand-primary)', opacity: .4 }}></i>
              <span>No questions yet — click <strong>Add Questions</strong> to begin</span>
            </div>
          ) : unit.questions.map((q, idx) => {
            const rowsCount = (q.rows && q.rows.length) || (q.items && q.items.length) || 0;
            return (
              <div key={q.id} className="clpr-lesson-card">
                <div className="clpr-lesson-top">
                  <div className="clpr-lesson-meta">
                    <span className="clpr-lesson-num">#{idx + 1}</span>
                    <span
                      className="clpr-lesson-num-tag"
                      style={{ background: 'rgba(8,145,178,.12)', color: '#0E7490', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
                    >{q.type}</span>
                    <i className="fa-regular fa-file-lines clpr-lesson-file-icon"></i>
                    <span className="clpr-lesson-name">{q.mainQuestion || q.mainQ || '(No main question)'}</span>
                  </div>
                  <span
                    style={{ fontSize: 11, fontWeight: 700, color: '#0E7490', background: 'rgba(8,145,178,.08)', border: '1px solid rgba(8,145,178,.2)', padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <i className="fa-solid fa-list" style={{ fontSize: 9 }}></i> {rowsCount} item{rowsCount !== 1 ? 's' : ''}
                  </span>
                  <span className={`clp-src-badge ${q.source === 'mentorai' ? 'ai' : 'manual'}`}>
                    {q.source === 'mentorai'
                      ? <><i className="fa-solid fa-wand-magic-sparkles"></i> Mentor AI</>
                      : <><i className="fa-solid fa-pen-nib"></i> Manual</>}
                  </span>
                  <div className="clpr-lesson-actions" onClick={e => e.stopPropagation()}>
                    <Tooltip text="Edit this question type">
                      <button className="clpr-action-btn clpr-action-edit" onClick={() => onEditType(q)}>
                        <i className="fa-solid fa-pen"></i> <span>Edit</span>
                      </button>
                    </Tooltip>
                    <Tooltip text="Download PDF"><button className="clpr-icon-btn clpr-icon-btn--pdf"
                      onClick={() => onReport(`Section ${q.id} — ${q.type} — Unit ${unit.unitNo}`, 'pdf')}>
                      <i className="fa-solid fa-file-pdf"></i>
                    </button></Tooltip>
                    <Tooltip text="Delete"><button className="clpr-icon-btn clpr-icon-btn--del" onClick={() => onDeleteType(q)}>
                      <i className="fa-solid fa-trash-can"></i>
                    </button></Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* No-lessons placeholder used by both lesson + notebook panels — verbatim from HTML */

/* ═══════════════════════════════════════════════════════════════════
   SUBMISSIONS — Teacher view (verbatim layout from HTML)
   ═══════════════════════════════════════════════════════════════════ */
function Submissions({ toast, classesData = [] }) {
  const [role, setRole] = useState('teacher');
  const [cls, setCls] = useState('');
  const [section, setSection] = useState('');
  const [subject, setSubject] = useState('');
  const [fetched, setFetched] = useState(false);
  const [inner, setInner] = useState('lp'); // lp | nb
  
  // Add state for subjects
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  
  const { data: lpData = [], setData: setLpData } = useAsync(academicsService.getSubLpData, []);
  const { data: nbData = [], setData: setNbData } = useAsync(academicsService.getSubNbData, []);

  const [lpUnitOpen, setLpUnitOpen] = useState({});
  const [nbUnitOpen, setNbUnitOpen] = useState({});
  const [nbQOpen, setNbQOpen] = useState({});

  const [viewerId, setViewerId] = useState(null);
  const [nbSubmitCtx, setNbSubmitCtx] = useState(null);
  const [pdfReq, setPdfReq] = useState(null);
  /* Resolved ids for the loaded lesson plans (for detail/suggestion calls). */
  const [subCtx, setSubCtx] = useState({});

  /* Analytics */
  const lpTotal = lpData.length;
  const lpSubmitted = lpData.filter(p => p.status === 'submitted').length;
  const lpPending = lpTotal - lpSubmitted;
  const lpPct = lpTotal ? Math.round((lpSubmitted / lpTotal) * 100) : 0;

  const nbAllItems = nbData.flatMap(u => u.questionTypes.flatMap(qt => qt.items));
  const nbTotal = nbAllItems.length;
  const nbSubmitted = nbAllItems.filter(i => i.status === 'submitted').length;
  const nbPending = nbTotal - nbSubmitted;
  const nbPct = nbTotal ? Math.round((nbSubmitted / nbTotal) * 100) : 0;
  const nbUnits = nbData.length;
  const nbQTypes = nbData.reduce((a, u) => a + u.questionTypes.length, 0);

  // Helper functions to process classesData
  const getUniqueClasses = () => {
    const uniqueClasses = new Set();
    classesData.forEach(classItem => {
      if (classItem.name) {
        uniqueClasses.add(classItem.name);
      }
    });
    return Array.from(uniqueClasses).sort();
  };

  const getGradeIdFromClassName = (className) => {
    const classItem = classesData.find(c => c.name === className);
    return classItem ? classItem.id : null;
  };

  const getSectionIdFromName = (sectionName) => {
    const classItem = classesData.find(c => c.name === cls);
    if (!classItem) return null;
    const sectionItem = classItem.sections?.find(s => s.sectionName === sectionName);
    return sectionItem ? sectionItem.sectionID : null;
  };

  const getSectionsForClass = () => {
    const classItem = classesData.find(c => c.name === cls);
    if (!classItem || !classItem.sections || classItem.sections.length === 0) {
      return [];
    }
    return classItem.sections.map(section => ({
      id: section.sectionID,
      name: section.sectionName
    }));
  };

  // Fetch subjects when class and section are selected
  const fetchSubjects = async () => {
    if (!cls || !section) {
      setAvailableSubjects([]);
      return;
    }

    const gradeId = getGradeIdFromClassName(cls);
    const sectionId = getSectionIdFromName(section);

    if (!gradeId || !sectionId) {
      setAvailableSubjects([]);
      return;
    }

    setLoadingSubjects(true);
    
    try {
      const empID = sessionStorage.getItem("employee_ID");
  const response = await fetch(
         buildUrl(`/get-subjects_byEmployeeID/${gradeId}/${sectionId}/${empID}`),
         {
           method: "GET",
           headers: {
             Accept: "*/*",
           },
         }
       );
      
      const json = await response.json();
      
      if (json.success && json.data) {
        /* keep full objects (subjectID + subjectName) so we can resolve ids */
        const unique = [...new Map(json.data.map(s => [s.subjectName.trim().toLowerCase(), s])).values()];
        setAvailableSubjects(unique);
        // Reset subject selection when subjects change
        setSubject('');
      } else {
        setAvailableSubjects([]);
        toast('No subjects found for this class and section', 'info');
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
      setAvailableSubjects([]);
      toast('Error loading subjects. Please try again.', 'error');
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Fetch subjects when class or section changes
  useEffect(() => {
    if (cls && section) {
      fetchSubjects();
    } else {
      setAvailableSubjects([]);
      setSubject('');
    }
  }, [cls, section]);

  const fetchData = async () => {
    if (!cls || !section || !subject) {
      toast('Please select Class, Section and Subject', 'error');
      return;
    }
    const classID   = getGradeIdFromClassName(cls);
    const sectionID = getSectionIdFromName(section);
    const subjectID = availableSubjects.find(s => s.subjectName === subject)?.subjectID;
    if (!classID || !subjectID) { toast('Could not resolve class/subject', 'error'); return; }
    const branchID = sessionStorage.getItem('branchID') || '';
    setSubCtx({ branchID, classID: String(classID), sectionID: String(sectionID || ''), subjectID: String(subjectID) });

    try {
      const token = sessionStorage.getItem('token') || '';
      const res = await fetch(
        buildUrl(`/api/getulpforclassesmaster?branchID=${branchID}&classID=${classID}&SectionID=${sectionID}&subjectID=${subjectID}&pageNo=1`),
        { method: 'GET', headers: { Accept: '*/*', Authorization: `bearer ${token}` } },
      );
      const json = await res.json();
      const rows = json?.data || [];
      /* Map each ULP master row to a submission "plan" (grouped by unit below). */
      const plans = rows.map(r => ({
        id: r.id, unitNo: r.unitNo, unit: r.unitName || '(no name)',
        topic: r.lessonPlanTopic, term: '', date: '', status: 'pending', record: r,
      }));
      setLpData(plans);
      setFetched(true);
      setInner('lp');
      setLpUnitOpen({ 0: true });
      toast(`Loaded lesson plans for ${cls}-${section} · ${subject}`, 'success');

      /* Mark a plan "submitted" when it already has a suggestion record:
         master → detail (by master id) → suggestion (by detail id). */
      const auth = { Accept: '*/*', Authorization: `bearer ${token}` };
      const withStatus = await Promise.all(plans.map(async p => {
        try {
          const dres = await fetch(
            buildUrl(`/api/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${p.id}&classID=${classID}&subjectID=${subjectID}&pageNo=1`),
            { method: 'GET', headers: auth },
          );
          const d = ((await dres.json())?.data || [])[0];
          if (!d?.id) return { ...p, status: 'pending' };
          const sres = await fetch(
            buildUrl(`/api/getulpforclasssuggestion?BranchID=${branchID}&ClassID=${classID}&SubjectID=${subjectID}&DetailClassID=${d.id}&pageNo=1`),
            { method: 'GET', headers: auth },
          );
          const s = ((await sres.json())?.data || [])[0];
          return { ...p, status: s ? 'submitted' : 'pending', detailId: d.id, suggestionId: s?.id || 0 };
        } catch {
          return { ...p, status: 'pending' };
        }
      }));
      setLpData(withStatus);
    } catch (e) {
      console.error('Error loading lesson plans:', e);
      toast('Could not load lesson plans', 'error');
    }
  };

  /* Submit a single lesson plan from the viewer */
  const submitLp = id => {
    const today = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const time = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    setLpData(prev => prev.map(p => p.id === id ? { ...p, status: 'submitted', submittedDate: today, submittedTime: time } : p));
    toast('Lesson plan submitted successfully!', 'success');
  };

  /* Submit selected NB items */
  const submitNbItems = (unitId, typeId, itemIds) => {
    if (!itemIds.length) return;
    const today = new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
    const time = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    setNbData(prev => prev.map(u => {
      if (u.unitId !== unitId) return u;
      return {
        ...u,
        questionTypes: u.questionTypes.map(qt => {
          if (qt.typeId !== typeId) return qt;
          return {
            ...qt,
            items: qt.items.map(it => itemIds.includes(it.id) ? { ...it, status: 'submitted', submittedDate: today, submittedTime: time } : it),
          };
        }),
      };
    }));
    setNbSubmitCtx(null);
    toast(`${itemIds.length} item${itemIds.length > 1 ? 's' : ''} submitted successfully!`, 'success');
  };

  /* Generate the report after style is picked */
  const generatePdf = isColor => {
    if (!pdfReq) return;
    const { type, unitId } = pdfReq;
    const ctx = {
      cls, section, subject,
      lpData, nbData,
    };
    if (type === 'lp') buildLpSubReport(ctx, isColor);
    else if (type === 'nb') buildNbSubReport(ctx, isColor);
    else if (type === 'nb-unit') buildNbSubUnitReport(ctx, unitId, isColor);
    else if (type === 'admin-teacher') buildAdminTeacherReport(isColor);
    else if (type === 'admin-class') buildAdminClassReport(isColor);
    else if (type === 'admin-subject') buildAdminSubjectReport(isColor);
    setPdfReq(null);
  };

  /* Group LP by unit */
  const lpGroups = (() => {
    const map = {};
    const order = [];
    lpData.forEach(p => {
      if (!map[p.unit]) { map[p.unit] = []; order.push(p.unit); }
      map[p.unit].push(p);
    });
    return order.map(u => ({ unit: u, unitNo: map[u][0]?.unitNo, plans: map[u] }));
  })();

  const classOptions = getUniqueClasses();
  const sectionsForClass = getSectionsForClass();

  return (
    <>
      {/* ── HERO SELECTION CARD ── */}
      <div className="sub-hero-card">
        <div className="sub-hero-orb sub-hero-orb--1"></div>
        <div className="sub-hero-orb sub-hero-orb--2"></div>
        <div className="sub-hero-inner">
          <div className="sub-hero-left">
            <div className="sub-hero-icon-wrap"><i className="fa-solid fa-paper-plane"></i></div>
            <div>
              <div className="sub-hero-title">Submissions</div>
              <div className="sub-hero-sub">Select class, section &amp; subject to track and submit lesson &amp; notebook plans</div>
            </div>
          </div>
          {/* Role toggle */}
          <div className="sub-role-toggle">
            <Tooltip text="View submissions as teacher">
              <button className={`sub-role-btn${role === 'teacher' ? ' active' : ''}`} onClick={() => setRole('teacher')}>
                <i className="fa-solid fa-chalkboard-user"></i> Teacher
              </button>
            </Tooltip>
            <Tooltip text="View admin-wide submission reports">
              <button className={`sub-role-btn${role === 'admin' ? ' active' : ''}`} onClick={() => setRole('admin')}>
                <i className="fa-solid fa-shield-halved"></i> Admin
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Filter row (Teacher only) */}
        {role === 'teacher' && (
          <div className="sub-filter-row">
            <div className="sub-filter-fields">
              <div className="sub-field">
                <label className="sub-field-label"><i className="fa-solid fa-school"></i> Class</label>
                <div className="sub-select-wrap">
                  <select 
                    className="sub-select" 
                    value={cls} 
                    onChange={e => { 
                      setCls(e.target.value); 
                      setSection(''); 
                      setSubject(''); 
                    }}
                  >
                    <option value="">Select Class</option>
                    {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <i className="fa-solid fa-chevron-down sub-select-arrow"></i>
                </div>
              </div>
              <div className="sub-field">
                <label className="sub-field-label"><i className="fa-solid fa-users"></i> Section</label>
                <div className="sub-select-wrap">
                  <select 
                    className="sub-select" 
                    value={section} 
                    onChange={e => setSection(e.target.value)}
                    disabled={!cls}
                  >
                    <option value="">Select Section</option>
                    {sectionsForClass.map(s => (
                      <option key={s.id} value={s.name}>Section {s.name}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down sub-select-arrow"></i>
                </div>
              </div>
              <div className="sub-field">
                <label className="sub-field-label"><i className="fa-solid fa-book"></i> Subject</label>
                <div className="sub-select-wrap">
                  <select 
                    className="sub-select" 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)}
                    disabled={!cls || !section || loadingSubjects}
                  >
                    <option value="">
                      {loadingSubjects ? 'Loading subjects...' : 'Select Subject'}
                    </option>
                    {availableSubjects.map(s => (
                      <option key={s.subjectID} value={s.subjectName}>{s.subjectName}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down sub-select-arrow"></i>
                </div>
              </div>
              <Tooltip text="Load submissions for the selected filters">
                <button 
                  className="sub-fetch-btn" 
                  onClick={fetchData}
                  disabled={!cls || !section || !subject || loadingSubjects}
                >
                  <i className="fa-solid fa-magnifying-glass"></i> <span>View</span>
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {/* ── EMPTY STATE ── */}
      {role === 'teacher' && !fetched && (
        <div className="sub-empty-state">
          <div className="sub-empty-icon"><i className="fa-solid fa-paper-plane"></i></div>
          <div className="sub-empty-title">Select class, section &amp; subject</div>
          <div className="sub-empty-sub">Choose the filters above and click <strong>View</strong> to load submission data</div>
        </div>
      )}

      {/* ── ADMIN OVERVIEW PANEL ── */}
      {role === 'admin' && (
        <SubmissionsAdminPanel
          teachers={SUB_ADMIN_TEACHERS}
          classes={SUB_ADMIN_CLASSES}
          subjects={SUB_ADMIN_SUBJECTS}
          onReport={kind => setPdfReq({ type: kind })}
          toast={toast}
        />
      )}

     {/* The rest of your JSX remains unchanged... */}
       {/* ── MAIN AREA ── */}
      {role === 'teacher' && fetched && (
        <div>
          {/* Analytics strip — switches by inner tab */}
          {inner === 'lp' ? (
            <div className="sub-analytics-strip">
              {[
                { lbl:'Total Plans', val:lpTotal,     icon:'fa-list-ul',      color:'#1E40AF', bg:'rgba(30,64,175,.1)',  pct:100, barColor:'#1E40AF' },
                { lbl:'Submitted',   val:lpSubmitted, icon:'fa-circle-check', color:'#16A34A', bg:'rgba(22,163,74,.1)',  pct:lpPct, barColor:'#16A34A' },
                { lbl:'Remaining',   val:lpPending,   icon:'fa-clock',        color:'#D97706', bg:'rgba(217,119,6,.1)',  pct:lpTotal?Math.round(lpPending/lpTotal*100):0, barColor:'#D97706' },
                { lbl:'Completion',  val:`${lpPct}%`, icon:'fa-chart-pie',    color:'#7C3AED', bg:'rgba(124,58,237,.1)', pct:lpPct, barColor:'#7C3AED' },
              ].map((s, i) => (
                <div key={i} className="sub-stat-card">
                  <div className="sub-stat-icon" style={{ background: s.bg, color: s.color }}>
                    <i className={`fa-solid ${s.icon}`}></i>
                  </div>
                  <div className="sub-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="sub-stat-lbl">{s.lbl}</div>
                  <div className="sub-stat-prog">
                    <div className="sub-stat-prog-bar" style={{ width: `${s.pct}%`, background: s.barColor }}></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sub-analytics-strip">
              {[
                { lbl:'Total Items', val:nbTotal,     icon:'fa-circle-question', color:'#1E40AF', bg:'rgba(30,64,175,.1)',  pct:100, barColor:'#1E40AF', sub:`${nbUnits} units · ${nbQTypes} types` },
                { lbl:'Submitted',   val:nbSubmitted, icon:'fa-circle-check',    color:'#16A34A', bg:'rgba(22,163,74,.1)',  pct:nbPct, barColor:'#16A34A', sub:`${nbPct}% of all items` },
                { lbl:'Pending',     val:nbPending,   icon:'fa-clock',           color:'#D97706', bg:'rgba(217,119,6,.1)',  pct:nbTotal?Math.round(nbPending/nbTotal*100):0, barColor:'#D97706', sub:`across ${nbUnits} units` },
                { lbl:'Completion',  val:`${nbPct}%`, icon:'fa-chart-pie',       color:'#7C3AED', bg:'rgba(124,58,237,.1)', pct:nbPct, barColor:'#7C3AED', sub:`${nbSubmitted}/${nbTotal} items done` },
              ].map((s, i) => (
                <div key={i} className="sub-stat-card">
                  <div className="sub-stat-card-top">
                    <div className="sub-stat-icon" style={{ background: s.bg, color: s.color }}>
                      <i className={`fa-solid ${s.icon}`}></i>
                    </div>
                    <div className="sub-stat-sub-badge" style={{ color: s.color, background: s.bg }}>{s.sub}</div>
                  </div>
                  <div className="sub-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="sub-stat-lbl">{s.lbl}</div>
                  <div className="sub-stat-prog">
                    <div className="sub-stat-prog-bar" style={{ width: `${s.pct}%`, background: s.barColor }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inner tabs */}
          <div className="sub-inner-tabs">
            <Tooltip text={`Lesson Plan submissions (${lpTotal})`}>
              <button className={`sub-inner-tab${inner === 'lp' ? ' active' : ''}`} onClick={() => setInner('lp')}>
                <i className="fa-solid fa-list-ul"></i> <span>Lesson Plans</span>
                <span className="sub-inner-count">{lpTotal}</span>
              </button>
            </Tooltip>
            <Tooltip text={`Notebook Plan submissions (${nbTotal})`}>
              <button className={`sub-inner-tab${inner === 'nb' ? ' active' : ''}`} onClick={() => setInner('nb')}>
                <i className="fa-solid fa-book"></i> <span>Notebook Plans</span>
                <span className="sub-inner-count">{nbTotal}</span>
              </button>
            </Tooltip>
          </div>

          {/* ── LESSON PLANS PANEL ── */}
          {inner === 'lp' && (
            <div>
              <div className="sub-toolbar">
                <div className="sub-toolbar-left">
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <i className="fa-solid fa-list-ul" style={{ color: 'var(--brand-primary)', marginRight: 6 }}></i>Lesson Plans
                  </span>
                </div>
                <div className="sub-toolbar-right">
                  <Tooltip text="Generate PDF Report"><button className="sub-pdf-btn" onClick={() => setPdfReq({ type: 'lp' })}>
                    <i className="fa-solid fa-file-pdf"></i> PDF Report
                  </button></Tooltip>
                </div>
              </div>

              {lpGroups.map((g, ui) => {
                const total     = g.plans.length;
                const submitted = g.plans.filter(p => p.status === 'submitted').length;
                const pct       = Math.round((submitted / total) * 100);
                const isOpen    = lpUnitOpen[ui] !== false;
                const clr       = pct === 100 ? '#16A34A' : pct >= 60 ? '#1E40AF' : '#D97706';

                return (
                  <div key={ui} className={`sub-lp-unit-block${isOpen ? ' open' : ''}`}>
                    <div className="sub-lp-unit-header" onClick={() => setLpUnitOpen(o => ({ ...o, [ui]: !(o[ui] !== false) }))}>
                      <div className="sub-lp-unit-badge">Unit {g.unitNo}</div>
                      <div className="sub-lp-unit-info">
                        <div className="sub-lp-unit-name">{g.unit}</div>
                      </div>
                      <div className="sub-lp-unit-prog">
                        <div className="sub-lp-unit-pct" style={{ color: clr }}>{pct}%</div>
                        <div className="sub-lp-unit-bar">
                          <div className="sub-lp-unit-bar-fill" style={{ width: `${pct}%`, background: clr }}></div>
                        </div>
                      </div>
                      <div className="sub-lp-unit-chevron"><i className="fa-solid fa-chevron-down"></i></div>
                    </div>
                    {isOpen && (
                      <div className="sub-lp-unit-body">
                        {g.plans.map(p => {
                          const isSub = p.status === 'submitted';
                          return (
                            <div key={p.id} className={`sub-lp-card${isSub ? ' is-submitted' : ''}`}>
                              <div className="sub-lp-card-inner" style={{ gridTemplateColumns: '1fr auto' }}>
                                <div className="sub-lp-body" style={{ paddingLeft: 0 }}>
                                  <div className="sub-lp-num">{p.id}</div>
                                  <div className="sub-lp-info">
                                    <div className="sub-lp-title">{p.topic}</div>
                                    <div className="sub-lp-meta">
                                      <span className="sub-lp-meta-item sub-unit-badge"><i className="fa-solid fa-layer-group"></i>Unit {p.unitNo}</span>
                                      <span className="sub-lp-meta-item"><i className="fa-solid fa-calendar"></i>{p.date}</span>
                                      <span className="sub-lp-meta-item"><i className="fa-solid fa-bookmark"></i>{p.term}</span>
                                      {isSub && <span className="sub-lp-meta-item"><i className="fa-solid fa-clock-rotate-left"></i>Submitted: {p.submittedDate}{p.submittedTime ? ` · ${p.submittedTime}` : ''}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="sub-lp-actions">
                                  <span className={`sub-lp-status sub-lp-status--${isSub ? 'submitted' : 'pending'}`}>
                                    <i className={`fa-solid ${isSub ? 'fa-circle-check' : 'fa-clock'}`}></i>
                                    {isSub ? 'Submitted' : 'Pending'}
                                  </span>
                                  <Tooltip text="Open lesson plan details">
                                    <button className="sub-lp-view-btn" onClick={() => setViewerId(p.id)}>
                                      <i className="fa-solid fa-eye"></i> View
                                    </button>
                                  </Tooltip>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── NOTEBOOK PLANS PANEL ── */}
          {inner === 'nb' && (
            <div>
              <div className="sub-toolbar">
                <div className="sub-toolbar-left">
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <i className="fa-solid fa-layer-group" style={{ color: 'var(--brand-primary)', marginRight: 6 }}></i>Units &amp; Question Types
                  </span>
                </div>
                <div className="sub-toolbar-right">
                  <Tooltip text="Generate PDF Report"><button className="sub-pdf-btn" onClick={() => setPdfReq({ type: 'nb' })}>
                    <i className="fa-solid fa-file-pdf"></i> PDF Report
                  </button></Tooltip>
                </div>
              </div>

              {nbData.map(u => {
                const allItems = u.questionTypes.flatMap(qt => qt.items);
                const uTotal   = allItems.length;
                const uSub     = allItems.filter(i => i.status === 'submitted').length;
                const uPending = uTotal - uSub;
                const uPct     = uTotal ? Math.round((uSub / uTotal) * 100) : 0;
                const uColor   = uPct === 100 ? '#16A34A' : uPct >= 60 ? '#1E40AF' : '#D97706';
                const uIsOpen  = !!nbUnitOpen[u.unitId];
                const qCount   = u.questionTypes.length;

                return (
                  <div key={u.unitId} className={`snb-unit-block${uIsOpen ? ' open' : ''}`}>
                    <div className="snb-unit-hdr" onClick={() => setNbUnitOpen(o => ({ ...o, [u.unitId]: !o[u.unitId] }))}>
                      <div className="snb-unit-row1">
                        <div className="snb-unit-badge">Unit {u.unitNo}</div>
                        <div className="snb-unit-icon-wrap"><i className="fa-solid fa-book-open"></i></div>
                        <div className="snb-unit-name">{u.unitName}</div>
                        <div className="snb-unit-prog-wrap">
                          <div className="snb-unit-pct" style={{ color: uColor }}>{uPct}%</div>
                          <div className="snb-unit-bar">
                            <div className="snb-unit-bar-fill" style={{ width: `${uPct}%`, background: uColor }}></div>
                          </div>
                        </div>
                        <div className="snb-unit-right" onClick={e => e.stopPropagation()}>
                          <Tooltip text="PDF for this unit"><button className="sub-pdf-btn sub-pdf-btn--unit"
                            onClick={() => setPdfReq({ type: 'nb-unit', unitId: u.unitId })}>
                            <i className="fa-solid fa-file-pdf"></i> PDF
                          </button></Tooltip>
                        </div>
                        <div className="snb-unit-chevron"><i className="fa-solid fa-chevron-down"></i></div>
                      </div>
                      <div className="snb-unit-meta">
                        <span><i className="fa-solid fa-circle-question"></i> {qCount} question type{qCount !== 1 ? 's' : ''}</span>
                        <span className="snb-sep">·</span>
                        <span style={{ color: '#16A34A' }}><i className="fa-solid fa-circle-check"></i> {uSub} submitted</span>
                        <span className="snb-sep">·</span>
                        <span style={{ color: '#D97706' }}><i className="fa-solid fa-clock"></i> {uPending} pending</span>
                      </div>
                    </div>

                    {uIsOpen && (
                      <div className="snb-unit-body">
                        {u.questionTypes.map(qt => {
                          const meta = SUB_NB_QTYPE_META[qt.typeId] || { label: qt.typeId, icon: 'fa-circle-question', color: '#64748B' };
                          const total = qt.items.length;
                          const sub   = qt.items.filter(i => i.status === 'submitted').length;
                          const pend  = total - sub;
                          const pct   = total ? Math.round((sub / total) * 100) : 0;
                          const clr   = pct === 100 ? '#16A34A' : pct >= 60 ? '#1E40AF' : '#D97706';
                          const qKey  = `${u.unitId}__${qt.typeId}`;
                          const qIsOpen = !!nbQOpen[qKey];

                          return (
                            <div key={qKey} className={`snb-qtype-row${qIsOpen ? ' open' : ''}`}>
                              <div className="snb-qtype-hdr" onClick={() => setNbQOpen(o => ({ ...o, [qKey]: !o[qKey] }))}>
                                <div className="snb-qtype-connector"></div>
                                <div className="snb-qtype-row-a">
                                  <div className="snb-qtype-icon" style={{ background: meta.color }}>
                                    <i className={`fa-solid ${meta.icon}`}></i>
                                  </div>
                                  <div className="snb-qtype-label">{meta.label}</div>
                                  <div className="snb-qtype-badges">
                                    <Tooltip text="Submitted questions"><span className="snb-badge snb-badge--sub"><i className="fa-solid fa-circle-check"></i>{sub}</span></Tooltip>
                                    <Tooltip text="Pending questions"><span className="snb-badge snb-badge--pend"><i className="fa-solid fa-clock"></i>{pend}</span></Tooltip>
                                  </div>
                                  <div className="snb-qtype-prog-wrap">
                                    <div className="snb-qtype-pct" style={{ color: clr }}>{pct}%</div>
                                    <div className="snb-qtype-bar">
                                      <div className="snb-qtype-bar-fill" style={{ width: `${pct}%`, background: clr }}></div>
                                    </div>
                                  </div>
                                  {pend > 0 ? (
                                    <Tooltip text="Submit pending questions for this section">
                                      <button className="snb-qtype-submit-btn" onClick={e => { e.stopPropagation(); setNbSubmitCtx({ unitId: u.unitId, typeId: qt.typeId }); }}>
                                        <i className="fa-solid fa-paper-plane"></i> <span className="snb-submit-label">Submit</span>
                                      </button>
                                    </Tooltip>
                                  ) : (
                                    <span className="snb-done-badge">
                                      <i className="fa-solid fa-circle-check"></i> <span className="snb-submit-label">Done</span>
                                    </span>
                                  )}
                                  <div className="snb-qtype-chevron"><i className="fa-solid fa-chevron-down"></i></div>
                                </div>
                                <div className="snb-qtype-mq">{qt.mainQ}</div>
                              </div>

                              {qIsOpen && (
                                <div className="snb-items-panel">
                                  {qt.items.map((item, ii) => {
                                    const isSub = item.status === 'submitted';
                                    return (
                                      <div key={item.id} className={`sub-qitem${isSub ? ' is-submitted' : ''}`}>
                                        <div className="sub-qitem-body" style={{ paddingLeft: 4 }}>
                                          <div className="sub-qitem-num">{ii + 1}</div>
                                          <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="sub-qitem-text">{item.preview}</div>
                                          </div>
                                        </div>
                                        <div className="sub-qitem-actions">
                                          <span className={`sub-qitem-status sub-qitem-status--${isSub ? 'submitted' : 'pending'}`}>
                                            <i className={`fa-solid ${isSub ? 'fa-circle-check' : 'fa-clock'}`}></i>
                                            {isSub ? 'Submitted' : 'Pending'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
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
            </div>
          )}
        </div>
      )}

      {/* Modals remain the same */}
      <LpViewerModal
        plan={viewerId ? lpData.find(p => p.id === viewerId) : null}
        ctx={subCtx}
        toast={toast}
        onClose={() => setViewerId(null)}
        onSubmit={() => { submitLp(viewerId); }}
      />

      <NbSubmitModal
        ctx={nbSubmitCtx}
        unit={nbSubmitCtx ? nbData.find(u => u.unitId === nbSubmitCtx.unitId) : null}
        onClose={() => setNbSubmitCtx(null)}
        onSubmit={ids => submitNbItems(nbSubmitCtx.unitId, nbSubmitCtx.typeId, ids)}
      />

      <SubPdfModal
        req={pdfReq}
        unit={pdfReq?.type === 'nb-unit' && pdfReq.unitId ? nbData.find(u => u.unitId === pdfReq.unitId) : null}
        onClose={() => setPdfReq(null)}
        onGenerate={generatePdf}
      />
    </>
  );
}

/* ─── Lesson Plan Viewer Modal ─── */
function LpViewerModal({ plan, ctx = {}, toast = () => {}, onClose, onSubmit }) {
  const [detail, setDetail]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [suggestion, setSuggestion]   = useState('');
  const [suggestionId, setSuggestionId] = useState(0);
  const [savingSug, setSavingSug]     = useState(false);

  /* On open: load the lesson-plan detail (by master id) and its suggestion
     (by the detail id), so the viewer shows real saved data. */
  useEffect(() => {
    if (!plan) { setDetail(null); setSuggestion(''); setSuggestionId(0); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem('token') || '';
        const branchID = sessionStorage.getItem('branchID') || '';
        const auth = { Accept: '*/*', Authorization: `bearer ${token}` };
        const dres = await fetch(
          buildUrl(`/api/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${plan.id}&classID=${ctx.classID}&subjectID=${ctx.subjectID}&pageNo=1`),
          { method: 'GET', headers: auth },
        );
        const d = ((await dres.json())?.data || [])[0] || null;
        if (cancelled) return;
        setDetail(d);
        if (d?.id) {
          const sres = await fetch(
            buildUrl(`/api/getulpforclasssuggestion?BranchID=${branchID}&ClassID=${ctx.classID}&SubjectID=${ctx.subjectID}&DetailClassID=${d.id}&pageNo=1`),
            { method: 'GET', headers: auth },
          );
          const s = ((await sres.json())?.data || [])[0] || null;
          if (!cancelled) { setSuggestion(s?.suggestion || ''); setSuggestionId(s?.id || 0); }
        } else if (!cancelled) {
          setSuggestion(''); setSuggestionId(0);
        }
      } catch (e) {
        console.error('Error loading lesson plan view:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plan, ctx.classID, ctx.subjectID]);

  if (!plan) return null;
  const isSubmitted = plan.status === 'submitted';

  /* Saves the suggestion (insert/update) even when empty. Returns true on success. */
  const saveSuggestion = async ({ silent = false } = {}) => {
    if (!detail?.id) { if (!silent) toast('No lesson detail to attach the suggestion to', 'error'); return false; }
    setSavingSug(true);
    try {
      const result = await lpPost('/api/detailclasssuggestioncrud', {
        id: suggestionId || 0,
        branchID: sessionStorage.getItem('branchID') || '',
        classID: String(ctx.classID || ''),
        subjectID: String(ctx.subjectID || ''),
        suggestion,
        detailClassID: detail.id,
        action: suggestionId ? 'update' : 'insert',
      });
      if (result?.id) setSuggestionId(result.id);
      if (!silent) toast(suggestionId ? 'Suggestion updated' : 'Suggestion saved', 'success');
      return true;
    } catch (e) {
      console.error('Error saving suggestion:', e);
      if (!silent) toast('Could not save suggestion', 'error');
      return false;
    } finally {
      setSavingSug(false);
    }
  };

  /* HTML rich-text section, or a muted placeholder when empty. */
  const section = (icon, label, html) => (
    <div className="lp-viewer-section">
      <div className="lp-viewer-section-label"><i className={`fa-solid ${icon}`}></i>{label}</div>
      {html
        ? <div className="lp-viewer-section-value" dangerouslySetInnerHTML={{ __html: html }} />
        : <div className="lp-viewer-section-value" style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not provided</div>}
    </div>
  );

  return (
    <div className="lp-viewer-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lp-viewer-modal">
        <div className="lp-viewer-header">
          <div className="lp-viewer-header-icon"><i className="fa-solid fa-file-lines"></i></div>
          <div>
            <div className="lp-viewer-title">{plan.topic}</div>
            <div className="lp-viewer-sub">{plan.unit}{plan.unitNo ? ` · Unit ${plan.unitNo}` : ''}</div>
          </div>
          <Tooltip text="Close"><button className="lp-viewer-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="lp-viewer-body">
          <div className="lp-viewer-meta-grid">
            <div className="lp-viewer-meta-card">
              <div className="lp-viewer-meta-key"><i className="fa-solid fa-layer-group" style={{ marginRight: 4, color: 'var(--brand-primary)' }}></i>Unit</div>
              <div className="lp-viewer-meta-val">{plan.unit}</div>
            </div>
            <div className="lp-viewer-meta-card">
              <div className="lp-viewer-meta-key"><i className="fa-solid fa-stopwatch" style={{ marginRight: 4, color: 'var(--brand-primary)' }}></i>Duration</div>
              <div className="lp-viewer-meta-val">{detail?.timeDuration || '—'}</div>
            </div>
            <div className="lp-viewer-meta-card">
              <div className="lp-viewer-meta-key"><i className="fa-solid fa-hashtag" style={{ marginRight: 4, color: 'var(--brand-primary)' }}></i>Unit No.</div>
              <div className="lp-viewer-meta-val">{plan.unitNo || '—'}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading lesson plan…
            </div>
          ) : (
            <>
              {section('fa-bullseye',         'Student Learning Objective', detail?.learningObjective)}
              {section('fa-book-open',        'Lesson Introduction',        detail?.lessonIntroduction)}
              {section('fa-flask',            'Development / Main Teaching', detail?.development)}
              {section('fa-circle-check',     'Recap / Consolidation',      detail?.recap)}

              <div className="lp-viewer-section">
                <div className="lp-viewer-section-label"><i className="fa-solid fa-clock"></i>Time Allocation</div>
                <div className="lp-viewer-section-value">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      ['Learning Objective', detail?.timeForLearning],
                      ['Introduction',       detail?.timeForLesson],
                      ['Development',        detail?.timeForDevelopment],
                      ['Recap',              detail?.timeForRecap],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{k}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{v || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Editable suggestion */}
              <div className="lp-viewer-section">
                <div className="lp-viewer-section-label"><i className="fa-solid fa-comment-dots"></i>Suggestion</div>
                <textarea
                  className="form-input"
                  style={{ height: 'auto', minHeight: 90, padding: 12, resize: 'vertical', width: '100%' }}
                  value={suggestion}
                  onChange={e => setSuggestion(e.target.value)}
                  placeholder="Write a suggestion for this lesson plan…"
                />
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  <i className="fa-solid fa-circle-info" style={{ marginRight: 5 }}></i>
                  The suggestion is saved when you click <strong>Submit Lesson Plan</strong>.
                </div>
              </div>
            </>
          )}
        </div>

        <div className="lp-viewer-footer">
          <Tooltip text="Close the lesson plan viewer">
            <button className="lp-viewer-cancel-btn" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i> Close
            </button>
          </Tooltip>
          <Tooltip text={isSubmitted ? 'This lesson plan has already been submitted' : 'Save the suggestion and submit this lesson plan'}>
            <button
              className={`lp-viewer-submit-btn${isSubmitted ? ' done' : ''}`}
              disabled={isSubmitted || savingSug}
              onClick={async () => { await saveSuggestion({ silent: true }); onSubmit(); }}
            >
              {isSubmitted
                ? <><i className="fa-solid fa-circle-check"></i> Already Submitted</>
                : <><i className={`fa-solid ${savingSug ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i> Submit Lesson Plan</>}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ─── Notebook Submit Modal — select pending items + submit ─── */
function NbSubmitModal({ ctx, unit, onClose, onSubmit }) {
  const [checked, setChecked] = useState(new Set());

  useEffect(() => { setChecked(new Set()); }, [ctx]);

  if (!ctx || !unit) return null;
  const qt = unit.questionTypes.find(q => q.typeId === ctx.typeId);
  if (!qt) return null;
  const meta = SUB_NB_QTYPE_META[ctx.typeId] || { label: ctx.typeId, icon: 'fa-circle-question', color: '#64748B' };

  const pendingItems = qt.items.filter(i => i.status === 'pending');
  const allSelected  = pendingItems.length > 0 && pendingItems.every(i => checked.has(i.id));

  const toggleItem = id => {
    setChecked(c => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = on => {
    if (on) setChecked(new Set(pendingItems.map(i => i.id)));
    else    setChecked(new Set());
  };

  return (
    <div className="nb-submit-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nb-submit-modal">
        <div className="nb-submit-modal-header">
          <div className="nb-submit-modal-icon" style={{ background: meta.color }}>
            <i className={`fa-solid ${meta.icon}`}></i>
          </div>
          <div>
            <div className="nb-submit-modal-title">{meta.label}</div>
            <div className="nb-submit-modal-sub">{unit.unitName} · Unit {unit.unitNo}</div>
          </div>
          <Tooltip text="Close"><button className="nb-submit-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="nb-submit-modal-toolbar">
          <label className="nb-submit-select-all-label">
            <input type="checkbox" checked={allSelected} disabled={pendingItems.length === 0}
              onChange={e => toggleAll(e.target.checked)} />
            Select all pending
          </label>
          <span className="nb-submit-count-badge"><i className="fa-solid fa-check"></i> {checked.size} selected</span>
        </div>

        <div className="nb-submit-items-list">
          {qt.items.map((item, i) => {
            const isSub = item.status === 'submitted';
            const isChk = checked.has(item.id);
            return (
              <div
                key={item.id}
                className={`nb-submit-item${isChk ? ' is-checked' : ''}${isSub ? ' is-submitted' : ''}`}
                onClick={() => !isSub && toggleItem(item.id)}
              >
                <div className="nb-submit-item-num">{i + 1}</div>
                <div className="nb-submit-item-text">{item.preview}</div>
                {!isSub && (
                  <input type="checkbox" checked={isChk}
                    onClick={e => e.stopPropagation()}
                    onChange={() => toggleItem(item.id)}
                    style={{ width: 16, height: 16, accentColor: 'var(--brand-primary)', flexShrink: 0, cursor: 'pointer' }} />
                )}
                <span className={`nb-submit-item-status ${isSub ? 'submitted' : 'pending'}`}>
                  <i className={`fa-solid ${isSub ? 'fa-circle-check' : 'fa-clock'}`}></i> {isSub ? 'Submitted' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>

        <div className="nb-submit-modal-footer">
          <Tooltip text="Discard and close">
            <button className="nb-submit-modal-cancel-btn" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          </Tooltip>
          <Tooltip text={checked.size === 0 ? 'Select questions to submit first' : `Submit ${checked.size} question${checked.size === 1 ? '' : 's'}`}>
            <button className="nb-submit-modal-submit-btn"
              disabled={checked.size === 0}
              onClick={() => onSubmit([...checked])}>
              <i className="fa-solid fa-paper-plane"></i> Submit
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUBMISSION PDF — style picker modal + report builders
   verbatim from HTML (openSubPdfModal / subGeneratePdf / pdf* helpers)
   ═══════════════════════════════════════════════════════════════════ */
function SubPdfModal({ req, unit, onClose, onGenerate }) {
  const [style, setStyle] = useState('color');

  useEffect(() => { if (req) setStyle('color'); }, [req]);

  if (!req) return null;

  let scopeIcon  = 'fa-file-lines';
  let scopeTitle = 'Full Submission Report';
  let scopeDesc  = 'All units and lesson plans included';
  if (req.type === 'nb') {
    scopeIcon  = 'fa-book';
    scopeTitle = 'Full Notebook Plan Report';
    scopeDesc  = 'All units, question types and items included';
  }
  if (req.type === 'nb-unit' && unit) {
    const allItems = unit.questionTypes.flatMap(q => q.items);
    const sub      = allItems.filter(i => i.status === 'submitted').length;
    scopeIcon  = 'fa-layer-group';
    scopeTitle = `Unit ${unit.unitNo}: ${unit.unitName}`;
    scopeDesc  = `${unit.questionTypes.length} question types · ${allItems.length} items · ${sub} submitted`;
  }
  if (req.type === 'admin-teacher') {
    scopeIcon  = 'fa-chalkboard-user';
    scopeTitle = 'Teacher-wise Report';
    scopeDesc  = 'All teachers · LP & NB submission analytics';
  }
  if (req.type === 'admin-class') {
    scopeIcon  = 'fa-school';
    scopeTitle = 'Class-wise Report';
    scopeDesc  = 'All classes · subject-wise submission breakdown';
  }
  if (req.type === 'admin-subject') {
    scopeIcon  = 'fa-book-bookmark';
    scopeTitle = 'Subject-wise Report';
    scopeDesc  = 'All subjects · plans submitted across all classes';
  }

  return (
    <div className="sub-pdf-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sub-pdf-modal">

        <div className="sub-pdf-glow"></div>

        <div className="sub-pdf-header">
          <div className="sub-pdf-header-icon"><i className="fa-solid fa-file-pdf"></i></div>
          <div>
            <div className="sub-pdf-title">Generate PDF Report</div>
            <div className="sub-pdf-sub">Export a professional submission report</div>
          </div>
          <Tooltip text="Close"><button className="sub-pdf-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="sub-pdf-school-bar">
          <div className="sub-pdf-school-logo"><i className="fa-solid fa-graduation-cap"></i></div>
          <div>
            <div className="sub-pdf-school-name">School Mentor ERP</div>
            <div className="sub-pdf-school-tag">Academic Year 2025–2026</div>
          </div>
          <div className="sub-pdf-school-badge"><i className="fa-solid fa-shield-check"></i> Official Report</div>
        </div>

        <div className="sub-pdf-body">
          <div className="sub-pdf-section-lbl">Choose Report Style</div>
          <div className="sub-pdf-style-list">

            <div className={`sub-pdf-style-row${style === 'color' ? ' active' : ''}`} onClick={() => setStyle('color')}>
              <div className="sub-pdf-thumb sub-pdf-thumb--color">
                <div className="pdf-thumb-hdr"></div>
                <div className="pdf-thumb-body">
                  <div className="pdf-thumb-row"></div>
                  <div className="pdf-thumb-row"></div>
                  <div className="pdf-thumb-row"></div>
                  <div className="pdf-thumb-bar"></div>
                  <div className="pdf-thumb-tag"></div>
                </div>
              </div>
              <div className="sub-pdf-style-info">
                <div className="sub-pdf-style-name">Colorful Report</div>
                <div className="sub-pdf-style-hint">Full color · branded headings · color-coded status tags · progress bars</div>
              </div>
              <div className="sub-pdf-radio"></div>
            </div>

            <div className={`sub-pdf-style-row${style === 'bw' ? ' active' : ''}`} onClick={() => setStyle('bw')}>
              <div className="sub-pdf-thumb sub-pdf-thumb--bw">
                <div className="pdf-thumb-hdr"></div>
                <div className="pdf-thumb-body">
                  <div className="pdf-thumb-row"></div>
                  <div className="pdf-thumb-row"></div>
                  <div className="pdf-thumb-row"></div>
                  <div className="pdf-thumb-bar"></div>
                  <div className="pdf-thumb-tag"></div>
                </div>
              </div>
              <div className="sub-pdf-style-info">
                <div className="sub-pdf-style-name">Colorless Report</div>
                <div className="sub-pdf-style-hint">Low-ink layout · white background · light borders only · printer-friendly</div>
              </div>
              <div className="sub-pdf-radio"></div>
            </div>
          </div>

          <div className="sub-pdf-scope-card">
            <div className="sub-pdf-scope-icon"><i className={`fa-solid ${scopeIcon}`}></i></div>
            <div>
              <div className="sub-pdf-scope-title">{scopeTitle}</div>
              <div className="sub-pdf-scope-desc">{scopeDesc}</div>
            </div>
          </div>
        </div>

        <div className="sub-pdf-footer">
          <Tooltip text="Cancel and close">
            <button className="sub-pdf-cancel-btn" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i> Cancel
            </button>
          </Tooltip>
          <Tooltip text="Generate and download the PDF report">
            <button className="sub-pdf-gen-btn" onClick={() => onGenerate(style === 'color')}>
              <i className="fa-solid fa-file-pdf"></i> Generate PDF
            </button>
          </Tooltip>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUBMISSIONS ADMIN PANEL — verbatim from HTML subRenderAdminGrid
   ═══════════════════════════════════════════════════════════════════ */
function SubmissionsAdminPanel({ teachers, classes, subjects, onReport, toast }) {
  const totalPlans = teachers.reduce((a, t) => a + t.lp.total, 0);
  const totalSub   = teachers.reduce((a, t) => a + t.lp.submitted, 0);
  const overallPct = Math.round((totalSub / totalPlans) * 100);

  return (
    <div className="sub-admin-grid">
      {/* Stats strip */}
      <div style={{ gridColumn: '1/-1' }}>
        <div className="sub-analytics-strip" style={{ marginBottom: 16 }}>
          {[
            { lbl:'Active Teachers',     val:teachers.length, color:'#1E40AF', bg:'rgba(30,64,175,.1)',  icon:'fa-users',        pct:100 },
            { lbl:'Plans Submitted',     val:totalSub,        color:'#16A34A', bg:'rgba(22,163,74,.1)',  icon:'fa-circle-check', pct:overallPct },
            { lbl:'Plans Pending',       val:totalPlans - totalSub, color:'#D97706', bg:'rgba(217,119,6,.1)', icon:'fa-clock',  pct:100 - overallPct },
            { lbl:'Overall Completion',  val:`${overallPct}%`,color:'#7C3AED', bg:'rgba(124,58,237,.1)', icon:'fa-chart-pie',    pct:overallPct },
          ].map((s, i) => (
            <div key={i} className="sub-stat-card">
              <div className="sub-stat-icon" style={{ background: s.bg, color: s.color }}>
                <i className={`fa-solid ${s.icon}`}></i>
              </div>
              <div className="sub-stat-val" style={{ color: s.color }}>{s.val}</div>
              <div className="sub-stat-lbl">{s.lbl}</div>
              <div className="sub-stat-prog">
                <div className="sub-stat-prog-bar" style={{ width: `${s.pct}%`, background: s.color }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Teacher-wise card */}
      <div className="sub-admin-card">
        <div className="sub-admin-card-hdr">
          <div className="sub-admin-card-icon"><i className="fa-solid fa-chalkboard-user"></i></div>
          <div style={{ flex: 1 }}>
            <div className="sub-admin-card-title">Teacher-wise Progress</div>
            <div className="sub-admin-card-sub">Lesson plan submission by teacher</div>
          </div>
          <Tooltip text="Export Teacher Report"><button className="sub-pdf-btn sub-pdf-btn--admin" onClick={() => onReport('admin-teacher')}>
            <i className="fa-solid fa-file-pdf"></i> PDF
          </button></Tooltip>
        </div>
        <div className="sub-admin-scroll">
          {teachers.map((t, i) => {
            const lpPct = Math.round((t.lp.submitted / t.lp.total) * 100);
            const color = lpPct === 100 ? '#16A34A' : lpPct >= 60 ? '#1E40AF' : '#D97706';
            const initials = t.name.split(' ').map(w => w[0]).join('').slice(0, 2);
            return (
              <div key={t.name} className="sub-admin-teacher-row"
                onClick={() => toast(`${t.name} — ${t.lp.submitted}/${t.lp.total} LP | ${t.nb.submitted}/${t.nb.total} NB`, 'info')}>
                <div className="sub-admin-teacher-avatar">{initials}</div>
                <div className="sub-admin-teacher-info">
                  <div className="sub-admin-teacher-name">{t.name}</div>
                  <div className="sub-admin-teacher-sub">{t.subject} · {t.class}</div>
                </div>
                <div className="sub-admin-teacher-prog">
                  <div className="sub-admin-teacher-pct" style={{ color }}>{lpPct}%</div>
                  <div className="sub-admin-prog">
                    <div className="sub-admin-prog-fill" style={{ width: `${lpPct}%`, background: color }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Class-wise card */}
      <div className="sub-admin-card">
        <div className="sub-admin-card-hdr">
          <div className="sub-admin-card-icon"><i className="fa-solid fa-school"></i></div>
          <div style={{ flex: 1 }}>
            <div className="sub-admin-card-title">Class-wise Progress</div>
            <div className="sub-admin-card-sub">Submission status per class</div>
          </div>
          <Tooltip text="Export Class Report"><button className="sub-pdf-btn sub-pdf-btn--admin" onClick={() => onReport('admin-class')}>
            <i className="fa-solid fa-file-pdf"></i> PDF
          </button></Tooltip>
        </div>
        <div className="sub-admin-scroll">
          {classes.map(c => {
            const pct = Math.round((c.lpSub / c.lp) * 100);
            const clr = pct === 100 ? '#16A34A' : pct >= 60 ? '#1E40AF' : '#D97706';
            return (
              <div key={c.cls} className="sub-admin-teacher-row">
                <div className="sub-admin-teacher-avatar" style={{ background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', borderRadius: 9 }}>
                  <i className="fa-solid fa-school" style={{ fontSize: 13, color: '#1E40AF' }}></i>
                </div>
                <div className="sub-admin-teacher-info">
                  <div className="sub-admin-teacher-name">{c.cls}</div>
                  <div className="sub-admin-teacher-sub">{c.subj} · {c.lpSub}/{c.lp} submitted</div>
                </div>
                <div className="sub-admin-teacher-prog">
                  <div className="sub-admin-teacher-pct" style={{ color: clr }}>{pct}%</div>
                  <div className="sub-admin-prog">
                    <div className="sub-admin-prog-fill" style={{ width: `${pct}%`, background: clr }}></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Subject-wise card (full-width) */}
      <div className="sub-admin-card" style={{ gridColumn: '1/-1' }}>
        <div className="sub-admin-card-hdr">
          <div className="sub-admin-card-icon"><i className="fa-solid fa-book"></i></div>
          <div style={{ flex: 1 }}>
            <div className="sub-admin-card-title">Subject-wise Progress</div>
            <div className="sub-admin-card-sub">Total lesson plans submitted per subject across all classes</div>
          </div>
          <Tooltip text="Export Subject Report"><button className="sub-pdf-btn sub-pdf-btn--admin" onClick={() => onReport('admin-subject')}>
            <i className="fa-solid fa-file-pdf"></i> PDF
          </button></Tooltip>
        </div>
        <div className="sub-admin-scroll sub-admin-scroll--horiz" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 'max-content' }}>
            {subjects.map(s => {
              const pct = Math.round((s.submitted / s.total) * 100);
              const clr = pct === 100 ? '#16A34A' : pct >= 60 ? '#1E40AF' : '#D97706';
              const bg  = pct === 100 ? 'rgba(22,163,74,.08)' : pct >= 60 ? 'rgba(30,64,175,.07)' : 'rgba(217,119,6,.07)';
              return (
                <div key={s.subj} className="subj-scroll-card">
                  <div className="subj-scroll-icon"><i className="fa-solid fa-book" style={{ fontSize: 14, color: '#1E40AF' }}></i></div>
                  <div className="subj-scroll-name">{s.subj}</div>
                  <div className="subj-scroll-counts">{s.submitted}/{s.total} plans</div>
                  <div className="subj-scroll-pct" style={{ color: clr }}>{pct}%</div>
                  <div className="subj-scroll-bar-track">
                    <div className="subj-scroll-bar-fill" style={{ width: `${pct}%`, background: clr }}></div>
                  </div>
                  <div className="subj-scroll-status" style={{ color: clr, background: bg }}>
                    {pct === 100
                      ? <><i className="fa-solid fa-circle-check"></i> Complete</>
                      : pct >= 60
                        ? <><i className="fa-solid fa-chart-line"></i> On Track</>
                        : <><i className="fa-solid fa-clock"></i> In Progress</>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Submission PDF builders — verbatim from HTML subGeneratePdf chain ─── */
/* Two palettes:
   • Colorful: brand-blue header gradient, blue-tinted card/row fills.
   • Colorless: dedicated LOW-INK layout — white header (no gradient), no
     row alt fill, no card-bg fill, light gray borders. Optimised for
     printing on cheap printers / monochrome lasers. */
function _subPdfPalette(isColor) {
  return {
    brand:   isColor ? '#1E3A8A'  : '#111111',
    accent:  isColor ? '#2563EB'  : '#374151',
    green:   isColor ? '#16A34A'  : '#374151',
    amber:   isColor ? '#D97706'  : '#4B5563',
    purple:  isColor ? '#7C3AED'  : '#374151',
    text:    '#0F172A',
    muted:   isColor ? '#64748B'  : '#4B5563',
    border:  isColor ? '#BFDBFE'  : '#D1D5DB',
    rowAlt:  isColor ? '#F0F6FF'  : '#FFFFFF', // no zebra striping in colorless
    tHead:   isColor ? '#EFF6FF'  : '#FFFFFF', // table heads stay white in colorless
    cardBg:  isColor ? '#F0F6FF'  : '#FFFFFF', // summary cards stay white in colorless
    hdrBg:   isColor ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : '#FFFFFF',
    hdrFg:   isColor ? '#FFFFFF'  : '#111111',
    hdrSub:  isColor ? 'rgba(255,255,255,.78)' : '#4B5563',
    hdrDiv:  isColor ? 'rgba(255,255,255,.22)' : '#E5E7EB',
    chipBg:  isColor ? 'rgba(255,255,255,.14)' : 'transparent',
    chipBd:  isColor ? 'transparent' : '#D1D5DB',
    chipFg:  isColor ? '#FFFFFF'  : '#111111',
    isColor,
  };
}

function _subPdfBase(C, title) {
  /* A4-portrait safe base.
     Key rules:
     - @page reserves a 15mm margin so the printer leaves a uniform gutter.
     - .page-wrap NEVER exceeds the printable area (~180mm).
       In print it stretches to 100% of the printable area; on screen it caps
       at 210mm but uses 15mm side padding so the preview matches the print.
     - All tables are table-layout:fixed so column widths obey % rules
       and never push the page wider than A4.
     - long text in cells wraps with overflow-wrap:anywhere so a 10–11 col
       table (Teacher-wise, Class-wise) stays inside the page. */
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;width:100%;overflow-x:hidden}
body{font-family:'Segoe UI',Arial,sans-serif;color:#0F172A;font-size:12px;line-height:1.5;padding:0}

@page{size:A4 portrait;margin:15mm}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  html,body{width:auto;}
  .no-print{display:none!important}
  .page-wrap{max-width:none!important;width:100%!important;padding:0!important;margin:0!important}
}
.page,.page-wrap{
  width:100%;max-width:210mm;margin:0 auto;
  padding:14mm 15mm 18mm;
  box-sizing:border-box;
  overflow:hidden;
}

/* Header: gradient blue + white text in Colorful, white + dark gray in
   Colorless. The strip / logo / divider colors switch with the palette
   so the colorless variant is genuinely low-ink (no large fills). */
.doc-header{background:${C.hdrBg};color:${C.isColor ? '#fff' : C.text};padding:0;border-radius:0 0 16px 16px;margin-bottom:18px;overflow:hidden;page-break-inside:avoid;width:100%;${C.isColor ? '' : `border:1px solid ${C.border};border-top:none;`}}
.doc-header-top{display:flex;align-items:center;gap:14px;padding:18px 22px 14px;flex-wrap:wrap}
.doc-logo{width:48px;height:48px;border-radius:12px;background:${C.isColor ? 'rgba(255,255,255,.18)' : '#FFFFFF'};display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;border:1.5px solid ${C.isColor ? 'rgba(255,255,255,.25)' : C.border};color:${C.isColor ? '#fff' : C.text}}
.doc-school{font-size:17px;font-weight:800;letter-spacing:-.3px;line-height:1.1;color:${C.isColor ? '#fff' : C.text}}
.doc-year{font-size:10.5px;${C.isColor ? 'opacity:.7' : `color:${C.muted}`};margin-top:2px}
.doc-report-name{font-size:12.5px;font-weight:700;${C.isColor ? 'opacity:.9' : `color:${C.text}`};margin-top:4px}
.doc-meta-bar{display:flex;flex-wrap:wrap;gap:0;background:${C.isColor ? 'rgba(0,0,0,.15)' : '#F8FAFC'};border-top:1px solid ${C.isColor ? 'rgba(255,255,255,.1)' : C.border}}
.doc-meta-cell{flex:1;min-width:0;padding:8px 14px;border-right:1px solid ${C.isColor ? 'rgba(255,255,255,.1)' : C.border};font-size:10.5px;overflow-wrap:anywhere;color:${C.isColor ? '#fff' : C.text}}
.doc-meta-cell:last-child{border-right:none}
.doc-meta-key{${C.isColor ? 'opacity:.65' : `color:${C.muted}`};font-weight:600;margin-bottom:2px;letter-spacing:.3px;text-transform:uppercase;font-size:9px}
.doc-meta-val{font-weight:700;font-size:11.5px;overflow-wrap:anywhere;color:${C.isColor ? '#fff' : C.text}}

.stat-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:16px}
.stat-card{border-radius:12px;padding:11px 13px;border:1.5px solid ${C.border};background:${C.cardBg};page-break-inside:avoid;min-width:0;overflow:hidden}
.stat-val{font-size:20px;font-weight:900;line-height:1;margin-bottom:3px}
.stat-lbl{font-size:9.5px;color:${C.muted};font-weight:600;text-transform:uppercase;letter-spacing:.3px;overflow-wrap:anywhere}
.stat-bar{height:4px;border-radius:99px;background:${C.isColor ? 'rgba(30,58,138,.12)' : '#DDD'};margin-top:8px;overflow:hidden}
.stat-bar-fill{height:100%;border-radius:99px}

.sec-title{font-size:12px;font-weight:800;color:${C.brand};margin:16px 0 8px;padding:7px 12px;background:${C.tHead};border-radius:7px;border-left:4px solid ${C.isColor ? '#2563EB' : '#333'};page-break-after:avoid}

table{
  width:100%;table-layout:fixed;border-collapse:collapse;
  margin-bottom:14px;font-size:10.5px;page-break-inside:auto;
  word-wrap:break-word;
}
thead{background:${C.tHead};display:table-header-group}
tr{page-break-inside:avoid}
th{padding:6px 7px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:${C.brand};border-bottom:2px solid ${C.border};overflow-wrap:anywhere}
td{padding:6px 7px;border-bottom:1px solid ${C.border};vertical-align:middle;overflow-wrap:anywhere;word-break:break-word}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:${C.rowAlt}}
.unit-row td{background:${C.tHead} !important;font-weight:700;font-size:11px;color:${C.brand};padding:7px 10px}

.tag{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:99px;font-size:9.5px;font-weight:700;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.tag-sub{background:${C.isColor ? 'rgba(22,163,74,.1)' : '#E8E8E8'};color:${C.green};border:1px solid ${C.isColor ? 'rgba(22,163,74,.2)' : '#CCC'}}
.tag-pend{background:${C.isColor ? 'rgba(217,119,6,.1)' : '#EBEBEB'};color:${C.amber};border:1px solid ${C.isColor ? 'rgba(217,119,6,.2)' : '#CCC'}}
.tag-na{background:${C.isColor ? 'rgba(30,58,138,.08)' : '#EBEBEB'};color:${C.brand};border:1px solid ${C.border}}

.pbar-outer{display:inline-flex;align-items:center;gap:5px;max-width:100%}
.pbar-track{width:54px;max-width:100%;height:5px;border-radius:99px;background:${C.isColor ? 'rgba(30,58,138,.1)' : '#E0E0E0'};overflow:hidden;display:inline-block;vertical-align:middle;flex-shrink:1}
.pbar-fill{height:100%;border-radius:99px}
.pbar-pct{font-weight:800;font-size:10px;min-width:28px}

.doc-footer{margin-top:20px;padding-top:10px;border-top:1.5px solid ${C.border};display:flex;justify-content:space-between;align-items:center;font-size:10px;color:${C.muted};flex-wrap:wrap;gap:6px}
.doc-footer-logo{font-weight:800;color:${C.brand};font-size:10.5px}

.print-bar{text-align:center;padding:16px;background:${C.isColor ? '#F8FAFC' : '#FFFFFF'};border-top:1px solid #E2E8F0;margin-top:14px;border-radius:10px}
/* Print button: brand-blue fill in Colorful; bordered outline in Colorless. */
.print-bar button{${C.isColor ? `background:${C.brand};color:#fff;border:none;` : `background:#FFFFFF;color:${C.text};border:1.5px solid ${C.text};`}padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;margin-right:8px}
.print-bar .close-btn{background:transparent;border:1.5px solid #CBD5E1;color:#64748B}
</style></head><body><div class="page-wrap">`;
}

function _subPdfHeader(C, reportName, metaCells, today) {
  const cells = metaCells.map(m => `<div class="doc-meta-cell"><div class="doc-meta-key">${m.k}</div><div class="doc-meta-val">${m.v}</div></div>`).join('');
  return `<div class="doc-header">
    <div class="doc-header-top">
      <div class="doc-logo">🎓</div>
      <div>
        <div class="doc-school">School Mentor ERP</div>
        <div class="doc-year">Academic Year 2025–2026</div>
        <div class="doc-report-name">${reportName}</div>
      </div>
    </div>
    <div class="doc-meta-bar">${cells}<div class="doc-meta-cell"><div class="doc-meta-key">Generated</div><div class="doc-meta-val">${today}</div></div></div>
  </div>`;
}

function _subPdfStatStrip(stats) {
  return `<div class="stat-strip">${stats.map(s => `
    <div class="stat-card">
      <div class="stat-val" style="color:${s.color}">${s.val}</div>
      <div class="stat-lbl">${s.lbl}</div>
      <div class="stat-bar"><div class="stat-bar-fill" style="width:${s.pct}%;background:${s.color}"></div></div>
    </div>`).join('')}</div>`;
}

function _subPdfPbar(C, pct) {
  const color = pct === 100 ? C.green : pct >= 60 ? C.accent : C.amber;
  return `<span class="pbar-outer">
    <span class="pbar-track"><span class="pbar-fill" style="width:${pct}%;background:${color}"></span></span>
    <span class="pbar-pct" style="color:${color}">${pct}%</span>
  </span>`;
}

function _subPdfFooter(C) {
  const stamp = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return `<div class="doc-footer">
    <span class="doc-footer-logo">🎓 School Mentor ERP — Academics</span>
    <span>Generated: ${stamp}</span>
  </div>
  <div class="print-bar no-print">
    <button onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="close-btn" onclick="window.close()">Close</button>
  </div>
  </div></body></html>`;
}

/* Format submitted timestamp as "12 May 2026 — 10:45 AM".
   If only date exists, synthesise a deterministic time so reports never show "—". */
function _subFmtSubmitted(it, fallbackSeed) {
  if (!it || it.status !== 'submitted') return '—';
  const date = it.submittedDate || '';
  if (!date) return '—';
  let time = it.submittedTime;
  if (!time) {
    /* Deterministic synthetic time: 8:00 AM .. 3:59 PM, varies by seed */
    const n  = Math.abs(_subHash(String(fallbackSeed || it.id || date))) % (8 * 60);
    const h  = 8 + Math.floor(n / 60);
    const m  = n % 60;
    const am = h < 12 ? 'AM' : 'PM';
    const hh = h > 12 ? h - 12 : h;
    time = `${hh}:${String(m).padStart(2, '0')} ${am}`;
  }
  return `${date} — ${time}`;
}

function _subHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h;
}

function _openSubPdfWindow(html) {
  const w = window.open('', '_blank', 'width=1000,height=820');
  if (w) { w.document.write(html); w.document.close(); }
}

/* 1. Lesson Plan submission report */
function buildLpSubReport(ctx, isColor) {
  const C     = _subPdfPalette(isColor);
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const data  = ctx.lpData || [];
  const total = data.length;
  const sub   = data.filter(p => p.status === 'submitted').length;
  const pend  = total - sub;
  const pct   = total ? Math.round(sub / total * 100) : 0;

  const unitMap = {}, unitOrder = [];
  data.forEach(p => {
    if (!unitMap[p.unit]) { unitMap[p.unit] = []; unitOrder.push(p.unit); }
    unitMap[p.unit].push(p);
  });

  let html = _subPdfBase(C, 'Lesson Plan Submission Report');
  html += _subPdfHeader(C, 'Lesson Plan Submission Report', [
    { k:'Teacher', v:'Ms. Fatima Noor' },
    { k:'Class',   v:(ctx.cls || '—').replace('-', ' ') },
    { k:'Section', v:`Section ${ctx.section || '—'}` },
    { k:'Subject', v:ctx.subject || '—' },
    { k:'Session', v:'2025–2026' },
  ], today);

  html += _subPdfStatStrip([
    { lbl:'Total Plans', val:total,        color:C.brand,  pct:100 },
    { lbl:'Submitted',   val:sub,          color:C.green,  pct },
    { lbl:'Pending',     val:pend,         color:C.amber,  pct:total ? Math.round(pend / total * 100) : 0 },
    { lbl:'Completion',  val:`${pct}%`,    color:C.purple, pct },
  ]);

  html += `<div class="sec-title">Unit-wise Summary</div>
  <table><thead><tr>
    <th>Unit</th><th style="text-align:center">Total</th><th style="text-align:center">Submitted</th>
    <th style="text-align:center">Pending</th><th>Progress</th><th>Status</th>
  </tr></thead><tbody>`;
  unitOrder.forEach(unitName => {
    const plans = unitMap[unitName];
    const t  = plans.length;
    const s  = plans.filter(p => p.status === 'submitted').length;
    const pe = t - s;
    const p  = Math.round(s / t * 100);
    html += `<tr>
      <td><strong>${unitName}</strong></td>
      <td style="text-align:center">${t}</td>
      <td style="text-align:center"><span class="tag tag-sub">✓ ${s}</span></td>
      <td style="text-align:center"><span class="tag ${pe > 0 ? 'tag-pend' : 'tag-sub'}">${pe > 0 ? '⏱ ' + pe : 'All done'}</span></td>
      <td>${_subPdfPbar(C, p)}</td>
      <td><span class="tag ${p === 100 ? 'tag-sub' : 'tag-pend'}">${p === 100 ? '✓ Complete' : 'In Progress'}</span></td>
    </tr>`;
  });
  html += `<tr class="unit-row">
    <td>Overall Total</td>
    <td style="text-align:center">${total}</td>
    <td style="text-align:center"><strong style="color:${C.green}">${sub}</strong></td>
    <td style="text-align:center"><strong style="color:${C.amber}">${pend}</strong></td>
    <td colspan="2">${_subPdfPbar(C, pct)}</td>
  </tr></tbody></table>`;

  html += `<div class="sec-title">Lesson Plan Details</div>
  <table><thead><tr>
    <th>#</th><th>Unit</th><th>Lesson Topic</th><th>Date</th><th>Term</th><th>Status</th><th>Submitted On</th>
  </tr></thead><tbody>`;
  data.forEach((p, i) => {
    const isSub = p.status === 'submitted';
    html += `<tr>
      <td style="color:${C.muted};font-weight:700">${i + 1}</td>
      <td><span class="tag tag-na">Unit ${p.unitNo}</span></td>
      <td><strong>${p.topic}</strong></td>
      <td style="color:${C.muted}">${p.date}</td>
      <td style="color:${C.muted}">${p.term}</td>
      <td><span class="tag ${isSub ? 'tag-sub' : 'tag-pend'}">${isSub ? '✓ Submitted' : '⏱ Pending'}</span></td>
      <td style="color:${C.muted}">${isSub ? _subFmtSubmitted(p, `lp-${p.id}`) : '—'}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
  html += _subPdfFooter(C);

  _openSubPdfWindow(html);
}

/* 2. Notebook Plan submission report — full */
function buildNbSubReport(ctx, isColor) {
  const C     = _subPdfPalette(isColor);
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const data  = ctx.nbData || [];
  const all   = data.flatMap(u => u.questionTypes.flatMap(q => q.items));
  const total = all.length;
  const sub   = all.filter(i => i.status === 'submitted').length;
  const pend  = total - sub;
  const pct   = total ? Math.round(sub / total * 100) : 0;

  let html = _subPdfBase(C, 'Notebook Plan Submission Report');
  html += _subPdfHeader(C, 'Notebook Plan Submission Report', [
    { k:'Teacher', v:'Ms. Fatima Noor' },
    { k:'Class',   v:(ctx.cls || '—').replace('-', ' ') },
    { k:'Section', v:`Section ${ctx.section || '—'}` },
    { k:'Subject', v:ctx.subject || '—' },
    { k:'Units',   v:data.length },
  ], today);

  html += _subPdfStatStrip([
    { lbl:'Total Items', val:total,     color:C.brand,  pct:100 },
    { lbl:'Submitted',   val:sub,       color:C.green,  pct },
    { lbl:'Pending',     val:pend,      color:C.amber,  pct:total ? Math.round(pend / total * 100) : 0 },
    { lbl:'Completion',  val:`${pct}%`, color:C.purple, pct },
  ]);

  html += `<div class="sec-title">Complete Unit &amp; Question Type Breakdown</div>
  <table><thead><tr>
    <th>Unit</th><th>Question Type</th><th style="text-align:center">Generated</th>
    <th style="text-align:center">Submitted</th><th style="text-align:center">Pending</th><th>Progress</th>
  </tr></thead><tbody>`;

  data.forEach(unit => {
    const uAll = unit.questionTypes.flatMap(q => q.items);
    const ut   = uAll.length;
    const us   = uAll.filter(i => i.status === 'submitted').length;
    const uPct = ut ? Math.round(us / ut * 100) : 0;
    html += `<tr class="unit-row">
      <td colspan="5"><strong>Unit ${unit.unitNo}: ${unit.unitName}</strong></td>
      <td>${_subPdfPbar(C, uPct)}</td>
    </tr>`;
    unit.questionTypes.forEach(qt => {
      const meta = SUB_NB_QTYPE_META[qt.typeId] || { label: qt.typeId };
      const t  = qt.items.length;
      const s  = qt.items.filter(i => i.status === 'submitted').length;
      const pe = t - s;
      const p  = t ? Math.round(s / t * 100) : 0;
      html += `<tr>
        <td style="padding-left:18px;color:${C.muted}">Unit ${unit.unitNo}</td>
        <td><strong>${meta.label}</strong><div style="font-size:10.5px;color:${C.muted};margin-top:2px">${qt.mainQ}</div></td>
        <td style="text-align:center;font-weight:700">${t}</td>
        <td style="text-align:center"><span class="tag tag-sub">✓ ${s}</span></td>
        <td style="text-align:center"><span class="tag ${pe > 0 ? 'tag-pend' : 'tag-sub'}">${pe > 0 ? '⏱ ' + pe : 'Done'}</span></td>
        <td>${_subPdfPbar(C, p)}</td>
      </tr>`;
    });
  });
  html += `<tr class="unit-row">
    <td colspan="2">Overall Total</td>
    <td style="text-align:center"><strong>${total}</strong></td>
    <td style="text-align:center"><strong style="color:${C.green}">${sub}</strong></td>
    <td style="text-align:center"><strong style="color:${C.amber}">${pend}</strong></td>
    <td>${_subPdfPbar(C, pct)}</td>
  </tr></tbody></table>`;

  /* Item-level details with submitted-time stamp */
  html += `<div class="sec-title">Item-level Details</div>`;
  data.forEach(unit => {
    html += `<div style="margin:14px 0 6px;font-size:12.5px;font-weight:800;color:${C.brand};text-transform:uppercase;letter-spacing:.4px">Unit ${unit.unitNo} — ${unit.unitName}</div>`;
    unit.questionTypes.forEach(qt => {
      const meta = SUB_NB_QTYPE_META[qt.typeId] || { label: qt.typeId };
      const subN = qt.items.filter(i => i.status === 'submitted').length;
      html += `<div style="margin-bottom:4px;font-size:11px;font-weight:800;color:${C.brand};letter-spacing:.4px">${meta.label} — ${subN}/${qt.items.length} submitted</div>
      <table style="margin-bottom:12px"><thead><tr>
        <th style="width:36px">#</th><th>Item</th><th style="width:170px">Submitted On</th><th style="width:110px">Status</th>
      </tr></thead><tbody>`;
      qt.items.forEach((item, i) => {
        const isSub = item.status === 'submitted';
        html += `<tr>
          <td style="color:${C.muted};font-weight:700">${i + 1}</td>
          <td>${item.preview}</td>
          <td style="color:${C.muted};font-size:11.5px">${isSub ? _subFmtSubmitted(item, `${unit.unitId}-${qt.typeId}-${item.id}`) : '—'}</td>
          <td><span class="tag ${isSub ? 'tag-sub' : 'tag-pend'}">${isSub ? '✓ Submitted' : '⏱ Pending'}</span></td>
        </tr>`;
      });
      html += `</tbody></table>`;
    });
  });

  html += _subPdfFooter(C);
  _openSubPdfWindow(html);
}

/* 3. Notebook Plan submission report — single unit */
function buildNbSubUnitReport(ctx, unitId, isColor) {
  const C     = _subPdfPalette(isColor);
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const unit  = (ctx.nbData || []).find(u => u.unitId === unitId);
  if (!unit) {
    _openSubPdfWindow(`<!doctype html><html><body><p style="font-family:sans-serif;padding:40px">Unit not found.</p></body></html>`);
    return;
  }
  const all   = unit.questionTypes.flatMap(q => q.items);
  const total = all.length;
  const sub   = all.filter(i => i.status === 'submitted').length;
  const pend  = total - sub;
  const pct   = total ? Math.round(sub / total * 100) : 0;

  let html = _subPdfBase(C, `Unit Report — ${unit.unitName}`);
  html += _subPdfHeader(C, `Notebook Plan Report — Unit ${unit.unitNo}: ${unit.unitName}`, [
    { k:'Unit No',     v:unit.unitNo },
    { k:'Unit Name',   v:unit.unitName },
    { k:'Q. Types',    v:unit.questionTypes.length },
    { k:'Total Items', v:total },
    { k:'Submitted',   v:sub },
  ], today);

  html += _subPdfStatStrip([
    { lbl:'Total Items', val:total,     color:C.brand,  pct:100 },
    { lbl:'Submitted',   val:sub,       color:C.green,  pct },
    { lbl:'Pending',     val:pend,      color:C.amber,  pct:total ? Math.round(pend / total * 100) : 0 },
    { lbl:'Completion',  val:`${pct}%`, color:C.purple, pct },
  ]);

  html += `<div class="sec-title">Question Type Summary</div>
  <table><thead><tr>
    <th>Question Type</th><th>Main Question</th>
    <th style="text-align:center">Generated</th><th style="text-align:center">Submitted</th>
    <th style="text-align:center">Pending</th><th>Progress</th>
  </tr></thead><tbody>`;
  unit.questionTypes.forEach(qt => {
    const meta = SUB_NB_QTYPE_META[qt.typeId] || { label: qt.typeId };
    const t  = qt.items.length;
    const s  = qt.items.filter(i => i.status === 'submitted').length;
    const pe = t - s;
    const p  = t ? Math.round(s / t * 100) : 0;
    html += `<tr>
      <td><strong>${meta.label}</strong></td>
      <td style="font-size:11.5px;color:${C.muted}">${qt.mainQ}</td>
      <td style="text-align:center;font-weight:700">${t}</td>
      <td style="text-align:center"><span class="tag tag-sub">✓ ${s}</span></td>
      <td style="text-align:center"><span class="tag ${pe > 0 ? 'tag-pend' : 'tag-sub'}">${pe > 0 ? '⏱ ' + pe : 'Done'}</span></td>
      <td>${_subPdfPbar(C, p)}</td>
    </tr>`;
  });
  html += `</tbody></table>`;

  html += `<div class="sec-title">Item-level Details</div>`;
  unit.questionTypes.forEach(qt => {
    const meta = SUB_NB_QTYPE_META[qt.typeId] || { label: qt.typeId };
    const s = qt.items.filter(i => i.status === 'submitted').length;
    html += `<div style="margin-bottom:4px;font-size:11px;font-weight:800;color:${C.brand};letter-spacing:.4px">${meta.label} — ${s}/${qt.items.length} submitted</div>
    <table style="margin-bottom:14px"><thead><tr>
      <th style="width:36px">#</th><th>Item</th><th style="width:170px">Submitted On</th><th style="width:110px">Status</th>
    </tr></thead><tbody>`;
    qt.items.forEach((item, i) => {
      const isSub = item.status === 'submitted';
      html += `<tr>
        <td style="color:${C.muted};font-weight:700">${i + 1}</td>
        <td>${item.preview}</td>
        <td style="color:${C.muted};font-size:11.5px">${isSub ? _subFmtSubmitted(item, `${unit.unitId}-${qt.typeId}-${item.id}`) : '—'}</td>
        <td><span class="tag ${isSub ? 'tag-sub' : 'tag-pend'}">${isSub ? '✓ Submitted' : '⏱ Pending'}</span></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  });

  html += _subPdfFooter(C);
  _openSubPdfWindow(html);
}

/* Date+time stamp helper for admin reports (e.g. "May 27, 2026 — 7:01 PM") */
function _adminGeneratedStamp() {
  const d = new Date();
  const date = d.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
  return `${date} — ${time}`;
}

/* A4 rules are now baked into _subPdfBase for ALL submission reports —
   keep this as an empty string so existing call-sites still concatenate cleanly. */
const _ADMIN_A4_CSS = '';

/* 4. Admin — Teacher-wise report */
function buildAdminTeacherReport(isColor) {
  const C       = _subPdfPalette(isColor);
  const today   = _adminGeneratedStamp();          /* "May 27, 2026 — 7:01 PM" — also used for the Generated meta cell */
  const teachers = SUB_ADMIN_TEACHERS;
  const totalLP = teachers.reduce((a, t) => a + t.lp.total, 0);
  const subLP   = teachers.reduce((a, t) => a + t.lp.submitted, 0);
  const totalNB = teachers.reduce((a, t) => a + t.nb.total, 0);
  const subNB   = teachers.reduce((a, t) => a + t.nb.submitted, 0);
  const overall = Math.round((subLP + subNB) / (totalLP + totalNB) * 100);

  let html = _subPdfBase(C, 'Teacher-wise Submission Report');
  html += _ADMIN_A4_CSS;
  html += _subPdfHeader(C, 'Teacher-wise Submission Report — Admin Overview', [
    { k:'Total Teachers',   v:teachers.length },
    { k:'LP Submitted',     v:`${subLP}/${totalLP}` },
    { k:'NB Submitted',     v:`${subNB}/${totalNB}` },
    { k:'Overall Progress', v:`${overall}%` },
  ], today);

  html += _subPdfStatStrip([
    { lbl:'Total Teachers', val:teachers.length,    color:C.brand,  pct:100 },
    { lbl:'LP Submitted',   val:subLP,              color:C.green,  pct:Math.round(subLP / totalLP * 100) },
    { lbl:'NB Submitted',   val:subNB,              color:C.purple, pct:Math.round(subNB / totalNB * 100) },
    { lbl:'Overall',        val:`${overall}%`,      color:C.accent, pct:overall },
  ]);

  html += `<div class="sec-title">Teacher Performance Breakdown</div>
  <table><thead><tr>
    <th>#</th><th>Teacher</th><th>Subject</th><th>Class</th>
    <th style="text-align:center">LP Total</th><th style="text-align:center">LP Submitted</th><th>LP Progress</th>
    <th style="text-align:center">NB Total</th><th style="text-align:center">NB Submitted</th><th>NB Progress</th>
    <th>Overall</th>
  </tr></thead><tbody>`;
  teachers.forEach((t, i) => {
    const lpPct = Math.round(t.lp.submitted / t.lp.total * 100);
    const nbPct = Math.round(t.nb.submitted / t.nb.total * 100);
    const ovPct = Math.round((t.lp.submitted + t.nb.submitted) / (t.lp.total + t.nb.total) * 100);
    html += `<tr>
      <td style="color:${C.muted};font-weight:700">${i + 1}</td>
      <td><strong>${t.name}</strong></td>
      <td>${t.subject}</td>
      <td><span class="tag tag-na">${t.class}</span></td>
      <td style="text-align:center">${t.lp.total}</td>
      <td style="text-align:center"><span class="tag tag-sub">✓ ${t.lp.submitted}</span></td>
      <td>${_subPdfPbar(C, lpPct)}</td>
      <td style="text-align:center">${t.nb.total}</td>
      <td style="text-align:center"><span class="tag tag-sub">✓ ${t.nb.submitted}</span></td>
      <td>${_subPdfPbar(C, nbPct)}</td>
      <td>${_subPdfPbar(C, ovPct)}</td>
    </tr>`;
  });
  html += `<tr class="unit-row">
    <td colspan="4">Totals</td>
    <td style="text-align:center">${totalLP}</td>
    <td style="text-align:center">${subLP}</td>
    <td>${_subPdfPbar(C, Math.round(subLP / totalLP * 100))}</td>
    <td style="text-align:center">${totalNB}</td>
    <td style="text-align:center">${subNB}</td>
    <td>${_subPdfPbar(C, Math.round(subNB / totalNB * 100))}</td>
    <td>${_subPdfPbar(C, overall)}</td>
  </tr></tbody></table>`;

  /* Date-only string used to feed _subFmtSubmitted so it appends a synthetic time per teacher */
  const dateOnly = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  html += `<div class="sec-title">Individual Teacher Cards</div>`;
  teachers.forEach(t => {
    const lpPct = Math.round(t.lp.submitted / t.lp.total * 100);
    const nbPct = Math.round(t.nb.submitted / t.nb.total * 100);
    const stamp = _subFmtSubmitted({ status: 'submitted', submittedDate: dateOnly }, `admin-t-${t.name}`);
    html += `<div style="border:1.5px solid ${C.border};border-radius:10px;padding:13px 16px;margin-bottom:10px;background:${C.cardBg};page-break-inside:avoid">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-size:14px;font-weight:800;color:${C.brand}">${t.name}</div>
          <div style="font-size:11px;color:${C.muted};margin-top:2px">${t.subject} · ${t.class}</div>
          <div style="font-size:10.5px;color:${C.muted};margin-top:2px">Last submission: ${stamp}</div>
        </div>
        <span class="tag ${lpPct === 100 && nbPct === 100 ? 'tag-sub' : 'tag-pend'}">${lpPct === 100 && nbPct === 100 ? '✓ All Submitted' : 'In Progress'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="padding:10px;background:${C.isColor ? '#EFF6FF' : '#F5F5F5'};border-radius:8px;border:1px solid ${C.border}">
          <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:${C.muted};margin-bottom:6px">Lesson Plans</div>
          <div style="font-size:18px;font-weight:900;color:${C.brand}">${t.lp.submitted}<span style="font-size:12px;font-weight:600;color:${C.muted}">/${t.lp.total}</span></div>
          <div style="margin-top:6px">${_subPdfPbar(C, lpPct)}</div>
        </div>
        <div style="padding:10px;background:${C.isColor ? '#F5F3FF' : '#F5F5F5'};border-radius:8px;border:1px solid ${C.border}">
          <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:${C.muted};margin-bottom:6px">Notebook Plans</div>
          <div style="font-size:18px;font-weight:900;color:${C.purple}">${t.nb.submitted}<span style="font-size:12px;font-weight:600;color:${C.muted}">/${t.nb.total}</span></div>
          <div style="margin-top:6px">${_subPdfPbar(C, nbPct)}</div>
        </div>
      </div>
    </div>`;
  });

  html += _subPdfFooter(C);
  _openSubPdfWindow(html);
}

/* 5. Admin — Class-wise report */
function buildAdminClassReport(isColor) {
  const C        = _subPdfPalette(isColor);
  const today    = _adminGeneratedStamp();   /* date + time for the GENERATED meta cell */
  const dateOnly = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const classes = SUB_ADMIN_CLASSES;
  const tLP = classes.reduce((a, c) => a + c.lp,    0);
  const sLP = classes.reduce((a, c) => a + c.lpSub, 0);
  const tNB = classes.reduce((a, c) => a + c.nb,    0);
  const sNB = classes.reduce((a, c) => a + c.nbSub, 0);

  let html = _subPdfBase(C, 'Class-wise Submission Report');
  html += _ADMIN_A4_CSS;
  html += _subPdfHeader(C, 'Class-wise Submission Report — Admin Overview', [
    { k:'Total Classes', v:classes.length },
    { k:'LP Submitted',  v:`${sLP}/${tLP}` },
    { k:'NB Submitted',  v:`${sNB}/${tNB}` },
    { k:'LP Completion', v:`${Math.round(sLP / tLP * 100)}%` },
  ], today);

  html += _subPdfStatStrip([
    { lbl:'Total Classes', val:classes.length,                       color:C.brand,  pct:100 },
    { lbl:'LP Submitted',  val:sLP,                                  color:C.green,  pct:Math.round(sLP / tLP * 100) },
    { lbl:'NB Submitted',  val:sNB,                                  color:C.purple, pct:Math.round(sNB / tNB * 100) },
    { lbl:'LP Completion', val:`${Math.round(sLP / tLP * 100)}%`,    color:C.accent, pct:Math.round(sLP / tLP * 100) },
  ]);

  html += `<div class="sec-title">Class-wise Breakdown</div>
  <table><thead><tr>
    <th>Class</th><th>Subject</th><th>Teacher</th>
    <th style="text-align:center">LP Total</th><th style="text-align:center">LP Sub.</th>
    <th style="text-align:center">LP Pend.</th><th>LP Progress</th>
    <th style="text-align:center">NB Total</th><th style="text-align:center">NB Sub.</th><th>NB Progress</th>
    <th>Last Submission</th>
  </tr></thead><tbody>`;
  classes.forEach(c => {
    const lpPct = Math.round(c.lpSub / c.lp * 100);
    const nbPct = Math.round(c.nbSub / c.nb * 100);
    const stamp = _subFmtSubmitted({ status: 'submitted', submittedDate: dateOnly }, `admin-c-${c.cls}`);
    html += `<tr>
      <td><strong>${c.cls}</strong></td>
      <td>${c.subj}</td>
      <td style="font-size:11.5px">${c.teacher}</td>
      <td style="text-align:center">${c.lp}</td>
      <td style="text-align:center"><span class="tag tag-sub">✓ ${c.lpSub}</span></td>
      <td style="text-align:center"><span class="tag ${c.lp - c.lpSub > 0 ? 'tag-pend' : 'tag-sub'}">${c.lp - c.lpSub > 0 ? '⏱ ' + (c.lp - c.lpSub) : 'Done'}</span></td>
      <td>${_subPdfPbar(C, lpPct)}</td>
      <td style="text-align:center">${c.nb}</td>
      <td style="text-align:center"><span class="tag tag-sub">✓ ${c.nbSub}</span></td>
      <td>${_subPdfPbar(C, nbPct)}</td>
      <td style="color:${C.muted};font-size:11px">${stamp}</td>
    </tr>`;
  });
  html += `<tr class="unit-row">
    <td colspan="3">Totals</td>
    <td style="text-align:center">${tLP}</td>
    <td style="text-align:center">${sLP}</td>
    <td style="text-align:center">${tLP - sLP}</td>
    <td>${_subPdfPbar(C, Math.round(sLP / tLP * 100))}</td>
    <td style="text-align:center">${tNB}</td>
    <td style="text-align:center">${sNB}</td>
    <td>${_subPdfPbar(C, Math.round(sNB / tNB * 100))}</td>
    <td></td>
  </tr></tbody></table>`;

  html += `<div class="sec-title">Pending Work by Class</div>
  <table><thead><tr>
    <th>Class</th><th>Teacher</th><th>Subject</th>
    <th style="text-align:center">LP Pending</th><th style="text-align:center">NB Pending</th><th>Priority</th>
  </tr></thead><tbody>`;
  const sorted = [...classes].sort((a, b) =>
    (b.lp - b.lpSub + b.nb - b.nbSub) - (a.lp - a.lpSub + a.nb - a.nbSub)
  );
  sorted.forEach(c => {
    const lpPend = c.lp - c.lpSub;
    const nbPend = c.nb - c.nbSub;
    const total  = lpPend + nbPend;
    const priority = total === 0 ? 'Complete' : total > 20 ? 'High' : total > 10 ? 'Medium' : 'Low';
    const priColor = total === 0 ? C.green : total > 20 ? C.amber : C.accent;
    html += `<tr>
      <td><strong>${c.cls}</strong></td>
      <td>${c.teacher}</td>
      <td>${c.subj}</td>
      <td style="text-align:center"><span class="tag ${lpPend > 0 ? 'tag-pend' : 'tag-sub'}">${lpPend > 0 ? lpPend + ' left' : '✓ Done'}</span></td>
      <td style="text-align:center"><span class="tag ${nbPend > 0 ? 'tag-pend' : 'tag-sub'}">${nbPend > 0 ? nbPend + ' left' : '✓ Done'}</span></td>
      <td><span class="tag" style="background:${total === 0 ? (C.isColor ? 'rgba(22,163,74,.1)' : '#EEE') : 'transparent'};color:${priColor};border:1px solid ${priColor}40">${priority}</span></td>
    </tr>`;
  });
  html += `</tbody></table>`;

  html += _subPdfFooter(C);
  _openSubPdfWindow(html);
}

/* 6. Admin — Subject-wise report */
function buildAdminSubjectReport(isColor) {
  const C     = _subPdfPalette(isColor);
  const today = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const subjects = SUB_ADMIN_SUBJECTS;
  const tTotal = subjects.reduce((a, s) => a + s.total,     0);
  const tSub   = subjects.reduce((a, s) => a + s.submitted, 0);

  let html = _subPdfBase(C, 'Subject-wise Submission Report');
  html += _subPdfHeader(C, 'Subject-wise Submission Report — Admin Overview', [
    { k:'Subjects',    v:subjects.length },
    { k:'Total Plans', v:tTotal },
    { k:'Submitted',   v:tSub },
    { k:'Completion',  v:`${Math.round(tSub / tTotal * 100)}%` },
  ], today);

  html += _subPdfStatStrip([
    { lbl:'Total Subjects',  val:subjects.length,                       color:C.brand,  pct:100 },
    { lbl:'Plans Submitted', val:tSub,                                  color:C.green,  pct:Math.round(tSub / tTotal * 100) },
    { lbl:'Plans Pending',   val:tTotal - tSub,                         color:C.amber,  pct:Math.round((tTotal - tSub) / tTotal * 100) },
    { lbl:'Completion',      val:`${Math.round(tSub / tTotal * 100)}%`, color:C.purple, pct:Math.round(tSub / tTotal * 100) },
  ]);

  html += `<div class="sec-title">Subject-wise Breakdown</div>
  <table><thead><tr>
    <th>Subject</th><th>Teacher(s)</th>
    <th style="text-align:center">Total Plans</th><th style="text-align:center">Submitted</th>
    <th style="text-align:center">Pending</th><th>Completion</th><th>Status</th>
    <th>Last Submission</th>
  </tr></thead><tbody>`;
  subjects.forEach(s => {
    const pct = Math.round(s.submitted / s.total * 100);
    const status = pct === 100 ? 'Complete' : pct >= 60 ? 'On Track' : pct >= 30 ? 'In Progress' : 'Needs Attention';
    const statusCls = pct === 100 ? 'tag-sub' : pct >= 60 ? 'tag-na' : 'tag-pend';
    const stamp = _subFmtSubmitted({ status: 'submitted', submittedDate: today }, `admin-s-${s.subj}`);
    html += `<tr>
      <td><strong>${s.icon} ${s.subj}</strong></td>
      <td style="font-size:11.5px;color:${C.muted}">${s.teachers.join(', ')}</td>
      <td style="text-align:center;font-weight:700">${s.total}</td>
      <td style="text-align:center"><span class="tag tag-sub">✓ ${s.submitted}</span></td>
      <td style="text-align:center"><span class="tag ${s.total - s.submitted > 0 ? 'tag-pend' : 'tag-sub'}">${s.total - s.submitted > 0 ? '⏱ ' + (s.total - s.submitted) : 'All done'}</span></td>
      <td>${_subPdfPbar(C, pct)}</td>
      <td><span class="tag ${statusCls}">${status}</span></td>
      <td style="color:${C.muted};font-size:11px">${stamp}</td>
    </tr>`;
  });
  html += `<tr class="unit-row">
    <td colspan="2">Overall Total</td>
    <td style="text-align:center">${tTotal}</td>
    <td style="text-align:center"><strong style="color:${C.green}">${tSub}</strong></td>
    <td style="text-align:center"><strong style="color:${C.amber}">${tTotal - tSub}</strong></td>
    <td colspan="3">${_subPdfPbar(C, Math.round(tSub / tTotal * 100))}</td>
  </tr></tbody></table>`;

  html += `<div class="sec-title">Submission Comparison</div>
  <div style="display:grid;grid-template-columns:repeat(${Math.min(subjects.length, 5)},1fr);gap:10px">`;
  subjects.forEach(s => {
    const pct = Math.round(s.submitted / s.total * 100);
    const color = pct === 100 ? C.green : pct >= 60 ? C.accent : C.amber;
    html += `<div style="border:1.5px solid ${C.border};border-radius:10px;padding:13px;text-align:center;background:${C.cardBg};page-break-inside:avoid">
      <div style="font-size:22px;margin-bottom:6px">${s.icon}</div>
      <div style="font-weight:800;font-size:13px;color:${C.brand};margin-bottom:8px">${s.subj}</div>
      <div style="font-size:22px;font-weight:900;color:${color}">${pct}%</div>
      <div style="font-size:10px;color:${C.muted};margin-top:3px">${s.submitted}/${s.total} plans</div>
      <div style="margin-top:8px;height:6px;border-radius:99px;background:${C.isColor ? 'rgba(30,58,138,.1)' : '#E0E0E0'};overflow:hidden">
        <div style="width:${pct}%;height:100%;border-radius:99px;background:${color}"></div>
      </div>
    </div>`;
  });
  html += `</div>`;

  html += _subPdfFooter(C);
  _openSubPdfWindow(html);
}

/* ═══════════════════════════════════════════════════════════════════
   UNIT MGR MODAL — manage units (serial / no / name / lesson count)
   ═══════════════════════════════════════════════════════════════════ */
function UnitMgrModal({ open, source, units, clpCtx = {}, onSave, onClose, openConfirm, toast }) {
  const [draft, setDraft] = useState([]);
  const [snoTarget, setSnoTarget] = useState(null); // {id, currentIdx}
  const [origIds, setOrigIds] = useState(new Set()); // unit ids present before edits

  useEffect(() => {
    if (open) {
      setDraft(units.map(u => ({ ...u, lessons: [...(u.lessons || [])], questions: [...(u.questions || [])] })));
      setOrigIds(new Set(units.map(u => u.id)));
    }
  }, [open, units]);

  /* Persist newly-added units as ULP class-master rows with an empty topic
     (lesson source only); then hand the draft back to the parent. */
  const save = async () => {
    if (source === 'lesson' && clpCtx.classID) {
      const newUnits = draft.filter(u => !origIds.has(u.id) && (u.unitNo || u.unitName));
      try {
        await Promise.all(newUnits.map(u => lpPost('/api/ulpforclassmastercrud', {
          id: 0,
          branchID: clpCtx.branchID, classID: clpCtx.classID, sectionID: clpCtx.sectionID, subjectID: clpCtx.subjectID,
          unitNo: u.unitNo, unitName: u.unitName, lessonPlanTopic: '', action: 'insert',
        })));
      } catch (e) {
        console.error('Error inserting units:', e);
        toast('Could not save new units', 'error');
        return;
      }
    }
    onSave(draft);
  };

  if (!open) return null;

  const update = (id, key, val) => setDraft(d => d.map(u => u.id === id ? { ...u, [key]: val } : u));
  const remove = id => {
    const u = draft.find(x => x.id === id);
    openConfirm({
      title: 'Delete Unit?',
      message: `Unit <strong>"${u?.unitName || u?.unitNo}"</strong> will be removed from the list.`,
      hint: 'Save changes to persist the deletion.',
      confirmLabel: 'Yes, Delete',
      icon: 'fa-trash',
      onConfirm: () => setDraft(d => d.filter(x => x.id !== id)),
    });
  };
  const add = () => setDraft(d => [...d, {
    id: Date.now(), unitNo: String(d.length + 1), unitName: '',
    lessons: source === 'lesson' ? [] : undefined,
    questions: source === 'notebook' ? [] : undefined,
  }]);

  const reorder = (toIdx) => {
    if (snoTarget == null) return;
    const fromIdx = draft.findIndex(u => u.id === snoTarget.id);
    if (fromIdx < 0 || fromIdx === toIdx) { setSnoTarget(null); return; }
    const next = [...draft];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setDraft(next);
    setSnoTarget(null);
    toast('Order updated', 'success');
  };

  return (
    <div className="lp-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="lp-modal" style={{ maxWidth: 720 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon"><i className="fa-solid fa-layer-group"></i></div>
            <div>
              <div className="lp-modal-title">Manage Units</div>
              <div className="lp-modal-sub">{source === 'lesson' ? 'Lesson Plans' : 'Notebook Plans'} — add, edit, reorder or remove units</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="lp-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        <div className="lp-modal-body">
          {draft.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8', fontSize: 13 }}>
              <i className="fa-solid fa-layer-group" style={{ fontSize: 30, marginBottom: 10, display: 'block', opacity: .3 }}></i>
              No units yet. Click <strong style={{ color: '#1E40AF' }}>+ Add New Unit</strong> below.
            </div>
          )}
          {draft.map((u, i) => (
            <div key={u.id} className="umgr-unit-row">
              <Tooltip text="Drag to reorder">
                <span className="umgr-drag-handle">
                  <i className="fa-solid fa-grip-vertical"></i>
                </span>
              </Tooltip>
              <Tooltip text="Click to change serial number"><button
                className="umgr-sno-badge"
               
                onClick={() => setSnoTarget({ id: u.id, currentIdx: i })}
              >
                #{i + 1}
              </button></Tooltip>
              <input
                className="umgr-no-input"
                type="text"
                maxLength={3}
                value={u.unitNo}
                placeholder={String(i + 1)}
                onChange={e => update(u.id, 'unitNo', e.target.value.replace(/[^0-9]/g, ''))}
              />
              <input
                className="umgr-name-input"
                type="text"
                value={u.unitName}
                placeholder="Unit name…"
                onChange={e => update(u.id, 'unitName', e.target.value)}
              />
              <span className="umgr-lesson-count">
                <i className="fa-solid fa-book" style={{ fontSize: 9 }}></i>{' '}
                {(u.lessons || u.questions || []).length}
              </span>
              <Tooltip text="Delete unit">
                <button className="umgr-del-btn" onClick={() => remove(u.id)}>
                  <i className="fa-solid fa-trash"></i>
                </button>
              </Tooltip>
            </div>
          ))}

          <Tooltip text="Add a new unit">
            <button className="lp-add-row" onClick={add}>
              <i className="fa-solid fa-circle-plus"></i> Add New Unit
            </button>
          </Tooltip>
        </div>

        <div className="lp-modal-footer">
          <Tooltip text="Discard changes and close">
            <button className="lp-btn ghost" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Save unit order and changes">
            <button className="lp-btn primary" onClick={save}>
              <i className="fa-solid fa-check"></i> Save
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Serial-number reorder confirmation */}
      {snoTarget != null && (
        <div className="lp-overlay open" style={{ zIndex: 5000 }} onClick={e => { if (e.target === e.currentTarget) setSnoTarget(null); }}>
          <div className="lp-modal" style={{ maxWidth: 380 }}>
            <div className="lp-modal-header">
              <div className="lp-modal-title-row">
                <div className="lp-modal-icon"><i className="fa-solid fa-arrows-up-down"></i></div>
                <div>
                  <div className="lp-modal-title">Change Serial</div>
                  <div className="lp-modal-sub">Move this unit to a new position</div>
                </div>
              </div>
              <Tooltip text="Close">
                <button className="lp-modal-close" onClick={() => setSnoTarget(null)} aria-label="Close">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </Tooltip>
            </div>
            <div className="lp-modal-body">
              <label className="form-label">Move to position</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={draft.length}
                defaultValue={snoTarget.currentIdx + 1}
                onChange={e => snoTarget.next = +e.target.value}
              />
            </div>
            <div className="lp-modal-footer">
              <Tooltip text="Cancel reorder">
                <button className="lp-btn ghost" onClick={() => setSnoTarget(null)}>Cancel</button>
              </Tooltip>
              <Tooltip text="Apply new position">
                <button className="lp-btn primary" onClick={() => {
                  const target = (snoTarget.next ?? (snoTarget.currentIdx + 1)) - 1;
                  reorder(Math.min(Math.max(target, 0), draft.length - 1));
                }}>
                  <i className="fa-solid fa-check"></i> Reorder
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LESSON EDIT MODAL — verbatim two-panel layout from HTML (.clpm-modal)
   ═══════════════════════════════════════════════════════════════════ */
const DOT_CLASSES = ['clpm-rte-section-dot--purple','clpm-rte-section-dot--blue','clpm-rte-section-dot--orange','clpm-rte-section-dot--green'];

function LessonEditModal({ ctx, onSave, onClose, toast }) {
  const [lang, setLang] = useState('en');
  const [unitNo, setUnitNo] = useState('');
  const [unitName, setUnitName] = useState('');
  const [duration, setDuration] = useState('');
  const [lessons, setLessons] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const editorRefs = useRef({});

  useEffect(() => {
    if (!ctx) return;
    setLang('en');
    setUnitNo(ctx.unit?.unitNo || '');
    setUnitName(ctx.unit?.unitName || '');
    /* Map the lesson-plan detail fetched on Edit into the editor sections. */
    const d = ctx.detail;
    const detailMap = d ? {
      slo:   d.learningObjective  || '',
      intro: d.lessonIntroduction || '',
      devel: d.development        || '',
      recap: d.recap              || '',
    } : null;
    const unitLessons = (ctx.unit?.lessons || []).map(l => {
      const isSel = l.id === ctx.lesson?.id;
      return {
        id: l.id,
        num: l.num || '',
        topic: (isSel && d) ? (d.lessonPlanTopic ?? l.topic) : (l.topic || ''),
        duration: (isSel && d) ? (d.timeDuration || '') : (l.duration || ''),
        contentMap: (isSel && detailMap) ? detailMap : (l.contentMap || {}),
        source: l.source || 'manual',
        detail: isSel ? d : (l.detail || null),
        record: l.record || null, // original ULP master row (for update vs insert)
      };
    });
    /* if the unit has no lessons, seed one blank */
    setLessons(unitLessons.length ? unitLessons : [{ id: Date.now(), num: '1', topic: '', duration: '', contentMap: {}, source: 'manual' }]);
    const idx = Math.max(0, unitLessons.findIndex(l => l.id === ctx.lesson?.id));
    setSelectedIdx(idx);
    setDuration(unitLessons[idx]?.duration || ctx.lesson?.duration || '');
  }, [ctx]);

  const sections = lang === 'ur' ? LESSON_SECTIONS_UR : LESSON_SECTIONS_EN;
  const isUrdu = lang === 'ur';
  const dir = isUrdu ? 'rtl' : 'ltr';
  const currentLesson = lessons[selectedIdx] || { num: '', topic: '', duration: '', contentMap: {} };

  /* Sync editor DOM when selection/lang changes, or when the current lesson's
     content is replaced (e.g. detail loaded on Edit/Fetch — contentMap gets a new
     reference). Typing in the topic input keeps the same contentMap ref, so it
     won't clobber unsaved editor content. */
  useEffect(() => {
    if (!ctx) return;
    sections.forEach(s => {
      const el = editorRefs.current[s.key];
      if (el) el.innerHTML = currentLesson.contentMap?.[s.key] || '';
    });
    setDuration(currentLesson.duration || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, lang, ctx, currentLesson.contentMap]);

  if (!ctx) return null;

  const exec = (cmd, val) => document.execCommand(cmd, false, val !== undefined ? val : null);
  const insertTable = () => {
    const html = '<table style="border-collapse:collapse;width:100%;margin:8px 0"><tr><td style="border:1px solid #BFDBFE;padding:6px 10px">Col 1</td><td style="border:1px solid #BFDBFE;padding:6px 10px">Col 2</td></tr><tr><td style="border:1px solid #BFDBFE;padding:6px 10px">Row 2</td><td style="border:1px solid #BFDBFE;padding:6px 10px">Row 2</td></tr></table>';
    document.execCommand('insertHTML', false, html);
  };
  const insertLink = () => {
    const url = window.prompt('Enter URL', 'https://');
    if (!url) return;
    document.execCommand('createLink', false, url);
  };

  const updateLesson = (idx, patch) =>
    setLessons(ls => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const captureEditors = () => {
    const map = {};
    sections.forEach(s => {
      const el = editorRefs.current[s.key];
      if (el) map[s.key] = el.innerHTML;
    });
    return map;
  };

  const saveCurrent = () => {
    const map = captureEditors();
    updateLesson(selectedIdx, { duration, contentMap: map });
    toast(`Lesson ${currentLesson.num || selectedIdx + 1} saved`, 'success');
  };

  const fetchLesson = idx => {
    /* commit current edits, then switch selection */
    const map = captureEditors();
    updateLesson(selectedIdx, { duration, contentMap: map });
    setSelectedIdx(idx);
  };

  /* Apply a fetched ULP class-detail row to its lesson (by master id) and, since
     it's the one being viewed, into the editor fields. */
  const applyDetail = (d, masterId) => {
    const contentMap = {
      slo:   d.learningObjective  || '',
      intro: d.lessonIntroduction || '',
      devel: d.development        || '',
      recap: d.recap              || '',
    };
    setLessons(ls => ls.map(l => l.record?.id === masterId
      ? { ...l, topic: d.lessonPlanTopic ?? l.topic, duration: d.timeDuration || '', contentMap, detail: d }
      : l));
    setDuration(d.timeDuration || '');
    sections.forEach(s => { const el = editorRefs.current[s.key]; if (el) el.innerHTML = contentMap[s.key] || ''; });
  };

  /* GET the lesson-plan detail for a topic (masterClassesID) and map it in. */
  const loadDetailById = async masterId => {
    if (!masterId) return;
    try {
      const token = sessionStorage.getItem('token') || '';
      const res = await fetch(
        buildUrl(`/api/getulpforclassdetailbytermsubjectandclass?MasterClassesID=${masterId}&classID=${ctx.classID}&subjectID=${ctx.subjectID}&pageNo=1`),
        { method: 'GET', headers: { Accept: '*/*', Authorization: `bearer ${token}` } },
      );
      const json = await res.json();
      const d = (json?.data || [])[0];
      if (d) applyDetail(d, masterId);
    } catch (e) {
      console.error('Error loading lesson detail:', e);
    }
  };

  const addLesson = () => {
    const nextNum = String(lessons.length + 1);
    setLessons(ls => [...ls, { id: Date.now(), num: nextNum, topic: '', duration: '', contentMap: {}, source: 'manual', record: null }]);
    setSelectedIdx(lessons.length);
  };

  /* ULP class-master persistence — class/section/subject/branch come from the
     real selected context (the API returns sectionID 0, so we don't trust the
     row). New topics (no record) insert, existing update. */
  const ulpBase = () => ({
    branchID:  ctx.branchID || sessionStorage.getItem('branchID') || '',
    classID:   ctx.classID,
    sectionID: ctx.sectionID,
    subjectID: ctx.subjectID,
  });
  const ulpPayload = (l, base) => ({
    id: l.record ? l.record.id : 0,
    branchID: base.branchID, classID: base.classID, sectionID: base.sectionID, subjectID: base.subjectID,
    unitNo, unitName,
    lessonPlanTopic: l.topic || '',
    action: l.record ? 'update' : 'insert',
  });

  /* Save a single topic (update if it exists, otherwise insert). */
  const saveTopic = async li => {
    const base = ulpBase();
    if (!base.classID || !base.subjectID) { toast('Missing class/subject context', 'error'); return; }
    const l = lessons[li];
    try {
      const result = await lpPost('/api/ulpforclassmastercrud', ulpPayload(l, base));
      updateLesson(li, { record: { ...(l.record || {}), ...result, id: result?.id ?? l.record?.id } });
      toast(l.record ? 'Lesson topic updated' : 'Lesson topic added', 'success');
    } catch (e) {
      console.error('Error saving lesson topic:', e);
      toast('Could not save lesson topic', 'error');
    }
  };

  /* Save the unit no/name across all topics (update existing, insert new). */
  const saveAllTopics = async () => {
    const base = ulpBase();
    if (!base.classID || !base.subjectID) { toast('Missing class/subject context', 'error'); return; }
    try {
      const results = await Promise.all(lessons.map(l =>
        lpPost('/api/ulpforclassmastercrud', ulpPayload(l, base))
          .then(result => ({ lid: l.id, result }))
          .catch(() => null)
      ));
      setLessons(ls => ls.map(l => {
        const r = results.find(x => x && x.lid === l.id);
        if (!r) return l;
        return { ...l, record: { ...(l.record || {}), ...r.result, id: r.result?.id ?? l.record?.id } };
      }));
      toast('All lesson topics saved', 'success');
    } catch (e) {
      console.error('Error saving lesson topics:', e);
      toast('Could not save lesson topics', 'error');
    }
  };

  /* Save the lesson-plan detail (sections + timings) for a topic via
     ulpforclassdetailcrud. masterClassesID = the topic's ULP master id; the
     detail row's own id (from a prior load/save) drives update vs insert. */
  const saveDetail = async li => {
    const l = lessons[li];
    const masterId = l?.record?.id;
    if (!masterId) { toast('Save the topic first, then save the plan', 'error'); return; }
    const map = (li === selectedIdx) ? captureEditors() : (l.contentMap || {});
    const dur = (li === selectedIdx) ? duration : (l.duration || '');
    const d = l.detail || {};
    try {
      const result = await lpPost('/api/ulpforclassdetailcrud', {
        id: d.id || 0,
        termID: d.termID || '',
        slot: d.slot || '',
        classID: ctx.classID,
        subjectID: ctx.subjectID,
        unitNo, unitName,
        totalLessonPlans: d.totalLessonPlans || '',
        timeDuration: dur || '',
        lessonPlanTopic: l.topic || '',
        learningObjective: map.slo || '',
        timeForLearning: d.timeForLearning || '',
        lessonIntroduction: map.intro || '',
        timeForLesson: d.timeForLesson || '',
        development: map.devel || '',
        timeForDevelopment: d.timeForDevelopment || '',
        recap: map.recap || '',
        timeForRecap: d.timeForRecap || '',
        rating: d.rating || '',
        suggestion: d.suggestion || '',
        suggestionDescription: d.suggestionDescription || '',
        masterClassesID: masterId,
        className: ctx.clpClass || '',
        subjectName: ctx.clpSubject || '',
        action: d.id ? 'update' : 'insert',
      });
      updateLesson(li, { contentMap: map, duration: dur, detail: { ...d, ...result, id: result?.id ?? d.id } });
      toast(d.id ? 'Lesson plan updated' : 'Lesson plan saved', 'success');
    } catch (e) {
      console.error('Error saving lesson plan detail:', e);
      toast('Could not save lesson plan', 'error');
    }
  };

  const saveAndClose = async () => {
    /* Persist the current lesson's plan detail, then hand the lesson back. */
    await saveDetail(selectedIdx);
    const map = captureEditors();
    const target = { ...lessons[selectedIdx], duration, contentMap: map };
    onSave({ ...target });
  };

  return (
    <div className="clpm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`clpm-modal${isUrdu ? ' rtl-mode' : ''}`}>

        {/* ── HEADER — title + breadcrumb chips ── */}
        <div className="clpm-header">
          <div>
            <div className="clpm-title">Edit Lesson Plans for Unit</div>
            <div className="clpm-header-meta">
              <span className="clpm-header-chip">
                <i className="fa-solid fa-chalkboard" style={{ fontSize: 10, opacity: .8 }}></i>
                {ctx.clpClass || '—'}
              </span>
              <span className="clpm-header-chip">
                <i className="fa-solid fa-book-open" style={{ fontSize: 10, opacity: .8 }}></i>
                {ctx.clpSubject || '—'}
              </span>
              <span className="clpm-header-chip clpm-header-chip--accent">
                <i className="fa-solid fa-pen-to-square" style={{ fontSize: 10, opacity: .8 }}></i>
                Unit {unitNo || (ctx.unit?.unitNo) || '—'} — Edit Lessons
              </span>
            </div>
          </div>
          <Tooltip text="Close"><button className="clpm-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        {/* ── BODY ── */}
        <div className="clpm-body">

          {/* LEFT: unit + lessons navigator */}
          <div className="clpm-left">
            <div className="clml-unit">
              {/* Unit header strip */}
              <div className="clml-unit-hdr">
                <div className="clml-unit-hdr-left">
                  <span className="clml-unit-badge">Unit {unitNo || '—'}</span>
                  <span className="clml-unit-name">{unitName || '(no name)'}</span>
                </div>
                <div className="clml-unit-hdr-right">
                  <span className="clml-lesson-count">{lessons.length} <i className="fa-solid fa-book" style={{ fontSize: 9 }}></i></span>
                </div>
              </div>

              {/* Unit fields */}
              <div className="clml-fields" style={{ padding: '8px 12px 4px' }}>
                <div className="clml-field-row">
                  <span className="clml-field-lbl">NO.</span>
                  <input className="clml-field-input" value={unitNo} type="text" inputMode="numeric"
                    placeholder="1"
                    onChange={e => setUnitNo(e.target.value.replace(/[^0-9]/g, ''))} />
                  <Tooltip text="Save unit no. to all topics"><button className="clml-edit-btn" aria-label="Save unit number" onClick={saveAllTopics}><i className="fa-solid fa-pen"></i></button></Tooltip>
                </div>
                <div className="clml-field-row">
                  <span className="clml-field-lbl">NAME</span>
                  <input className="clml-field-input clml-field-input--grow" value={unitName}
                    placeholder="Unit name"
                    onChange={e => setUnitName(e.target.value)} />
                  <Tooltip text="Save unit name to all topics"><button className="clml-edit-btn" aria-label="Save unit name" onClick={saveAllTopics}><i className="fa-solid fa-pen"></i></button></Tooltip>
                </div>
              </div>

              {/* Lesson list */}
              <div style={{ padding: '0 10px 8px' }}>
                {lessons.map((l, li) => (
                  <div key={l.id}
                    className="clml-lesson"
                    style={li === selectedIdx ? { borderColor: '#1E40AF', boxShadow: '0 3px 12px rgba(30,64,175,.1)' } : null}>
                    <div className="clml-lesson-hdr">
                      <div className="clml-lesson-tags">
                        <span className="clml-ltag clml-ltag--seq">#{li + 1}</span>
                        <span className="clml-ltag clml-ltag--num">L{l.num || '—'}</span>
                      </div>
                      <Tooltip text="Edit lesson number"><button className="clml-edit-btn"
                        onClick={() => {
                          const v = window.prompt('Lesson number', l.num || '');
                          if (v !== null) updateLesson(li, { num: v });
                        }}>
                        <i className="fa-solid fa-hashtag"></i>
                      </button></Tooltip>
                    </div>
                    <div className="clml-field-row" style={{ marginBottom: 6 }}>
                      <input className="clml-field-input clml-field-input--grow"
                        value={l.topic} placeholder="Lesson topic…"
                        onChange={e => updateLesson(li, { topic: e.target.value })} />
                      <Tooltip text={l.record ? 'Save topic changes' : 'Insert this topic'}><button className="clml-edit-btn" aria-label="Save topic" onClick={() => saveTopic(li)}>
                        <i className="fa-solid fa-pen"></i>
                      </button></Tooltip>
                    </div>
                    <div className="clml-lesson-actions">
                      <Tooltip text="Save this topic (same as the pencil) and its editor content">
                        <button className="clml-action-btn clml-action-save"
                          onClick={() => { if (li === selectedIdx) saveCurrent(); saveTopic(li); saveDetail(li); }}>
                          <i className="fa-solid fa-floppy-disk"></i> Save
                        </button>
                      </Tooltip>
                      <Tooltip text="Load this lesson's saved plan into the editor">
                        <button className="clml-action-btn clml-action-fetch"
                          onClick={() => { fetchLesson(li); loadDetailById(l.record?.id); toast(`Lesson ${l.num || li + 1} loaded into editor`, 'success'); }}>
                          <i className="fa-solid fa-download"></i> Fetch
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}

                <Tooltip text="Add a new lesson to this unit">
                  <button className="clml-add-lesson" onClick={addLesson}>
                    <i className="fa-solid fa-plus"></i> Add Lesson
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* RIGHT: work area */}
          <div className="clpm-right">

            {/* Top info bar */}
            <div className="clpm-right-topbar">

              {/* Context pills */}
              <div className="clpm-ctx-row">
                <div className="clpm-ctx-pill clpm-ctx-pill--blue">
                  <div className="clpm-ctx-icon"><i className="fa-solid fa-school"></i></div>
                  <div className="clpm-ctx-body">
                    <div className="clpm-ctx-label">Grade</div>
                    <div className="clpm-ctx-val">{ctx.clpClass || '—'}</div>
                  </div>
                </div>
                <div className="clpm-ctx-pill clpm-ctx-pill--blue">
                  <div className="clpm-ctx-icon"><i className="fa-solid fa-book-open"></i></div>
                  <div className="clpm-ctx-body">
                    <div className="clpm-ctx-label">Subject</div>
                    <div className="clpm-ctx-val">{ctx.clpSubject || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Editable unit fields */}
              <div className="clpm-unit-row">
                <div className="clpm-unit-field-chip">
                  <div className="clpm-ctx-icon clpm-ctx-icon--sm"><i className="fa-solid fa-hashtag"></i></div>
                  <div className="clpm-ctx-body">
                    <div className="clpm-ctx-label">Unit No.</div>
                    <input className="clpm-ctx-input" value={unitNo}
                      placeholder="1" type="text" inputMode="numeric"
                      onChange={e => setUnitNo(e.target.value.replace(/[^0-9]/g, ''))} />
                  </div>
                </div>
                <div className="clpm-unit-field-chip clpm-unit-field-chip--grow">
                  <div className="clpm-ctx-icon clpm-ctx-icon--sm"><i className="fa-solid fa-layer-group"></i></div>
                  <div className="clpm-ctx-body" style={{ flex: 1, minWidth: 0 }}>
                    <div className="clpm-ctx-label">Unit Name</div>
                    <input className="clpm-ctx-input" value={unitName}
                      placeholder="Unit name" style={{ width: '100%' }}
                      onChange={e => setUnitName(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Language toggle */}
              <div className="clpm-lang-row">
                <span className="clpm-lang-label">Language</span>
                <div className="clpm-lang-pills">
                  <Tooltip text="Write lesson plan in English">
                    <button className={`clpm-lang-pill${lang === 'en' ? ' active' : ''}`} onClick={() => setLang('en')}>
                      <span className="clpm-lang-flag">🇬🇧</span> English
                    </button>
                  </Tooltip>
                  <Tooltip text="Write lesson plan in Urdu">
                    <button className={`clpm-lang-pill${lang === 'ur' ? ' active' : ''}`} onClick={() => setLang('ur')}>
                      <span className="clpm-lang-flag">🇵🇰</span> اردو
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Lesson details */}
            <div className="clpm-form-area">
              <div className="clpm-step-label">Lesson Details</div>
              <div className="clpm-inputs-row">
                <div className="clpm-field-group">
                  <label className="clpm-field-label">
                    <i className="fa-regular fa-clock" style={{ color: '#94A3B8', fontSize: 10 }}></i>
                    <span>Time Duration</span> <span className="req">*</span>
                  </label>
                  <div className="clpm-input-with-hint">
                    <input className="clpm-input" value={duration}
                      placeholder="e.g. 45" type="text" inputMode="numeric" maxLength="3"
                      onChange={e => setDuration(e.target.value.replace(/[^0-9]/g, ''))} />
                    <span className="clpm-eg">mins</span>
                  </div>
                </div>
                <div className="clpm-field-group">
                  <label className="clpm-field-label">
                    <i className="fa-regular fa-file-lines" style={{ color: '#94A3B8', fontSize: 10 }}></i>
                    <span>Lesson Topic</span> <span className="req">*</span>
                  </label>
                  <input className="clpm-input" value={currentLesson.topic}
                    placeholder="Enter lesson plan topic"
                    onChange={e => updateLesson(selectedIdx, { topic: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Rich text sections */}
            <div className="clpm-sections-area">
              <div className="clpm-step-label" style={{ paddingTop: 4 }}>Lesson Plan Sections</div>
              <div>
                {sections.map((sec, i) => {
                  const timeInput = (
                    <div className="clpm-time-input-wrap" title={isUrdu ? 'وقت منٹوں میں' : 'Enter time in minutes'}>
                      <i className="fa-regular fa-clock clpm-time-icon"></i>
                      <input className="clpm-time-input" type="text" inputMode="numeric" maxLength="3"
                        defaultValue={sec.mins.replace(/[^0-9]/g, '')}
                        onChange={e => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); }}
                        placeholder="0" />
                      <span className="clpm-time-suffix">mins</span>
                    </div>
                  );

                  return (
                    <div key={sec.key} className="clpm-rte-section">
                      {isUrdu ? (
                        <div className="clpm-rte-header clpm-rte-header-ur">
                          {timeInput}
                          <div className="clpm-rte-title-wrap-ur">
                            <span className="clpm-rte-title clpm-rte-title-ur">{sec.title}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="clpm-rte-header">
                          <div className="clpm-rte-title-wrap">
                            <div className={`clpm-rte-section-dot ${DOT_CLASSES[i] || ''}`}></div>
                            <span className="clpm-rte-title">{sec.title}</span>
                            <span className="clpm-rte-hint-text">{sec.hint}</span>
                          </div>
                          {timeInput}
                        </div>
                      )}

                      <div className="clpm-rte-toolbar">
                        {isUrdu && <div className="clpm-rte-hint-ur" style={{ width: '100%', order: -1, flexBasis: '100%', marginBottom: 0 }}>{sec.hint}</div>}
                        <Tooltip text="Undo"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('undo')}><i className="fa-solid fa-rotate-left"></i></button></Tooltip>
                        <Tooltip text="Redo"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('redo')}><i className="fa-solid fa-rotate-right"></i></button></Tooltip>
                        <div className="clpm-tb-divider"></div>
                        <Tooltip text="Font size"><select className="clpm-tb-select"
                          defaultValue=""
                          onChange={e => { exec('fontSize', e.target.value); e.target.value = ''; }}>
                          <option value="">Size</option>
                          <option value="1">Small</option>
                          <option value="3">Normal</option>
                          <option value="4">Large</option>
                          <option value="5">X-Large</option>
                        </select></Tooltip>
                        <div className="clpm-tb-divider"></div>
                        <Tooltip text="Bold (Ctrl+B)"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')}><b>B</b></button></Tooltip>
                        <Tooltip text="Underline (Ctrl+U)"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')}><u>U</u></button></Tooltip>
                        <Tooltip text="Italic (Ctrl+I)"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')}><i>I</i></button></Tooltip>
                        <Tooltip text="Strikethrough"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('strikeThrough')}><s>S</s></button></Tooltip>
                        <Tooltip text="Text Color"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()}
                          onClick={() => { const c = window.prompt('Color (e.g. #DC2626)', '#DC2626'); if (c) exec('foreColor', c); }}
                          style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', textDecoration: 'underline', textDecorationColor: '#DC2626' }}>A</button></Tooltip>
                        <div className="clpm-tb-divider"></div>
                        <Tooltip text="Align left"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyLeft')}><i className="fa-solid fa-align-left"></i></button></Tooltip>
                        <Tooltip text="Align center"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyCenter')}><i className="fa-solid fa-align-center"></i></button></Tooltip>
                        <Tooltip text="Align right"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('justifyRight')}><i className="fa-solid fa-align-right"></i></button></Tooltip>
                        <div className="clpm-tb-divider"></div>
                        <Tooltip text="Numbered list"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertOrderedList')}><i className="fa-solid fa-list-ol"></i></button></Tooltip>
                        <Tooltip text="Bullet list"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={() => exec('insertUnorderedList')}><i className="fa-solid fa-list-ul"></i></button></Tooltip>
                        <Tooltip text="Insert table"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={insertTable}><i className="fa-solid fa-table-cells"></i></button></Tooltip>
                        <div className="clpm-tb-divider"></div>
                        <Tooltip text="Insert link"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()} onClick={insertLink}><i className="fa-solid fa-link"></i></button></Tooltip>
                        <Tooltip text="Insert image"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()}
                          onClick={() => { const u = window.prompt('Image URL'); if (u) exec('insertImage', u); }}>
                          <i className="fa-regular fa-image"></i>
                        </button></Tooltip>
                        <Tooltip text="Insert math formula"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()}
                          onClick={() => { const f = window.prompt('Formula'); if (f) document.execCommand('insertHTML', false, `<span style="font-family:'Cambria Math',serif">${f}</span>`); }}
                          style={{ fontWeight: 800, fontSize: 14 }}>∑</button></Tooltip>
                        <div className="clpm-tb-divider"></div>
                        <Tooltip text="Clear formatting"><button className="clpm-tb-btn" onMouseDown={e => e.preventDefault()}
                          onClick={() => exec('removeFormat')}
                          style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Clear</button></Tooltip>
                      </div>

                      <div
                        ref={el => (editorRefs.current[sec.key] = el)}
                        className="clpm-editor"
                        contentEditable
                        suppressContentEditableWarning
                        dir={dir}
                        spellCheck={false}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="clpm-footer">
          <div className="clpm-footer-hint">
            <i className="fa-solid fa-circle-info" style={{ color: '#94A3B8', fontSize: 12 }}></i>
            Fill all sections before saving
          </div>
          <div className="clpm-footer-btns">
            <button className="clpm-btn clpm-btn--cancel" onClick={onClose}>Close</button>
            <button className="clpm-btn clpm-btn--save" onClick={saveAndClose}>
              <i className="fa-solid fa-floppy-disk"></i> Save &amp; Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NOTEBOOK — ADD QUESTIONS MODAL — verbatim from HTML (.aq-modal)
   ═══════════════════════════════════════════════════════════════════ */
function NbAQModal({ ctx, unit, onSave, onClose, toast }) {
  const [activeType, setActiveType] = useState(null);
  const [mainQ, setMainQ] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!ctx) return;
    /* edit-mode: ctx.qId pre-selects the existing question */
    const existing = ctx.qId && unit ? unit.questions.find(x => x.id === ctx.qId) : null;
    /* Resolve type id: prefer existing.typeId, fall back to matching the type label
       against AQ_CONFIG title (handles older saved entries that lacked typeId). */
    let resolvedTypeId = null;
    if (existing) {
      if (existing.typeId && AQ_CONFIG[existing.typeId]) resolvedTypeId = existing.typeId;
      else if (existing.type) {
        const hit = Object.entries(AQ_CONFIG).find(([, cfg]) => cfg.title === existing.type);
        if (hit) resolvedTypeId = hit[0];
      }
    }
    if (existing && resolvedTypeId) {
      setActiveType(resolvedTypeId);
      setMainQ(existing.mainQ || existing.mainQuestion || '');
      const seeded = (existing.rows && existing.rows.length)
        ? JSON.parse(JSON.stringify(existing.rows)).map(r =>
            r._id ? r : { ...r, _id: `aqr_${++_aqRowCounter}` })
        : [aqEmptyRow(resolvedTypeId)];
      setRows(seeded);
    } else {
      setActiveType(null);
      setMainQ('');
      setRows([]);
    }
  }, [ctx, unit]);

  if (!ctx) return null;

  const isEdit = !!ctx.qId;
  const cfg = activeType ? AQ_CONFIG[activeType] : null;

  const selectType = id => {
    setActiveType(id);
    setRows([aqEmptyRow(id)]);
  };

  const updateRow = (i, key, val) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const addRow = () => {
    if (!activeType) return;
    setRows(rs => [...rs, aqEmptyRow(activeType)]);
  };

  const removeRow = i => {
    if (rows.length <= 1) { toast('At least one row required', 'error'); return; }
    setRows(rs => rs.filter((_, idx) => idx !== i));
    toast('Row removed', 'info');
  };

  const saveAll = () => {
    if (!activeType) { toast('Select a question type first', 'error'); return; }
    const typeLabel = AQ_TYPES.find(t => t.id === activeType)?.label || cfg.title;
    const payload = {
      typeId: activeType,
      type: cfg.title || typeLabel,
      mainQ: mainQ.trim() || '(Main Question)',
      mainQuestion: mainQ.trim() || '(Main Question)',
      rows: JSON.parse(JSON.stringify(rows)),
      items: rows,
      source: 'manual',
    };
    if (isEdit) onSave(ctx.unitId, ctx.qId, payload);
    else        onSave(ctx.unitId, payload);
  };

  const addMoreLabel = activeType === 'stories' ? '+ Add More Stories' : '+ Add More';

  return (
    <div className="aq-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aq-modal">

        {/* ── Header ── */}
        <div className="aq-header">
          <div className="aq-header-left">
            <div className="aq-header-icon"><i className="fa-solid fa-circle-question"></i></div>
            <div>
              <div className="aq-title">{isEdit ? (cfg?.title || 'Edit Questions') : 'Add Questions'}</div>
              <div className="aq-sub">{unit ? `${unit.unitName} — Unit ${unit.unitNo}` : 'Select unit to add questions'}</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="aq-close-hover" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>

        {/* ── Body ── */}
        <div className="aq-body">

          {/* Type selector — hidden in edit mode (matches HTML's nbEditSection) */}
          {!isEdit && (
            <div className="aq-type-section">
              <div className="aq-type-label">Select Question Field</div>
              <div className="aq-types-grid">
                {AQ_TYPES.map(t => (
                  <button
                    key={t.id}
                    className={`aq-type-btn-hover${activeType === t.id ? ' active' : ''}`}
                    onClick={() => selectType(t.id)}
                  >
                    <i className={`fa-solid ${t.icon}`} style={{ fontSize: 11 }}></i> {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form area */}
          {activeType && cfg && (
            <div className="aq-form-area">
              <div style={{ background: '#fff', borderRadius: 18, border: '1.5px solid #BAE6FD', boxShadow: '0 4px 20px rgba(6,182,212,.08)', overflow: 'hidden' }}>
                <div style={{ padding: '20px 22px 16px', borderBottom: '1.5px solid #E0F9FF', background: 'linear-gradient(135deg,#F0F9FF,#E0F2FE)' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, color: '#0C4A6E', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ display: 'inline-block', width: 4, height: 20, background: 'linear-gradient(#0369A1,#06B6D4)', borderRadius: 2, flexShrink: 0 }}></span>
                    {cfg.title}
                  </div>

                  {cfg.layout === 'comprehension' && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>Comprehension Statement</div>
                      <textarea
                        rows="4"
                        style={{ boxSizing: 'border-box', width: '100%', border: '2px solid #BAE6FD', borderRadius: 13, padding: '10px 16px', fontFamily: 'inherit', fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                        placeholder="Enter comprehension statement here…"
                        value={mainQ}
                        onChange={e => setMainQ(e.target.value)}
                      />
                    </>
                  )}

                  {cfg.layout !== 'comprehension' && (
                    <>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>Main Question</div>
                      <input
                        type="text"
                        className="aq-mq-input"
                        placeholder="Enter main question"
                        value={mainQ}
                        onChange={e => setMainQ(e.target.value)}
                      />
                    </>
                  )}
                </div>

                {cfg.layout === 'comprehension' && (
                  <div style={{ padding: '12px 22px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 7 }}>Main Question</div>
                    <input
                      type="text"
                      className="aq-mq-input"
                      placeholder="Enter main question"
                      value={mainQ}
                      onChange={e => setMainQ(e.target.value)}
                    />
                  </div>
                )}

                <div style={{ padding: '14px 18px 4px' }}>
                  {rows.map((row, i) => (
                    <AqRow
                      key={row._id || i}
                      i={i}
                      cfg={cfg}
                      row={row}
                      typeId={activeType}
                      onChange={(k, v) => updateRow(i, k, v)}
                      onRemove={() => removeRow(i)}
                      onSaveRow={() => toast(`Row ${i + 1} saved`, 'success')}
                    />
                  ))}
                </div>

                <div style={{ padding: '12px 22px 18px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #E0F2FE' }}>
                  <button className="aq-add-more-hover" onClick={addRow}>{addMoreLabel}</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="aq-footer" style={{ display: 'flex', gap: 12, padding: '14px 24px 18px', borderTop: '2px solid #E0F2FE', background: '#fff', flexShrink: 0 }}>
          <button onClick={onClose} className="aq-cancel-hover">Cancel</button>
          <button onClick={saveAll} className="aq-save-all-hover">
            <i className="fa-solid fa-floppy-disk"></i> Save Questions
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Single AQ row — renders the correct layout per type ─── */
/* Stable contenteditable field — initialises innerHTML once and commits on input/blur
   without re-writing the DOM (so the caret doesn't jump). */
function AqRte({ initial, ph, onCommit }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (initial || '')) {
      ref.current.innerHTML = initial || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-ph={ph}
      style={{ minHeight: 70, padding: '10px 13px', fontSize: 14, color: '#0F172A', lineHeight: 1.6, outline: 'none', border: '1.5px solid #CBD5E1', borderRadius: 10, background: '#fff', transition: 'border-color .18s, box-shadow .18s', fontFamily: 'inherit' }}
      onFocus={e => { e.target.style.borderColor = '#0891B2'; e.target.style.boxShadow = '0 0 0 3px rgba(6,182,212,.12)'; }}
      onBlur={e => { e.target.style.borderColor = '#CBD5E1'; e.target.style.boxShadow = 'none'; onCommit(e.currentTarget.innerHTML); }}
      onInput={e => onCommit(e.currentTarget.innerHTML)}
    />
  );
}

function AqRow({ i, cfg, row, typeId, onChange, onRemove, onSaveRow }) {
  const NUM_S  = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg,#0369A1,#0891B2)', color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0 };
  const LABEL  = { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.5px', display: 'block', marginBottom: 5 };
  const ACT_S  = { display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTop: '1px dashed #E0F2FE' };

  const num  = <span style={NUM_S}>#{i + 1}</span>;
  const lbl  = t => <span style={LABEL}>{t}</span>;

  const inp = (key, ph, extra) => (
    <input
      type="text"
      className="aq-inp-hover"
      style={extra}
      placeholder={ph}
      value={row[key] || ''}
      onChange={e => onChange(key, e.target.value)}
    />
  );
  const ta = (key, ph, rows = 3) => (
    <textarea
      className="aq-ta-hover"
      rows={rows}
      placeholder={ph}
      value={row[key] || ''}
      onChange={e => onChange(key, e.target.value)}
    />
  );
  const rte = (key, ph) => (
    <AqRte initial={row[key] || ''} ph={ph} onCommit={html => onChange(key, html)} />
  );
  const acts = (
    <div style={ACT_S}>
      <button type="button" className="aq-rb-btn" onClick={onRemove}>
        <i className="fa-solid fa-trash-can"></i> Remove
      </button>
      <button type="button" className="aq-sb-btn" onClick={onSaveRow}>
        <i className="fa-solid fa-floppy-disk"></i> Save
      </button>
    </div>
  );

  /* 1. TWO-COL */
  if (cfg.layout === 'two-col') {
    const f0 = cfg.fields[0], f1 = cfg.fields[1];
    const arrow = cfg.arrow || '↔';
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          {num}
          <div style={{ flex: 1, minWidth: 0 }}>{lbl(f0.label)}{inp(f0.key, f0.ph)}</div>
          <div style={{ fontSize: 22, color: '#0891B2', paddingBottom: 10, flexShrink: 0 }}>{arrow}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{lbl(f1.label)}{inp(f1.key, f1.ph)}</div>
        </div>
        {acts}
      </div>
    );
  }

  /* 2. WORD SENTENCES */
  if (cfg.layout === 'word-sentence') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {num}
          <div style={{ flex: '0 0 160px' }}>{lbl('Word')}{inp('word', 'Enter word', { height: 40 })}</div>
          <div style={{ fontSize: 18, color: '#94A3B8', paddingTop: 28, flexShrink: 0 }}>→</div>
          <div style={{ flex: 1, minWidth: 0 }}>{lbl('Sentence')}{ta('sentence', 'Write a sentence using this word…', 3)}</div>
        </div>
        {acts}
      </div>
    );
  }

  /* 3. MCQ */
  if (cfg.layout === 'mcq') {
    const opts = [['opt1', 'A', '#0369A1', '#EFF6FF'], ['opt2', 'B', '#6D28D9', '#F5F3FF'], ['opt3', 'C', '#0C4A6E', '#EFF9FF'], ['opt4', 'D', '#92400E', '#FFFBEB']];
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {num}{inp('question', 'Enter question text…', { flex: 1 })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {opts.map(([key, letter, col, bg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', borderRadius: 10, border: `1.5px solid ${col}22`, overflow: 'hidden', height: 44 }}>
              <span style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: col, color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{letter}</span>
              <input
                type="text"
                style={{ flex: 1, height: 44, border: 'none', background: bg, padding: '0 10px', fontFamily: 'inherit', fontSize: 13, color: '#0F172A', outline: 'none' }}
                placeholder={`Option ${letter}`}
                value={row[key] || ''}
                onChange={e => onChange(key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#F0FDF4', borderRadius: 10, border: '1.5px solid #BBF7D0' }}>
          <i className="fa-solid fa-circle-check" style={{ color: '#16A34A', fontSize: 13, flexShrink: 0 }}></i>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', whiteSpace: 'nowrap' }}>CORRECT ANSWER</span>
          <input
            type="text"
            style={{ boxSizing: 'border-box', display: 'block', width: '100%', height: 36, border: '1.5px solid #16A34A', borderRadius: 10, padding: '0 13px', fontFamily: 'inherit', fontSize: 14, color: '#0F172A', background: '#F0FDF4', outline: 'none', flex: 1 }}
            placeholder="A / B / C / D or exact text"
            value={row.correct || ''}
            onChange={e => onChange('correct', e.target.value)}
          />
        </div>
        {acts}
      </div>
    );
  }

  /* 4. FILL IN THE BLANKS */
  if (cfg.layout === 'fill-blanks') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{num}{lbl('Statement (use ___ for blank)')}</div>
        {ta('question', 'Write the statement here. Use ___ where the blank should be…', 3)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 12px', background: '#F0F9FF', borderRadius: 10 }}>
          <i className="fa-solid fa-key" style={{ color: '#0891B2', fontSize: 13, flexShrink: 0 }}></i>
          {lbl('Blank Answer:')}
          <input
            type="text"
            style={{ boxSizing: 'border-box', display: 'block', width: '100%', maxWidth: 220, height: 36, border: '1.5px solid #0891B2', borderRadius: 10, padding: '0 13px', fontFamily: 'inherit', fontSize: 14, color: '#0F172A', background: '#fff', outline: 'none' }}
            placeholder="One word…"
            value={row.answer || ''}
            onChange={e => onChange('answer', e.target.value)}
          />
        </div>
        {acts}
      </div>
    );
  }

  /* 5. TRUE / FALSE */
  if (cfg.layout === 'true_false') {
    const tActive = row.answer === 'true';
    const fActive = row.answer === 'false';
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {num}{inp('question', 'Write the statement — students mark True or False…', { flex: 1 })}
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
          <button onClick={() => onChange('answer', 'true')} className={`aq-tf-t-hover${tActive ? ' sel' : ''}`}><i className="fa-solid fa-check"></i> True</button>
          <button onClick={() => onChange('answer', 'false')} className={`aq-tf-f-hover${fActive ? ' sel' : ''}`}><i className="fa-solid fa-xmark"></i> False</button>
        </div>
        <div style={{ fontSize: 11.5, color: '#94A3B8', fontStyle: 'italic' }}>
          {row.answer
            ? <>Answer marked: <strong style={{ color: '#334155' }}>{tActive ? 'True' : 'False'}</strong></>
            : 'Click True or False to mark the correct answer'}
        </div>
        {acts}
      </div>
    );
  }

  /* 6. MATCH THE COLUMNS */
  if (cfg.layout === 'match') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {num}
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#0369A1', textTransform: 'uppercase', letterSpacing: '.5px' }}>Column A</div>
          <div style={{ fontSize: 18, color: '#94A3B8', flexShrink: 0 }}>↔</div>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '.5px' }}>Column B (Correct Match)</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>{inp('colA', 'e.g. Apple, Cat, Big…', { borderColor: '#BAE6FD' })}</div>
          <div style={{ fontSize: 20, color: '#94A3B8', flexShrink: 0 }}>↔</div>
          <div style={{ flex: 1 }}>{inp('colB', 'e.g. Fruit, Animal, Small…', { borderColor: '#C4B5FD' })}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11.5, color: '#64748B', background: '#F0F9FF', borderRadius: 9, padding: '9px 12px', lineHeight: 1.5, marginBottom: 4 }}>
          <i className="fa-solid fa-circle-info" style={{ color: '#0891B2', fontSize: 11, flexShrink: 0, marginTop: 2 }}></i>
          <span>Correct matching shown here for setup. While writing on board, shuffle Column B manually.</span>
        </div>
        {acts}
      </div>
    );
  }

  /* 7. SHORT QUESTIONS */
  if (cfg.layout === 'short-q') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {num}<span style={{ fontSize: 13, fontWeight: 700, color: '#0369A1' }}>{aqOrdinal(i + 1)} Question</span>
        </div>
        {lbl('Question')}{rte('question', 'Write the question here…')}
        <div style={{ marginTop: 12 }}>{lbl('Answer')}{rte('answer', 'Write the answer here…')}</div>
        {acts}
      </div>
    );
  }

  /* 8. CIRCLE THE CORRECT WORD */
  if (cfg.layout === 'circle') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{num}{lbl('Statement / Sentence with word choices')}</div>
        {inp('statement', 'e.g. The cat is (big / small / tall).', { marginBottom: 10 })}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 10, padding: 12, background: '#F0F9FF', borderRadius: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(6,182,212,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0891B2', fontSize: 16, flexShrink: 0, marginTop: 18 }}>
            <i className="fa-regular fa-circle-dot"></i>
          </div>
          <div style={{ flex: 1 }}>
            {lbl('Correct Word to Circle')}
            {inp('answer', 'Type the correct word…', { borderColor: '#0891B2', height: 40 })}
          </div>
        </div>
        {acts}
      </div>
    );
  }

  /* 9. PUNCTUATION */
  if (cfg.layout === 'punctuation') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{num}{lbl('Unpunctuated Sentence')}</div>
        {ta('question', 'Write the sentence without punctuation (e.g. the cat sat on the mat it was happy)', 2)}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 10, padding: 10, background: '#F0F9FF', borderRadius: 10 }}>
          <i className="fa-solid fa-pen-nib" style={{ color: '#0891B2', fontSize: 13, flexShrink: 0, marginTop: 4 }}></i>
          <div style={{ flex: 1 }}>
            {lbl('Correctly Punctuated (Answer)')}
            {ta('answer', 'Write the correctly punctuated sentence…', 2)}
          </div>
        </div>
        {acts}
      </div>
    );
  }

  /* 10. LONG QUESTION */
  if (cfg.layout === 'long') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {num}<span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Question {i + 1}</span>
        </div>
        {lbl('Question')}{rte('question', 'Write the long question here…')}
        <div style={{ marginTop: 12 }}>{lbl('Answer / Model Answer')}{rte('answer', 'Write the detailed model answer here…')}</div>
        {acts}
      </div>
    );
  }

  /* VERTICAL-EXPAND (Stories, Essays, Letter, Application, Paragraph) */
  if (cfg.layout === 'vertical-expand') {
    const rowLabel = typeId === 'stories' ? (
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0369A1', marginBottom: 12, padding: '7px 12px', background: 'rgba(3,105,161,.06)', borderLeft: '3px solid #0891B2', borderRadius: '0 9px 9px 0' }}>Story {i + 1}</div>
    ) : typeId === 'essays' ? (
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0369A1', marginBottom: 12, padding: '7px 12px', background: 'rgba(3,105,161,.06)', borderLeft: '3px solid #0891B2', borderRadius: '0 9px 9px 0' }}>Essay {i + 1}</div>
    ) : null;
    return (
      <div className="aq-row-card-hover">
        {rowLabel}
        {(cfg.fields || []).map(f => (
          <div key={f.key} style={{ marginBottom: 12 }}>
            {f.label ? lbl(f.label) : null}
            {f.rte ? rte(f.key, f.ph) : ta(f.key, f.ph)}
          </div>
        ))}
        {acts}
      </div>
    );
  }

  /* COMPREHENSION row */
  if (cfg.layout === 'comprehension') {
    return (
      <div className="aq-row-card-hover">
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0369A1', marginBottom: 12, padding: '7px 12px', background: 'rgba(3,105,161,.06)', borderLeft: '3px solid #0891B2', borderRadius: '0 9px 9px 0' }}>{aqOrdinal(i + 1)} Question</div>
        {lbl('Question')}{rte('question', 'Enter question…')}
        <div style={{ marginTop: 12 }}>{lbl('Answer')}{rte('answer', 'Enter answer…')}</div>
        {acts}
      </div>
    );
  }

  return (
    <div className="aq-row-card-hover">
      <div style={{ padding: 12, color: '#94A3B8' }}>—</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORT PICKER (mini — Color / B&W) for LP reports
   ═══════════════════════════════════════════════════════════════════ */
function LpReportPicker({ cfg, onClose, onGenerate }) {
  const [style, setStyle] = useState('color');
  const [fmt, setFmt] = useState('pdf');

  useEffect(() => {
    if (cfg) {
      setStyle('color');
      setFmt(cfg.format || 'pdf');
    }
  }, [cfg]);

  /* Keyboard radio-group nav: matches the Academics picker so users get
     the same affordance everywhere. */
  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')   { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  if (!cfg) return null;
  return (
    <div
      className="lp-overlay open"
      style={{ zIndex: 4000 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-rp-title"
    >
      <div className="lp-modal" style={{ maxWidth: 460 }}>
        <div className="lp-modal-header">
          <div className="lp-modal-title-row">
            <div className="lp-modal-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="lp-modal-title" id="lp-rp-title">Download Report</div>
              <div className="lp-modal-sub">{cfg.name} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="lp-modal-close" onClick={onClose} aria-label="Close download dialog"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="lp-modal-body">
          <div className="rp-options" role="radiogroup" aria-label="Report style">
            <div
              className={`rp-option${style === 'color' ? ' selected' : ''}`}
              onClick={() => setStyle('color')}
              role="radio"
              aria-checked={style === 'color'}
              tabIndex={style === 'color' ? 0 : -1}
              onKeyDown={e => onStyleKey(e, 'color')}
            >
              <div className="rp-check" aria-hidden="true"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview" aria-hidden="true">
                <div className="rp-preview-color">
                  <div className="rp-mock-header"></div>
                  <div className="rp-mock-line" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line" style={{ width: '50%', height: 5 }}></div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6 }}></i>Colorful Report
                </div>
                <div className="rp-option-desc">Branded headings, summary cards &amp; color tags</div>
              </div>
            </div>
            <div
              className={`rp-option${style === 'bw' ? ' selected' : ''}`}
              onClick={() => setStyle('bw')}
              role="radio"
              aria-checked={style === 'bw'}
              tabIndex={style === 'bw' ? 0 : -1}
              onKeyDown={e => onStyleKey(e, 'bw')}
            >
              <div className="rp-check" aria-hidden="true"><i className="fa-solid fa-check"></i></div>
              <div className="rp-preview" aria-hidden="true">
                <div className="rp-preview-bw">
                  <div className="rp-mock-header-bw"></div>
                  <div className="rp-mock-line-bw" style={{ width: '65%', height: 5 }}></div>
                  <div className="rp-mock-line-bw" style={{ width: '50%', height: 5 }}></div>
                </div>
              </div>
              <div className="rp-option-text">
                <div className="rp-option-name">
                  <i className="fa-solid fa-circle-half-stroke" style={{ marginRight: 6 }}></i>Colorless Report
                </div>
                <div className="rp-option-desc">Low-ink layout — white background, light borders only</div>
              </div>
            </div>
          </div>
          <div className="rp-format-row" style={{ marginTop: 8 }}>
            <button className={`rp-format-pill${fmt === 'pdf' ? ' selected-pdf' : ''}`} onClick={() => setFmt('pdf')}>
              <div className="rp-format-icon"><i className="fa-solid fa-file-pdf"></i></div>
              <div>
                <div className="rp-format-name">PDF</div>
                <div className="rp-format-desc">Best for sharing</div>
              </div>
            </button>
            <button className={`rp-format-pill${fmt === 'word' ? ' selected-word' : ''}`} onClick={() => setFmt('word')}>
              <div className="rp-format-icon"><i className="fa-brands fa-microsoft"></i></div>
              <div>
                <div className="rp-format-name">Word (.docx)</div>
                <div className="rp-format-desc">Best for editing</div>
              </div>
            </button>
          </div>
        </div>
        <div className="lp-modal-footer">
          <Tooltip text="Cancel and close">
            <button className="lp-btn ghost" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Download the selected report">
            <button className="lp-btn primary" onClick={() => onGenerate(style, fmt)}>
              <i className="fa-solid fa-download"></i> Download {style === 'color' ? 'Colorful' : 'Colorless'} {fmt.toUpperCase()}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORT GENERATORS — verbatim from HTML
   (tbGenerateReport, generateCardReport, lpOpenReport)
   ═══════════════════════════════════════════════════════════════════ */

/* LP_SUBJECTS map — verbatim from HTML (keys re-mapped to React class labels) */
const LP_SUBJECTS = {
  'Nursery':         [{ name:'English', lessons:20 },{ name:'Urdu', lessons:18 },{ name:'Math', lessons:16 },{ name:'Drawing', lessons:8 }],
  'KG-1':            [{ name:'English', lessons:22 },{ name:'Urdu', lessons:20 },{ name:'Math', lessons:18 },{ name:'Science', lessons:10 },{ name:'Drawing', lessons:6 }],
  'KG-2':            [{ name:'English', lessons:22 },{ name:'Urdu', lessons:20 },{ name:'Math', lessons:18 },{ name:'Science', lessons:12 },{ name:'SST', lessons:8 }],
  'Class I':         [{ name:'English', lessons:24 },{ name:'Urdu', lessons:22 },{ name:'Math', lessons:20 },{ name:'Science', lessons:14 },{ name:'SST', lessons:10 },{ name:'Islamiat', lessons:6 }],
  'Class II':        [{ name:'English', lessons:24 },{ name:'Urdu', lessons:22 },{ name:'Math', lessons:20 },{ name:'Science', lessons:14 },{ name:'SST', lessons:10 },{ name:'Islamiat', lessons:6 }],
  'Class III':       [{ name:'English', lessons:22 },{ name:'Urdu', lessons:20 },{ name:'Math', lessons:18 },{ name:'Science', lessons:16 },{ name:'SST', lessons:12 },{ name:'Islamiat', lessons:6 },{ name:'Computer', lessons:4 }],
  'Class IV':        [{ name:'English', lessons:22 },{ name:'Urdu', lessons:20 },{ name:'Math', lessons:18 },{ name:'Science', lessons:16 },{ name:'SST', lessons:12 },{ name:'Islamiat', lessons:6 },{ name:'Computer', lessons:4 }],
  'Class V':         [{ name:'English', lessons:22 },{ name:'Urdu', lessons:20 },{ name:'Math', lessons:18 },{ name:'Science', lessons:16 },{ name:'SST', lessons:12 },{ name:'Islamiat', lessons:6 },{ name:'Computer', lessons:4 }],
  'Class VI':        [{ name:'English', lessons:20 },{ name:'Urdu', lessons:18 },{ name:'Math', lessons:20 },{ name:'Science', lessons:18 },{ name:'SST', lessons:14 },{ name:'Islamiat', lessons:8 },{ name:'Computer', lessons:6 }],
  'Class VII':       [{ name:'English', lessons:20 },{ name:'Urdu', lessons:18 },{ name:'Math', lessons:20 },{ name:'Science', lessons:18 },{ name:'SST', lessons:14 },{ name:'Islamiat', lessons:8 },{ name:'Computer', lessons:6 }],
  'Class VIII':      [{ name:'English', lessons:20 },{ name:'Urdu', lessons:18 },{ name:'Math', lessons:20 },{ name:'Science', lessons:18 },{ name:'SST', lessons:14 },{ name:'Islamiat', lessons:8 },{ name:'Computer', lessons:6 }],
  'Class IX Sci':    [{ name:'English', lessons:18 },{ name:'Urdu', lessons:16 },{ name:'Math', lessons:20 },{ name:'Physics', lessons:18 },{ name:'Chemistry', lessons:18 },{ name:'Biology', lessons:18 },{ name:'Computer', lessons:6 },{ name:'Islamiat', lessons:6 }],
  'Class IX Arts':   [{ name:'English', lessons:18 },{ name:'Urdu', lessons:18 },{ name:'Math', lessons:18 },{ name:'History', lessons:16 },{ name:'Civics', lessons:14 },{ name:'Islamiat', lessons:8 },{ name:'Pak-Studies', lessons:8 }],
  'Class X Sci':     [{ name:'English', lessons:18 },{ name:'Urdu', lessons:16 },{ name:'Math', lessons:20 },{ name:'Physics', lessons:18 },{ name:'Chemistry', lessons:18 },{ name:'Biology', lessons:18 },{ name:'Computer', lessons:6 }],
  'Class X Arts':    [{ name:'English', lessons:18 },{ name:'Urdu', lessons:18 },{ name:'Math', lessons:18 },{ name:'History', lessons:16 },{ name:'Civics', lessons:14 },{ name:'Islamiat', lessons:8 },{ name:'Pak-Studies', lessons:8 }],
  'FSc I Pre-Med':   [{ name:'English', lessons:16 },{ name:'Urdu', lessons:14 },{ name:'Physics', lessons:20 },{ name:'Chemistry', lessons:20 },{ name:'Biology', lessons:20 },{ name:'Math', lessons:14 }],
  'FSc I Pre-Eng':   [{ name:'English', lessons:16 },{ name:'Urdu', lessons:14 },{ name:'Physics', lessons:20 },{ name:'Chemistry', lessons:20 },{ name:'Math', lessons:22 },{ name:'Computer', lessons:12 }],
  'FSc II Pre-Med':  [{ name:'English', lessons:16 },{ name:'Urdu', lessons:14 },{ name:'Physics', lessons:20 },{ name:'Chemistry', lessons:20 },{ name:'Biology', lessons:20 },{ name:'Math', lessons:14 }],
  'FSc II Pre-Eng':  [{ name:'English', lessons:16 },{ name:'Urdu', lessons:14 },{ name:'Physics', lessons:20 },{ name:'Chemistry', lessons:20 },{ name:'Math', lessons:22 },{ name:'Computer', lessons:12 }],
  'O-Levels':        [{ name:'English', lessons:18 },{ name:'Math', lessons:20 },{ name:'Physics', lessons:18 },{ name:'Chemistry', lessons:18 },{ name:'Biology', lessons:18 },{ name:'Computer', lessons:10 },{ name:'Pak-Studies', lessons:8 },{ name:'Islamiat', lessons:6 }],
};

/* TB_DATA lazy init — verbatim from HTML */
const TB_DATA = {};
function tbInit() {
  if (Object.keys(TB_DATA).length) return;
  Object.keys(LP_SUBJECTS).forEach(cls => {
    TB_DATA[cls] = {};
    ['2nd','3rd Term','5th Term','testing','combined'].forEach(term => {
      TB_DATA[cls][term] = {};
      (LP_SUBJECTS[cls]||[]).forEach(s => {
        TB_DATA[cls][term][s.name] = [
          { unitNum:'1', unitName:'Unit 1 – '+s.name, weeksRequired:'2', topics:[
            { subTopic:'Introduction to '+s.name, periodsRequired:'12' },
            { subTopic:'Core Concepts', periodsRequired:'10' },
          ]},
        ];
      });
    });
  });
}

/* ─── School branding helpers — verbatim from HTML ─── */
function getSchoolName(){
  return document.querySelector('.school-name')?.textContent?.trim() || 'The Oxford System, Lahore Campus';
}
function getSchoolInitials(){
  const n = getSchoolName();
  return n.split(/[\s,]+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
}
function getReportLogo(style) {
  const uid = Date.now();
  const schoolName  = getSchoolName();
  const initials    = getSchoolInitials();
  const isColor     = style === 'color';
  const grad1       = isColor ? '#1a237e' : '#2C2C2C';
  const grad2       = isColor ? '#283593' : '#555';

  const logoSvg = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="lg${uid}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop stop-color="${grad1}"/>
        <stop offset="1" stop-color="${grad2}"/>
      </linearGradient>
    </defs>
    <rect width="64" height="64" rx="16" fill="url(#lg${uid})"/>
    <path d="M32 18C25.5 18 18 20.2 18 20.2L18 46C18 46 25.5 43.8 32 43.8C38.5 43.8 46 46 46 46L46 20.2C46 20.2 38.5 18 32 18Z"
      fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
    <path d="M32 18L32 43.8" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
    <path d="M23 17L26 11L32 15L38 11L41 17" stroke="#FCD34D" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="20" y1="27" x2="30" y2="26.2" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
    <line x1="20" y1="33" x2="30" y2="32.2" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
    <line x1="20" y1="39" x2="30" y2="38.2" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/>
    <line x1="34" y1="26.2" x2="44" y2="27" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
    <line x1="34" y1="32.2" x2="44" y2="33" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>
    <line x1="34" y1="38.2" x2="44" y2="39" stroke="rgba(255,255,255,0.3)" stroke-width="1.2"/>
    <text x="32" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" fill="rgba(255,255,255,0.9)">${initials}</text>
  </svg>`;

  return `
  <div style="display:flex;align-items:center;gap:18px;position:relative;z-index:2">
    <div style="width:64px;height:64px;border-radius:16px;overflow:hidden;flex-shrink:0;
      box-shadow:0 4px 18px rgba(0,0,0,.35),0 0 0 2px rgba(255,255,255,.15)">
      ${logoSvg}
    </div>
    <div>
      <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;
        color:rgba(255,255,255,.55);font-weight:700;margin-bottom:3px">School Mentor ERP</div>
      <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-.02em;
        line-height:1.2;text-shadow:0 1px 4px rgba(0,0,0,.2)">${schoolName}</div>
    </div>
  </div>
  <div style="height:1px;background:rgba(255,255,255,.2);margin:18px 0 16px;position:relative;z-index:2"></div>`;
}

/* ═══════════════════════════════════════════════════════════════════
   TERM BREAKUP REPORT — verbatim from HTML tbGenerateReport
   ═══════════════════════════════════════════════════════════════════ */
function tbGenerateReport(cls, style) {
  tbInit();
  const isColor = style === 'color' || style === 'word-color';
  const isWord  = style === 'word-color' || style === 'word-bw';
  const styleLabel = isColor ? 'Colorful' : 'Colorless';
  const typeLabel  = isWord  ? 'Word'  : 'PDF';

  const hdrBg = isColor
    ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 55%,#1D4ED8 100%)'
    : 'linear-gradient(135deg,#2C2C2C 0%,#3D3D3D 55%,#555 100%)';
  const textD   = isColor ? '#0F172A' : '#111';
  const textM   = isColor ? '#64748B' : '#555';
  const border  = isColor ? '#BFDBFE' : '#CCC';
  const tHead   = isColor ? '#EFF6FF' : '#EAEAEA';
  const rowAlt  = isColor ? '#F8FAFF' : '#F5F5F5';
  const accent  = isColor ? '#1E40AF' : '#444';
  const unitHdr = isColor ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : 'linear-gradient(135deg,#3D3D3D,#555)';
  const terms   = ['2nd', '3rd Term', '5th Term', 'testing', 'combined'];

  /* Build per-subject sections with ALL units shown per term */
  const subjectsHtml = (LP_SUBJECTS[cls] || []).map(s => {
    const termSections = terms.map(term => {
      const units = TB_DATA[cls]?.[term]?.[s.name] || [];
      if (!units.length) return '';

      /* Each unit gets its own table */
      const unitTables = units.map((u, ui) => {
        const totalPeriods = u.topics.reduce((a, tp) => a + (parseInt(tp.periodsRequired)||0), 0);
        const rows = u.topics.map((tp, ti) => `
          <tr style="background:${ti%2===0?'white':rowAlt}">
            <td style="padding:9px 13px;border:1px solid ${border};color:${textM};text-align:center;font-weight:600">${ti+1}</td>
            <td style="padding:9px 13px;border:1px solid ${border};color:${textM}">${tp.subTopic}</td>
            <td style="padding:9px 13px;border:1px solid ${border};color:${textD};font-weight:800;text-align:center;font-size:14px">${tp.periodsRequired}</td>
          </tr>`).join('');

        return `
          <div style="margin-bottom:14px;border-radius:10px;overflow:hidden;border:1px solid ${border}">
            <!-- Unit header bar -->
            <div style="background:${unitHdr};padding:10px 16px;display:flex;align-items:center;justify-content:space-between">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:28px;height:28px;border-radius:7px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800">${u.unitNum||ui+1}</div>
                <div style="font-size:14px;font-weight:800;color:#fff">${u.unitName}</div>
              </div>
              <div style="display:flex;gap:16px">
                <div style="text-align:center">
                  <div style="font-size:16px;font-weight:800;color:#fff">${u.weeksRequired}</div>
                  <div style="font-size:9px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.6px;margin-top:2px">Weeks</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:16px;font-weight:800;color:#fff">${totalPeriods}</div>
                  <div style="font-size:9px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.6px;margin-top:2px">Total Periods</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:16px;font-weight:800;color:#fff">${u.topics.length}</div>
                  <div style="font-size:9px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.6px;margin-top:2px">Topics</div>
                </div>
              </div>
            </div>
            <!-- Topics table -->
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:${tHead}">
                <th style="padding:8px 13px;border:1px solid ${border};color:${textM};font-size:10px;text-transform:uppercase;letter-spacing:.6px;width:50px">#</th>
                <th style="padding:8px 13px;border:1px solid ${border};color:${textM};font-size:10px;text-transform:uppercase;letter-spacing:.6px">Sub Topic</th>
                <th style="padding:8px 13px;border:1px solid ${border};color:${textM};font-size:10px;text-transform:uppercase;letter-spacing:.6px;width:130px">Periods Required</th>
              </tr></thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr style="background:${isColor?'rgba(30,58,138,.04)':'#F0F0F0'}">
                  <td colspan="2" style="padding:9px 13px;border:1px solid ${border};font-weight:700;color:${textD}">Total</td>
                  <td style="padding:9px 13px;border:1px solid ${border};font-weight:800;color:${accent};text-align:center;font-size:16px">${totalPeriods}</td>
                </tr>
              </tfoot>
            </table>
          </div>`;
      }).join('');

      return `
        <div style="margin-bottom:18px">
          <div style="font-size:11px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;
            color:${accent};margin-bottom:10px;display:flex;align-items:center;gap:8px">
            <span style="display:inline-block;width:3px;height:14px;background:${accent};border-radius:2px"></span>
            ${term} — ${units.length} unit${units.length>1?'s':''}
          </div>
          ${unitTables}
        </div>`;
    }).filter(Boolean).join('');

    if (!termSections) return '';

    return `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <!-- Subject banner -->
        <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;
          background:${isColor?'linear-gradient(135deg,rgba(30,58,138,.07),rgba(30,64,175,.04))':'#F2F2F2'};
          border-radius:10px;border-left:5px solid ${accent};margin-bottom:16px">
          <div style="font-size:17px;font-weight:800;color:${textD}">${s.name}</div>
          <div style="margin-left:auto;background:${isColor?'rgba(30,64,175,.1)':'#E5E5E5'};color:${accent};
            padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700">${s.lessons} lessons/week</div>
        </div>
        ${termSections}
      </div>`;
  }).join('');

  /* Summary strip */
  const totalUnits    = Object.values(TB_DATA[cls]||{}).flatMap(t=>Object.values(t)).flat().length;
  const totalSubjects = (LP_SUBJECTS[cls]||[]).length;
  const totalLessons  = (LP_SUBJECTS[cls]||[]).reduce((a,s)=>a+s.lessons,0);

  const summaryStrip = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px">
      ${[
        [totalSubjects, 'Subjects',    '📚', isColor?'#EFF6FF':'#F5F5F5', accent],
        [totalUnits,    'Total Units',  '📋', isColor?'#F0FDF4':'#F5F5F5', isColor?'#16A34A':'#444'],
        [totalLessons,  'Lessons/Week', '🗓', isColor?'#FEF9C3':'#F5F5F5', isColor?'#D97706':'#444'],
      ].map(([v,l,ic,bg,c])=>`
        <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:16px;text-align:center">
          <div style="font-size:20px;margin-bottom:5px">${ic}</div>
          <div style="font-size:28px;font-weight:800;color:${c};line-height:1">${v}</div>
          <div style="font-size:11px;color:${textM};font-weight:600;margin-top:5px;text-transform:uppercase;letter-spacing:.5px">${l}</div>
        </div>`).join('')}
    </div>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Term Breakup — ${cls} · ${typeLabel} · ${styleLabel}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:${textD};font-size:13px}.page{width:210mm;margin:0 auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.np{display:none}@page{size:A4;margin:15mm}}</style>
</head><body><div class="page">
  <div style="background:${hdrBg};padding:24px 36px 28px;color:#fff;position:relative;overflow:hidden;border-radius:0 0 16px 16px;margin-bottom:28px">
    <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
    <div style="position:absolute;bottom:-20px;left:180px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    ${getReportLogo(style)}
    <div style="font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px">Term Breakup — ${cls}</div>
    <div style="font-size:13px;opacity:.75;margin-bottom:16px">Complete unit & topic breakdown across all terms · ${styleLabel} ${typeLabel}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Class:</strong> ${cls}</div>
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Format:</strong> ${typeLabel} · ${styleLabel}</div>
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
    </div>
  </div>
  <div style="padding:0 8px">
    ${summaryStrip}
    ${subjectsHtml || `<p style="color:${textM};text-align:center;padding:40px">No breakup data available.</p>`}
  </div>
  <div style="margin-top:24px;border-top:1px solid ${border};padding:12px 8px;display:flex;justify-content:space-between;font-size:11px;color:${textM}">
    <span>${getSchoolName()}</span><span>School Mentor ERP © 2026</span><span>${cls} · Term Breakup</span>
  </div>
  <div class="np" style="text-align:center;padding:20px;background:#F8FAFC;border-top:1px solid #E2E8F0;margin-top:16px">
    <button onclick="window.print()" style="background:${isColor?'#1E3A8A':'#333'};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px">🖨 Print / Save as PDF</button>
    <button onclick="window.close()" style="background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
  </div>
</div></body></html>`;

  const w = window.open('', '_blank', 'width=980,height=800');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   SESSION SETTINGS CARD REPORTS — verbatim from HTML generateCardReport
   ═══════════════════════════════════════════════════════════════════ */
function generateCardReport(card, style) {
  const isColor = style === 'color';
  const hdrBg  = isColor ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : 'linear-gradient(135deg,#2C2C2C,#555)';
  const accent  = isColor ? '#1E40AF' : '#444';
  const textD   = isColor ? '#0F172A' : '#111';
  const textM   = isColor ? '#64748B' : '#555';
  const border  = isColor ? '#BFDBFE' : '#DDD';
  const rowAlt  = isColor ? '#F0F6FF' : '#F5F5F5';
  const tHead   = isColor ? '#EFF6FF' : '#EAEAEA';
  const generated = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

  let title = '', body = '';

  /* ── Academic Session ── */
  if (card === 'session') {
    title = 'Academic Session Report';
    const rows = [
      ['Session Start',        '2026-01-01'],
      ['Session End',          '2027-01-01'],
      ['Working Days / Week',  '5'],
      ['Total On Days',        '262'],
      ['Working Days',         '254'],
      ['Working Weeks',        '50.80'],
      ['Total Holidays',       '8'],
    ];
    body = `
      <!-- Hero stat strip -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px">
        ${[
          ['262','Total On Days','📅',isColor?'#EFF6FF':'#F5F5F5',isColor?'#1E40AF':'#333'],
          ['254','Working Days','💼',isColor?'#DCFCE7':'#F5F5F5',isColor?'#16A34A':'#333'],
          ['8','Holidays','🌴',isColor?'#FEF9C3':'#F5F5F5',isColor?'#D97706':'#333'],
        ].map(([v,l,ic,bg,c])=>`
          <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:18px 14px;text-align:center">
            <div style="font-size:22px;margin-bottom:6px">${ic}</div>
            <div style="font-size:30px;font-weight:800;color:${c};line-height:1;letter-spacing:-.02em">${v}</div>
            <div style="font-size:11px;color:${textM};font-weight:600;margin-top:5px;text-transform:uppercase;letter-spacing:.5px">${l}</div>
          </div>`).join('')}
      </div>

      <!-- Detail table -->
      <h2 style="font-size:15px;font-weight:700;color:${textD};margin:0 0 12px;display:flex;align-items:center;gap:8px">
        <span style="display:inline-block;width:4px;height:18px;background:${accent};border-radius:2px"></span>
        Session Details
      </h2>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px">
        ${rows.map(([k,v],i)=>`
          <tr style="background:${i%2===0?'white':rowAlt}">
            <td style="padding:12px 16px;border:1px solid ${border};color:${textM};font-weight:600;width:55%">${k}</td>
            <td style="padding:12px 16px;border:1px solid ${border};color:${textD};font-weight:800;font-size:15px">${v}</td>
          </tr>`).join('')}
      </table>

      <!-- Working weeks timeline -->
      <div style="margin-top:24px;padding:16px 20px;background:${isColor?'linear-gradient(135deg,rgba(30,58,138,.05),rgba(30,64,175,.03))':'#F8F8F8'};border-radius:12px;border-left:4px solid ${accent}">
        <div style="font-size:12px;font-weight:700;color:${textM};text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Academic Year Timeline</div>
        <div style="display:flex;align-items:center;gap:0;height:10px;border-radius:6px;overflow:hidden;background:${border}">
          <div style="width:97%;height:100%;background:${isColor?'linear-gradient(90deg,#1E40AF,#3B82F6)':'#888'};border-radius:6px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:${textM};margin-top:6px">
          <span>Jan 2026</span><span style="font-weight:700;color:${accent}">254 working days (97%)</span><span>Jan 2027</span>
        </div>
      </div>`;
  }

  /* ── Vacations ── */
  else if (card === 'vacations') {
    title = 'Vacations Report';
    const vacations = [
      { name:'Kashmir Day',   start:'2026-03-21', end:'2026-03-30', days:10, color:isColor?'#3B82F6':'#666' },
      { name:'Eid-ul-Fitr',   start:'2026-04-01', end:'2026-04-05', days:5,  color:isColor?'#22C55E':'#666' },
      { name:'Summer Break',  start:'2026-07-01', end:'2026-07-31', days:31, color:isColor?'#F59E0B':'#666' },
    ];
    const totalVacDays = vacations.reduce((a,v)=>a+v.days,0);
    const totalWorkDays = 262 - totalVacDays;

    body = `
      <!-- Summary strip -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px">
        ${[
          [vacations.length,'Total Breaks','🗓',isColor?'#EFF6FF':'#F5F5F5',isColor?'#1E40AF':'#333'],
          [totalVacDays,'Vacation Days','🏖',isColor?'#FEF9C3':'#F5F5F5',isColor?'#D97706':'#333'],
          [totalWorkDays,'Remaining Days','✅',isColor?'#DCFCE7':'#F5F5F5',isColor?'#16A34A':'#333'],
        ].map(([v,l,ic,bg,c])=>`
          <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:18px 14px;text-align:center">
            <div style="font-size:22px;margin-bottom:6px">${ic}</div>
            <div style="font-size:30px;font-weight:800;color:${c};line-height:1;letter-spacing:-.02em">${v}</div>
            <div style="font-size:11px;color:${textM};font-weight:600;margin-top:5px;text-transform:uppercase;letter-spacing:.5px">${l}</div>
          </div>`).join('')}
      </div>

      <!-- Vacation cards -->
      <h2 style="font-size:15px;font-weight:700;color:${textD};margin:0 0 14px;display:flex;align-items:center;gap:8px">
        <span style="display:inline-block;width:4px;height:18px;background:${accent};border-radius:2px"></span>
        Scheduled Vacation Breaks
      </h2>
      ${vacations.map((v,i)=>`
        <div style="display:flex;align-items:center;gap:16px;padding:16px 20px;background:${i%2===0?'white':rowAlt};border:1px solid ${border};border-radius:10px;margin-bottom:10px;border-left:5px solid ${v.color}">
          <div style="width:48px;height:48px;border-radius:12px;background:${v.color}18;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <div style="width:14px;height:14px;border-radius:50%;background:${v.color}"></div>
          </div>
          <div style="flex:1">
            <div style="font-size:16px;font-weight:800;color:${textD};margin-bottom:4px">${v.name}</div>
            <div style="font-size:12.5px;color:${textM}">📅 ${v.start} → ${v.end}</div>
          </div>
          <div style="text-align:center;flex-shrink:0">
            <div style="font-size:32px;font-weight:800;color:${v.color};line-height:1">${v.days}</div>
            <div style="font-size:10px;font-weight:700;color:${textM};text-transform:uppercase;letter-spacing:.6px">days</div>
          </div>
        </div>`).join('')}

      <!-- Distribution bar -->
      <div style="margin-top:22px;padding:16px 20px;background:${isColor?'#F8FAFF':'#F8F8F8'};border-radius:12px;border:1px solid ${border}">
        <div style="font-size:12px;font-weight:700;color:${textM};text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">Vacation Distribution in Academic Year</div>
        <div style="display:flex;height:12px;border-radius:8px;overflow:hidden;gap:2px">
          ${vacations.map(v=>`<div style="flex:${v.days};background:${v.color};opacity:.85" title="${v.name}: ${v.days} days"></div>`).join('')}
          <div style="flex:${totalWorkDays};background:${isColor?'#DBEAFE':'#DDD'}"></div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px">
          ${vacations.map(v=>`<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${textM}"><div style="width:10px;height:10px;border-radius:50%;background:${v.color};flex-shrink:0"></div>${v.name} (${v.days}d)</div>`).join('')}
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${textM}"><div style="width:10px;height:10px;border-radius:50%;background:${isColor?'#BFDBFE':'#DDD'};flex-shrink:0"></div>Working Days (${totalWorkDays}d)</div>
        </div>
      </div>`;
  }

  /* ── Session Summary ── */
  else if (card === 'summary') {
    title = 'Session Summary Report';
    const totalDays    = 262;
    const workingDays  = 254;
    const holidays     = 8;
    const workingWeeks = 50.80;
    const workingPct   = Math.round((workingDays / totalDays) * 100);
    const holidayPct   = Math.round((holidays / totalDays) * 100);

    body = `
      <!-- ── Hero numbers row (matches the card exactly) ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:24px;
        border:1px solid ${border};border-radius:14px;overflow:hidden">
        <div style="padding:28px 20px;text-align:center;background:${isColor?'linear-gradient(145deg,#EFF6FF,#DBEAFE)':'#F5F5F5'}">
          <div style="font-size:52px;font-weight:800;color:${isColor?'#1E3A8A':'#222'};
            line-height:1;letter-spacing:-.03em">${workingDays}</div>
          <div style="font-size:11px;font-weight:800;color:${isColor?'#1E40AF':'#555'};
            text-transform:uppercase;letter-spacing:1.2px;margin-top:10px">Working Days</div>
        </div>
        <div style="padding:28px 20px;text-align:center;border-left:1px solid ${border};
          background:${isColor?'linear-gradient(145deg,#F0FDF4,#DCFCE7)':'#F8F8F8'}">
          <div style="font-size:52px;font-weight:800;color:${isColor?'#15803D':'#333'};
            line-height:1;letter-spacing:-.03em">${workingWeeks}</div>
          <div style="font-size:11px;font-weight:800;color:${isColor?'#16A34A':'#555'};
            text-transform:uppercase;letter-spacing:1.2px;margin-top:10px">Working Weeks</div>
        </div>
      </div>

      <!-- ── Three stat pills (Total Days / Working / Holidays) ── -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:28px">
        ${[
          [totalDays,   'Total Days',    '📅', isColor?'#1E3A8A':'#2C2C2C', isColor?'linear-gradient(145deg,#152D6E,#1E3A8A)':'linear-gradient(145deg,#2C2C2C,#555)'],
          [workingDays, 'Working',       '💼', '#fff',                       isColor?'linear-gradient(145deg,#1E3A8A,#1E40AF)':'linear-gradient(145deg,#3A3A3A,#666)'],
          [holidays,    'Holidays',      '🏖', '#fff',                       isColor?'linear-gradient(145deg,#1E40AF,#3B5BDE)':'linear-gradient(145deg,#555,#888)'],
        ].map(([v,l,ic,tc,bg]) => `
          <div style="padding:20px 14px;border-radius:14px;text-align:center;
            background:${bg};color:${tc};
            box-shadow:${isColor?'0 4px 14px rgba(30,58,138,.2)':'0 2px 8px rgba(0,0,0,.1)'}">
            <div style="font-size:18px;margin-bottom:8px">${ic}</div>
            <div style="font-size:36px;font-weight:800;line-height:1;
              letter-spacing:-.02em">${v}</div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;
              letter-spacing:1px;margin-top:8px;opacity:.75">${l}</div>
          </div>`).join('')}
      </div>

      <!-- ── Distribution breakdown ── -->
      <h2 style="font-size:15px;font-weight:700;color:${textD};
        margin:0 0 14px;display:flex;align-items:center;gap:8px">
        <span style="display:inline-block;width:4px;height:18px;
          background:${isColor?'#1E40AF':'#555'};border-radius:2px"></span>
        Academic Year Breakdown
      </h2>

      <!-- Stacked bar -->
      <div style="margin-bottom:12px">
        <div style="display:flex;height:14px;border-radius:8px;overflow:hidden;gap:2px">
          <div style="flex:${workingDays};background:${isColor?'linear-gradient(90deg,#1E40AF,#3B82F6)':'#666'};
            border-radius:8px 0 0 8px"></div>
          <div style="flex:${holidays};background:${isColor?'#F59E0B':'#AAA'};
            border-radius:0 8px 8px 0"></div>
        </div>
        <div style="display:flex;justify-content:space-between;
          font-size:11px;color:${textM};margin-top:5px">
          <span style="display:flex;align-items:center;gap:5px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:3px;
              background:${isColor?'#1E40AF':'#666'}"></span>
            Working ${workingDays} days (${workingPct}%)
          </span>
          <span style="display:flex;align-items:center;gap:5px">
            <span style="display:inline-block;width:10px;height:10px;border-radius:3px;
              background:${isColor?'#F59E0B':'#AAA'}"></span>
            Holidays ${holidays} days (${holidayPct}%)
          </span>
        </div>
      </div>

      <!-- Detail table -->
      <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-top:20px">
        <thead>
          <tr style="background:${tHead}">
            <th style="padding:11px 16px;text-align:left;border:1px solid ${border};
              color:${textM};font-size:10px;text-transform:uppercase;letter-spacing:.8px">Metric</th>
            <th style="padding:11px 16px;text-align:center;border:1px solid ${border};
              color:${textM};font-size:10px;text-transform:uppercase;letter-spacing:.8px">Value</th>
            <th style="padding:11px 16px;text-align:left;border:1px solid ${border};
              color:${textM};font-size:10px;text-transform:uppercase;letter-spacing:.8px">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${[
            ['Total Calendar Days',    totalDays,               'Full academic year span'],
            ['Working Days',           workingDays,             `${workingPct}% of total days`],
            ['Working Weeks',          workingWeeks,            `${workingDays} ÷ 5 working days/week`],
            ['Holiday / Vacation Days',holidays,                `${holidayPct}% of total days`],
            ['Working Days per Week',  '5',                     'Mon – Fri schedule'],
            ['Academic Year',          '2026 – 2027',           'Jan 1, 2026 → Jan 1, 2027'],
          ].map(([k,v,n],i) => `
            <tr style="background:${i%2===0?'white':rowAlt}">
              <td style="padding:11px 16px;border:1px solid ${border};
                color:${textM};font-weight:600">${k}</td>
              <td style="padding:11px 16px;border:1px solid ${border};
                color:${textD};font-weight:800;font-size:16px;text-align:center">${v}</td>
              <td style="padding:11px 16px;border:1px solid ${border};
                color:${textM};font-size:12px">${n}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <!-- Footer insight -->
      <div style="margin-top:20px;padding:14px 18px;border-radius:12px;
        background:${isColor?'linear-gradient(135deg,rgba(30,58,138,.05),rgba(30,64,175,.03))':'#F5F5F5'};
        border-left:4px solid ${isColor?'#1E40AF':'#555'};
        display:flex;align-items:center;gap:12px">
        <div style="font-size:22px">📊</div>
        <div style="font-size:13px;color:${textM};line-height:1.65">
          This academic session runs <strong style="color:${textD}">${workingDays} working days</strong>
          across <strong style="color:${textD}">${workingWeeks} weeks</strong>, with
          <strong style="color:${textD}">${holidays} days</strong> of scheduled vacations
          (${holidayPct}% of the year). Students attend <strong style="color:${textD}">5 days per week</strong>.
        </div>
      </div>`;
  }
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title} — ${getSchoolName()}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:${textD};font-size:13px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.np{display:none}@page{size:A4;margin:15mm}}</style>
</head><body>
<div style="width:210mm;margin:0 auto">
  <!-- Header -->
  <div style="background:${hdrBg};padding:24px 36px 28px;color:#fff;position:relative;overflow:hidden;border-radius:0 0 16px 16px;margin-bottom:28px">
    <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
    <div style="position:absolute;bottom:-20px;left:120px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    ${getReportLogo(style)}
    <div style="font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px">${title}</div>
    <div style="font-size:13px;opacity:.75;margin-bottom:16px">Academic Year 2026–2027 · ${isColor?'Colorful':'Colorless'} Report</div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Generated:</strong> ${generated}</div>
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Style:</strong> ${isColor?'Colorful':'Colorless'}</div>
    </div>
  </div>
  <div style="padding:0 8px">${body}</div>
  <!-- Footer -->
  <div style="margin-top:32px;border-top:1px solid ${border};padding:14px 8px;display:flex;justify-content:space-between;font-size:11px;color:${textM}">
    <span>${getSchoolName()}</span>
    <span>School Mentor ERP © 2026</span>
    <span>Academic Year 2026–2027</span>
  </div>
  <!-- Print toolbar -->
  <div class="np" style="text-align:center;padding:22px;background:#F8FAFC;border-top:1px solid #E2E8F0;margin-top:20px">
    <button onclick="window.print()" style="background:${isColor?'#1E3A8A':'#333'};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px">🖨 Print / Save as PDF</button>
    <button onclick="window.close()" style="background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=750');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   PER WEEK LESSON PLANS REPORT — verbatim from HTML lpOpenReport
   ═══════════════════════════════════════════════════════════════════ */
function lpOpenReport(type, style, selectedClass) {
  const isColor = style === 'color';
  const bg     = isColor ? '#1E3A8A' : '#2C2C2C';
  // eslint-disable-next-line no-unused-vars
  const accent = isColor ? '#1E40AF' : '#555';
  const hdrBg  = isColor ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : 'linear-gradient(135deg,#2C2C2C,#555)';
  const textD  = isColor ? '#0F172A' : '#111';
  const textM  = isColor ? '#64748B' : '#555';
  const border = isColor ? '#BFDBFE' : '#CCC';
  const rowAlt = isColor ? '#F8FAFF' : '#F5F5F5';
  const tHead  = isColor ? '#EFF6FF' : '#EAEAEA';

  /* Resolve which classes to include */
  let classKeys = [];
  if (type === 'individual') {
    if (!selectedClass) { alert('Please select a class first, then click a report button'); return; }
    classKeys = [selectedClass];
  } else {
    classKeys = Object.keys(LP_SUBJECTS);
  }

  const title = type === 'combined'
    ? `All Classes — Weekly Lesson Plan Report`
    : `${selectedClass} — Weekly Lesson Plan Report`;

  /* Build class tables */
  const classTables = classKeys.map(key => {
    const subjects = LP_SUBJECTS[key] || [];
    const total    = subjects.reduce((a, s) => a + s.lessons, 0);
    const rows     = subjects.map((s, i) =>
      `<tr style="background:${i%2===0?'white':rowAlt}">
        <td style="padding:9px 14px;border:1px solid ${border};color:${textM};font-weight:600">${i+1}</td>
        <td style="padding:9px 14px;border:1px solid ${border};color:${textD};font-weight:700">${s.name}</td>
        <td style="padding:9px 14px;border:1px solid ${border};color:${textD};text-align:center;font-size:18px;font-weight:800;${isColor?'color:#1E40AF':''}">${s.lessons}</td>
        <td style="padding:9px 14px;border:1px solid ${border};color:${textM};">
          <div style="background:${isColor?'#DBEAFE':'#EEE'};border-radius:4px;height:8px;overflow:hidden">
            <div style="width:${Math.round((s.lessons/40)*100)}%;height:100%;background:${isColor?'linear-gradient(90deg,#1E40AF,#3B82F6)':'#888'};border-radius:4px"></div>
          </div>
        </td>
      </tr>`
    ).join('');

    return `
      <div style="margin-bottom:28px;break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;padding:11px 16px;background:${isColor?'linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.04))':'#F5F5F5'};border-radius:10px;border-left:4px solid ${isColor?'#1E40AF':'#555'}">
          <div style="font-size:16px;font-weight:800;color:${textD}">${key}</div>
          <div style="margin-left:auto;background:${isColor?'rgba(30,64,175,.1)':'#EEE'};color:${isColor?'#1E40AF':textM};padding:3px 12px;border-radius:99px;font-size:11px;font-weight:700">${subjects.length} subjects · ${total} lessons/week</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:${tHead}">
              <th style="padding:9px 14px;text-align:left;border:1px solid ${border};color:${textM};font-size:10px;letter-spacing:.8px;text-transform:uppercase;width:40px">#</th>
              <th style="padding:9px 14px;text-align:left;border:1px solid ${border};color:${textM};font-size:10px;letter-spacing:.8px;text-transform:uppercase">Subject</th>
              <th style="padding:9px 14px;text-align:center;border:1px solid ${border};color:${textM};font-size:10px;letter-spacing:.8px;text-transform:uppercase;width:100px">Lessons/Wk</th>
              <th style="padding:9px 14px;text-align:left;border:1px solid ${border};color:${textM};font-size:10px;letter-spacing:.8px;text-transform:uppercase">Distribution</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:${isColor?'rgba(30,58,138,.05)':'#F0F0F0'}">
              <td colspan="2" style="padding:10px 14px;border:1px solid ${border};font-weight:800;color:${textD}">Total</td>
              <td style="padding:10px 14px;border:1px solid ${border};text-align:center;font-size:20px;font-weight:800;color:${isColor?'#1E40AF':'#333'}">${total}</td>
              <td style="padding:10px 14px;border:1px solid ${border};color:${textM};font-size:12px">${total} lessons per week total</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }).join('');

  /* Summary stats for combined */
  const summaryBlock = type === 'combined' ? `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
      ${[
        ['Total Classes', classKeys.length, '🏫'],
        ['Total Subjects', classKeys.reduce((a,k)=>a+(LP_SUBJECTS[k]?.length||0),0), '📚'],
        ['Avg Lessons/Class', Math.round(classKeys.reduce((a,k)=>a+(LP_SUBJECTS[k]?.reduce((b,s)=>b+s.lessons,0)||0),0)/classKeys.length), '📊'],
        ['Academic Year', '2026–27', '📅'],
      ].map(([l,v,ic]) => `
        <div style="background:${isColor?'#EFF6FF':'#F5F5F5'};border-radius:10px;padding:14px;text-align:center;border:1px solid ${border}">
          <div style="font-size:20px;margin-bottom:4px">${ic}</div>
          <div style="font-size:22px;font-weight:800;color:${isColor?'#1E40AF':'#333'};line-height:1">${v}</div>
          <div style="font-size:11px;color:${textM};margin-top:4px;font-weight:600">${l}</div>
        </div>`).join('')}
    </div>` : '';

  /* Final HTML */
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:${textD};font-size:13px}
  .page{width:210mm;margin:0 auto}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.np{display:none}@page{size:A4;margin:15mm}}
</style></head><body>
<div class="page">

  <!-- Report header -->
  <div style="background:${hdrBg};padding:24px 36px 28px;color:#fff;position:relative;overflow:hidden;border-radius:0 0 16px 16px;margin-bottom:28px">
    <div style="position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
    <div style="position:absolute;bottom:-20px;left:120px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
    ${getReportLogo(style)}
    <div style="font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px">${title}</div>
    <div style="font-size:13px;opacity:.75;margin-bottom:16px">Per Week Lesson Plan Breakdown · ${isColor?'Colorful':'Colorless'} Report</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Type:</strong> ${type==='combined'?'Combined (All Classes)':'Individual Class'}</div>
      <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Style:</strong> ${isColor?'Colorful':'Colorless'}</div>
    </div>
  </div>

  <div style="padding:0 8px">
    ${summaryBlock}
    ${classTables}
  </div>

  <!-- Footer -->
  <div style="margin-top:32px;border-top:1px solid ${border};padding:14px 8px;display:flex;justify-content:space-between;font-size:11px;color:${textM}">
    <span>${getSchoolName()}</span>
    <span>School Mentor ERP © 2026</span>
    <span>${type==='combined'?`${classKeys.length} classes`:'Individual Report'}</span>
  </div>

  <!-- Print toolbar -->
  <div class="np" style="text-align:center;padding:22px;background:#F8FAFC;border-top:1px solid #E2E8F0;margin-top:20px">
    <button onclick="window.print()" style="background:${bg};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px">🖨 Print / Save as PDF</button>
    <button onclick="window.close()" style="background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=960,height=750');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   DISPATCHER — routes `name` to the matching verbatim report
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   CREATE-LESSON-PLAN UNIT PDF — verbatim from HTML clpUnitPdfReport
   ═══════════════════════════════════════════════════════════════════ */
function clpUnitPdfReport(unit, ctx, style) {
  if (!unit) return;
  const isColor = style === 'color';

  const bg           = isColor ? '#1E3A8A'  : '#000';
  const hdrBg        = isColor ? 'linear-gradient(135deg,#1E3A8A 0%,#1E40AF 55%,#2563EB 100%)' : '#fff';
  const hdrColor     = isColor ? '#fff'     : '#000';
  const hdrBorder    = isColor ? 'none'     : '2px solid #000';
  const textD        = isColor ? '#0F172A'  : '#000';
  const textM        = isColor ? '#64748B'  : '#444';
  const border       = isColor ? '#BFDBFE'  : '#999';

  const secBars = isColor
    ? [{bar:'#7C3AED',bg:'#F5F3FF'},{bar:'#1E40AF',bg:'#EFF6FF'},{bar:'#EA580C',bg:'#FFF7ED'},{bar:'#16A34A',bg:'#F0FDF4'}]
    : [{bar:'#000',bg:'#fff'},{bar:'#000',bg:'#fff'},{bar:'#000',bg:'#fff'},{bar:'#000',bg:'#fff'}];

  const manualBg  = isColor ? '#DCFCE7' : '#fff';
  const manualClr = isColor ? '#15803D' : '#000';
  const aiBg      = isColor ? '#EDE9FE' : '#fff';
  const aiClr     = isColor ? '#7C3AED' : '#000';

  const cls  = ctx?.clpClass   || '—';
  const subj = ctx?.clpSubject || '—';

  const sectionTitles = ['Student Learning Objectives (SLOs)','Lesson Introduction','Development / Main Teaching','Recap / Consolidation'];
  const sectionIcons  = ['🎯','📖','🔬','✅'];
  const sectionKeys   = ['slo','intro','devel','recap'];
  const sectionMins   = ['05','05','20','10'];

  const getContent = (lesson, idx) => {
    const map = lesson?.contentMap || {};
    return map[sectionKeys[idx]] || '';
  };

  const totalLessons = unit.lessons.length;
  const aiCount      = unit.lessons.filter(l => l.source === 'mentorai' || l.source === 'ai').length;
  const manualCount  = totalLessons - aiCount;

  const lessonCards = unit.lessons.length ? unit.lessons.map((lesson, li) => {
    const isAi   = lesson.source === 'mentorai' || lesson.source === 'ai';
    const srcBg  = isAi ? aiBg  : manualBg;
    const srcClr = isAi ? aiClr : manualClr;
    const srcLbl = isAi ? '✨ Mentor AI Generated' : '✏ Manually Added';

    const sections = sectionTitles.map((title, si) => {
      const sc       = secBars[si];
      const content  = getContent(lesson, si) || '';
      const timeMins = sectionMins[si];
      if (isColor) {
        return `
          <div style="margin-bottom:18px;break-inside:avoid">
            <div style="background:${sc.bar};color:#fff;padding:8px 16px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:12px;font-weight:800">${sectionIcons[si]} ${title}</span>
              <span style="font-size:10.5px;background:rgba(255,255,255,.2);padding:2px 10px;border-radius:20px;font-weight:600">⏱ ${timeMins} mins</span>
            </div>
            <div style="background:${sc.bg};border:1px solid ${border};border-top:none;border-radius:0 0 8px 8px;padding:14px 16px;font-size:12.5px;line-height:1.75;color:${textD}">${content}</div>
          </div>`;
      } else {
        return `
          <div style="margin-bottom:14px;break-inside:avoid;border:1px solid #999;border-radius:3px;overflow:hidden">
            <div style="border-bottom:2px solid #000;padding:7px 14px;display:flex;align-items:center;justify-content:space-between;background:#fff">
              <span style="font-size:12px;font-weight:900;color:#000">${title}</span>
              <span style="font-size:10.5px;font-weight:700;color:#444;border:1px solid #999;padding:1px 9px;border-radius:3px">${timeMins} mins</span>
            </div>
            <div style="padding:12px 14px;font-size:12.5px;line-height:1.75;color:#000;background:#fff">${content}</div>
          </div>`;
      }
    }).join('');

    if (isColor) {
      return `
        <div style="margin-bottom:36px;page-break-inside:avoid">
          <div style="background:linear-gradient(135deg,#1E3A8A,#2563EB);color:#fff;padding:14px 20px;border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:14px">
              <div style="width:38px;height:38px;background:rgba(255,255,255,.18);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;flex-shrink:0">${li+1}</div>
              <div>
                <div style="font-size:15px;font-weight:800">${lesson.topic||'(untitled)'}</div>
                <div style="font-size:11px;opacity:.75;margin-top:2px">Lesson No. ${lesson.num} · Unit ${unit.unitNo}</div>
              </div>
            </div>
            <span style="background:${srcBg};color:${srcClr};padding:4px 13px;border-radius:20px;font-size:10.5px;font-weight:700;white-space:nowrap">${srcLbl}</span>
          </div>
          <div style="border:1px solid ${border};border-top:none;border-radius:0 0 12px 12px;padding:20px;background:#fff">${sections}</div>
        </div>`;
    } else {
      return `
        <div style="margin-bottom:24px;page-break-inside:avoid;border:2px solid #000;border-radius:3px;overflow:hidden">
          <div style="border-bottom:2px solid #000;padding:11px 16px;background:#fff;display:flex;align-items:center;justify-content:space-between">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:30px;height:30px;border:2px solid #000;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#000;flex-shrink:0">${li+1}</div>
              <div>
                <div style="font-size:14px;font-weight:900;color:#000">${lesson.topic||'(untitled)'}</div>
                <div style="font-size:11px;color:#444;margin-top:1px">Lesson No. ${lesson.num} · Unit ${unit.unitNo}</div>
              </div>
            </div>
            <span style="font-size:10px;font-weight:700;color:#000;border:1.5px solid #000;padding:3px 10px;border-radius:3px">${srcLbl}</span>
          </div>
          <div style="padding:16px;background:#fff">${sections}</div>
        </div>`;
    }
  }).join('') : `<div style="padding:28px;text-align:center;color:${textM};border:1px solid ${border};border-radius:8px;font-style:italic">No lessons have been added to this unit yet.</div>`;

  const statsRow = isColor ? `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
      ${[['Total Lessons',totalLessons,'📚','#EFF6FF','#1E40AF'],['Mentor AI',aiCount,'🤖','#EDE9FE','#7C3AED'],['Manual',manualCount,'📝','#DCFCE7','#16A34A'],['Sections/Lesson','4','📋','#FFF7ED','#C2410C']]
        .map(([lbl,val,ic,bg2,clr])=>`<div style="background:${bg2};border-radius:10px;padding:14px;text-align:center;border:1px solid ${border}"><div style="font-size:18px;margin-bottom:4px">${ic}</div><div style="font-size:24px;font-weight:900;color:${clr};line-height:1">${val}</div><div style="font-size:10.5px;color:#64748B;margin-top:5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${lbl}</div></div>`).join('')}
    </div>` : `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12.5px">
      <tr>${[['Total Lessons',totalLessons],['Mentor AI',aiCount],['Manual',manualCount],['Sections/Lesson','4']]
        .map(([lbl,val])=>`<td style="border:1.5px solid #000;padding:10px 14px;text-align:center"><div style="font-size:22px;font-weight:900;color:#000">${val}</div><div style="font-size:10px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">${lbl}</div></td>`).join('')}</tr>
    </table>`;

  const legendBlock = isColor ? `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;padding:14px 18px;background:#F8FAFF;border-radius:10px;border:1px solid ${border}">
      <span style="font-size:10.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.6px;margin-right:6px;align-self:center">Each lesson includes:</span>
      ${[['🎯','SLOs','#7C3AED'],['📖','Introduction','#1E40AF'],['🔬','Development','#EA580C'],['✅','Recap','#16A34A']]
        .map(([ic,lbl,clr])=>`<span style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:20px;background:#fff;border:1px solid ${border};font-size:11.5px;font-weight:700;color:${clr}">${ic} ${lbl}</span>`).join('')}
    </div>` : `
    <div style="margin-bottom:18px;padding:9px 14px;border:1.5px solid #000;border-radius:3px">
      <span style="font-size:10.5px;font-weight:900;color:#000;text-transform:uppercase;letter-spacing:.6px">Each lesson contains: </span>
      ${sectionTitles.map((t,si)=>`<span style="font-size:11px;font-weight:700;color:#000;margin-left:12px">${sectionIcons[si]} ${t}</span>`).join('')}
    </div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Unit ${unit.unitNo} — ${unit.unitName} · Full Lesson Plan</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:${textD};font-size:13px;line-height:1.6}
  .page{width:210mm;margin:0 auto;padding-bottom:40px}
  table{border-collapse:collapse;width:100%}
  td,th{border:1px solid ${border};padding:7px 11px;font-size:12.5px}
  th{background:${isColor?'#EFF6FF':'#fff'};font-weight:700;color:${textD};text-align:left;${isColor?'':'border-bottom:2px solid #000;'}}
  ol,ul{padding-left:22px;margin:8px 0}
  li{margin-bottom:3px}
  blockquote{border-left:${isColor?'3px solid #1E40AF':'3px solid #000'};padding-left:12px;color:${textM};margin:10px 0;font-style:italic}
  strong{color:${textD}}
  p{margin-bottom:6px}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .np{display:none}
    @page{size:A4;margin:15mm}
    ${isColor?'':'* { color:#000 !important; background:#fff !important; background-color:#fff !important; background-image:none !important; box-shadow:none !important; text-shadow:none !important; }'}
  }
</style>
</head><body><div class="page">

  <div style="background:${hdrBg};padding:${isColor?'30px 40px 34px':'18px 24px'};color:${hdrColor};border:${hdrBorder};${isColor?'border-radius:0 0 20px 20px;':'border-bottom:3px solid #000;'}margin-bottom:26px;position:relative;overflow:hidden">
    ${isColor?'<div style="position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.05)"></div>':''}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div style="width:46px;height:46px;border-radius:11px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:${hdrColor};flex-shrink:0;border:1.5px solid rgba(255,255,255,.25)">${getSchoolInitials()}</div>
      <div>
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;${isColor?'opacity:.55':'color:#555'};font-weight:700;margin-bottom:2px">School Mentor ERP</div>
        <div style="font-size:15px;font-weight:800;color:${hdrColor};line-height:1.2">${getSchoolName()}</div>
      </div>
    </div>
    <div style="height:1px;background:${isColor?'rgba(255,255,255,.2)':'#ccc'};margin-bottom:14px"></div>
    <div style="font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;${isColor?'opacity:.65':'color:#555'};margin-bottom:6px">Lesson Plan Document</div>
    <div style="font-size:${isColor?'26':'22'}px;font-weight:900;margin-bottom:4px;color:${hdrColor}">Unit ${unit.unitNo} — ${unit.unitName}</div>
    <div style="font-size:12px;${isColor?'opacity:.75':'color:#555'};margin-bottom:${isColor?'20':'12'}px">Complete Lesson Plan Package · ${isColor?'Colorful':'Colorless — Ink Saver'} · Academic Year 2026–27</div>
    <div style="display:flex;gap:${isColor?'10':'20'}px;flex-wrap:wrap">
      ${[['Class',cls],['Subject',subj],['Total Lessons',totalLessons],['Generated',new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})]]
        .map(([lbl,val])=>isColor
          ? `<div style="background:rgba(255,255,255,.16);padding:6px 16px;border-radius:20px;font-size:11.5px;font-weight:600"><strong>${lbl}:</strong> ${val}</div>`
          : `<div style="font-size:12px;font-weight:700;color:#000"><span style="font-weight:400;color:#555">${lbl}: </span>${val}</div>`).join('')}
    </div>
  </div>

  <div style="padding:0 12px">
    ${statsRow}
    ${legendBlock}
    ${lessonCards}
  </div>

  <div style="margin-top:30px;border-top:${isColor?'2px solid '+border:'2px solid #000'};padding:12px 12px;display:flex;justify-content:space-between;font-size:11px;color:${textM}">
    <span style="font-weight:700;color:${textD}">School Mentor ERP © 2026</span>
    <span>${getSchoolName()}</span>
    <span>${isColor?'Color':'B&amp;W Ink Saver'} · Unit ${unit.unitNo} · ${totalLessons} Lesson${totalLessons!==1?'s':''}</span>
  </div>

  <div class="np" style="text-align:center;padding:22px;background:#F8FAFC;border-top:1px solid #E2E8F0;margin-top:18px">
    <div style="margin-bottom:10px;font-size:12px;color:#64748B">${isColor?'Full color document — optimised for color printing.':'Ink-saver — no backgrounds or colors will print.'}</div>
    <button onclick="window.print()" style="background:${bg};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px">🖨 Print / Save as PDF</button>
    <button onclick="window.close()" style="background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
  </div>

</div></body></html>`;

  const w = window.open('', '_blank', 'width=1000,height=800');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   NOTEBOOK PDF — verbatim from HTML nbGeneratePdfHtml
   ═══════════════════════════════════════════════════════════════════ */
function nbGeneratePdfHtml(u, questions, isColor) {
  const pri    = isColor ? '#0C4A6E' : '#111';
  const hdrBg  = isColor ? 'linear-gradient(135deg,#1E3A8A,#2563EB)' : '#1a1a1a';
  const bdgBg  = isColor ? '#E0F2FE' : '#eee';
  const bdgC   = isColor ? '#0369A1' : '#333';
  const bdr    = isColor ? '#BAE6FD' : '#ccc';
  const optColors = ['#0369A1', '#6D28D9', '#0C4A6E', '#92400E'];

  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${u.unitName} Report</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A;font-size:13px}.page{width:210mm;margin:0 auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:15mm}.no-print{display:none}}
  .header{background:${hdrBg};color:#fff;padding:24px 30px}.header h1{font-size:22px;font-weight:800}.header-sub{font-size:12px;opacity:.7;margin-top:4px}.meta{display:flex;gap:12px;margin-top:12px;flex-wrap:wrap}.meta span{font-size:11px;background:rgba(255,255,255,.15);padding:3px 10px;border-radius:20px}
  .body{padding:24px 30px}.section{margin-bottom:22px;border:1.5px solid ${bdr};border-radius:12px;overflow:hidden}
  .sec-head{background:${isColor ? 'linear-gradient(to right,#F0F9FF,#E0F2FE)' : '#f0f0f0'};padding:12px 16px;border-bottom:1.5px solid ${bdr};display:flex;align-items:center;gap:10px}
  .sec-num{width:26px;height:26px;border-radius:7px;background:${isColor ? 'linear-gradient(135deg,#0369A1,#0891B2)' : '#333'};color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .sec-type{font-size:11px;font-weight:700;background:${bdgBg};color:${bdgC};padding:2px 10px;border-radius:20px}
  .sec-q{font-size:13px;font-weight:600;color:${pri};flex:1}
  .item{display:flex;align-items:stretch;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'};min-height:38px}.item:last-child{border-bottom:none}
  .item-no{width:36px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${isColor ? '#0891B2' : '#555'};border-right:1px solid ${isColor ? '#E0F9FF' : '#ddd'};flex-shrink:0;background:${isColor ? 'rgba(6,182,212,.04)' : '#fafafa'}}
  .item-body{flex:1;padding:8px 14px;font-size:13px}.item-ans{min-width:180px;padding:8px 14px;font-size:13px;color:${isColor ? '#0369A1' : '#333'};border-left:1px solid ${isColor ? '#E0F9FF' : '#ddd'};font-weight:600;background:${isColor ? 'rgba(3,105,161,.04)' : '#f9f9f9'}}
  .two-col{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'}}.two-col:last-child{border-bottom:none}
  .arrow{color:${isColor ? '#0891B2' : '#666'};font-size:16px;text-align:center}.word-in{border:1px solid ${bdr};border-radius:6px;padding:4px 10px;font-size:13px;background:${isColor ? '#F8FAFF' : '#fafafa'}}
  .mcq-opts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 14px 10px}.mcq-opt{display:flex;align-items:center;border:1px solid ${bdr};border-radius:8px;overflow:hidden;height:34px}
  .mcq-lbl{width:30px;height:34px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0}.mcq-val{flex:1;padding:0 9px;font-size:12px}
  .mcq-ans{margin:0 14px 10px;padding:7px 12px;background:${isColor ? '#F0FDF4' : '#f0f0f0'};border-radius:8px;font-size:12px;font-weight:700;color:${isColor ? '#15803D' : '#333'};border:1px solid ${isColor ? '#BBF7D0' : '#ccc'}}
  .tf-row{display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'}}.tf-row:last-child{border-bottom:none}.tf-q{flex:1;font-size:13px}
  .tf-t{padding:3px 14px;border-radius:20px;font-size:12px;font-weight:800;background:${isColor ? '#DCFCE7' : '#e0e0e0'};color:${isColor ? '#15803D' : '#333'}}
  .tf-f{padding:3px 14px;border-radius:20px;font-size:12px;font-weight:800;background:${isColor ? '#FEE2E2' : '#e0e0e0'};color:${isColor ? '#B91C1C' : '#333'}}
  .rte-block{padding:10px 14px;font-size:13px;line-height:1.7;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'}}.rte-block:last-child{border-bottom:none}
  .match-pair{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:8px 14px;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'}}.match-pair:last-child{border-bottom:none}
  .match-a{border:1px solid ${isColor ? '#BAE6FD' : '#ccc'};border-radius:6px;padding:5px 10px;font-size:12px;background:${isColor ? '#F0F9FF' : '#fafafa'}}
  .match-b{border:1px solid ${isColor ? '#C4B5FD' : '#ccc'};border-radius:6px;padding:5px 10px;font-size:12px;background:${isColor ? '#F5F3FF' : '#fafafa'};font-weight:600}
  .punc-pair{padding:10px 14px;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'}}.punc-pair:last-child{border-bottom:none}.punc-q{font-size:12px;color:#64748B;margin-bottom:4px}
  .punc-a{font-size:13px;font-weight:600;color:${isColor ? '#0369A1' : '#333'};border-left:3px solid ${isColor ? '#0891B2' : '#999'};padding-left:8px}
  .ws-pair{display:grid;grid-template-columns:110px auto 1fr;align-items:start;gap:10px;padding:8px 14px;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'}}.ws-pair:last-child{border-bottom:none}
  .ws-word{border:1px solid ${bdr};border-radius:6px;padding:5px 10px;font-size:12px;font-weight:700;background:${isColor ? '#F0F9FF' : '#fafafa'}}
  .ws-sent{font-size:13px;line-height:1.6;padding-top:4px}
  .footer{text-align:center;font-size:11px;color:#94A3B8;padding:16px;border-top:1px solid #E2E8F0;margin-top:8px}
  </style></head><body><div class="page">
  <div class="header">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
      <div style="width:52px;height:52px;border-radius:13px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;letter-spacing:-0.5px;border:1.5px solid rgba(255,255,255,.3)">${getSchoolInitials()}</div>
      <div>
        <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.55);font-weight:700;margin-bottom:2px">School Mentor ERP</div>
        <div style="font-size:15px;font-weight:800;color:#fff;line-height:1.2">${getSchoolName()}</div>
      </div>
    </div>
    <div style="height:1px;background:rgba(255,255,255,.2);margin-bottom:14px"></div>
    <h1>${u.unitName}</h1><div class="header-sub">Notebook Report · Unit ${u.unitNo}</div>
    <div class="meta"><span>${isColor ? '📅 ' : ''}${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span><span>${isColor ? '📋 ' : ''}${Object.keys(questions).length} Section${Object.keys(questions).length !== 1 ? 's' : ''}</span><span>${isColor ? '🎨 Colorful' : 'Colorless'}</span></div>
  </div>
  <div class="body">`;

  Object.entries(questions).forEach(([typeId, sec], idx) => {
    const cfg    = AQ_CONFIG[typeId] || {};
    const rows   = sec.rows || [];
    const layout = cfg.layout || '';
    html += `<div class="section"><div class="sec-head"><div class="sec-num">${idx + 1}</div><div class="sec-type">${cfg.title || typeId}</div><div class="sec-q">${sec.mainQ || sec.mainQuestion || ''}</div></div><div>`;

    if (layout === 'two-col') {
      const f = cfg.fields || [];
      rows.forEach(r => {
        html += `<div class="two-col"><span class="word-in">${r[f[0]?.key] || ''}</span><span class="arrow">↔</span><span class="word-in">${r[f[1]?.key] || ''}</span></div>`;
      });
    } else if (layout === 'word-sentence') {
      rows.forEach(r => {
        html += `<div class="ws-pair"><span class="ws-word">${r.word || ''}</span><span class="arrow">→</span><div class="ws-sent">${r.sentence || ''}</div></div>`;
      });
    } else if (layout === 'mcq') {
      rows.forEach((r, i) => {
        html += `<div style="padding:10px 14px;border-bottom:1px solid ${isColor ? '#F0F9FF' : '#eee'}"><div style="font-size:13px;font-weight:600;margin-bottom:8px;">${i + 1}. ${r.question || ''}</div><div class="mcq-opts">${[['opt1','A'],['opt2','B'],['opt3','C'],['opt4','D']].map(([k, l], oi) => `<div class="mcq-opt"><span class="mcq-lbl" style="background:${isColor ? optColors[oi] : '#555'}">${l}</span><span class="mcq-val">${r[k] || ''}</span></div>`).join('')}</div><div class="mcq-ans">✓ Correct: ${r.correct || ''}</div></div>`;
      });
    } else if (layout === 'fill-blanks') {
      rows.forEach((r, i) => {
        html += `<div class="item"><div class="item-no">${i + 1}</div><div class="item-body">${r.question || ''}</div><div class="item-ans">→ ${r.answer || ''}</div></div>`;
      });
    } else if (layout === 'true_false') {
      rows.forEach((r, i) => {
        html += `<div class="tf-row"><span class="tf-q">${i + 1}. ${r.question || ''}</span><span class="${r.answer === 'true' ? 'tf-t' : 'tf-f'}">${r.answer === 'true' ? 'True' : 'False'}</span></div>`;
      });
    } else if (layout === 'match') {
      html += `<div style="margin:8px 14px;padding:7px 12px;background:${isColor ? '#F0F9FF' : '#f0f0f0'};border-radius:8px;font-size:11px;color:#64748B;border:1px solid ${bdr};">ℹ️ Shuffle Column B when writing on board.</div>`;
      rows.forEach(r => {
        html += `<div class="match-pair"><span class="match-a">${r.colA || ''}</span><span class="arrow">↔</span><span class="match-b">${r.colB || ''}</span></div>`;
      });
    } else if (layout === 'short-q' || layout === 'long' || layout === 'comprehension') {
      rows.forEach((r, i) => {
        html += `<div class="rte-block"><strong>${i + 1}. Q:</strong> ${r.question || ''}<br><strong style="color:${isColor ? '#0369A1' : '#333'}">A:</strong> ${r.answer || ''}</div>`;
      });
    } else if (layout === 'circle') {
      rows.forEach((r, i) => {
        html += `<div class="item"><div class="item-no">${i + 1}</div><div class="item-body">${r.statement || ''}</div><div class="item-ans">⭕ ${r.answer || ''}</div></div>`;
      });
    } else if (layout === 'punctuation') {
      rows.forEach((r, i) => {
        html += `<div class="punc-pair"><div class="punc-q">${i + 1}. ${r.question || ''}</div><div class="punc-a">${r.answer || ''}</div></div>`;
      });
    } else {
      const fields = cfg.fields || [];
      rows.forEach((r) => {
        html += `<div class="rte-block">${fields.map(f => `<div style="margin-bottom:5px"><strong>${f.label}:</strong> ${r[f.key] || ''}</div>`).join('')}</div>`;
      });
    }
    html += `</div></div>`;
  });

  const bg = isColor ? '#1E3A8A' : '#2C2C2C';
  html += `</div><div class="footer">${getSchoolName()} &nbsp;·&nbsp; School Mentor ERP · ${new Date().toLocaleDateString()} · ${isColor ? 'Colorful Report' : 'Colorless Report'}</div>
  <div class="no-print" style="text-align:center;padding:22px;background:#F8FAFC;border-top:1px solid #E2E8F0;margin-top:8px">
    <button onclick="window.print()" style="background:${bg};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px">🖨 Print / Save as PDF</button>
    <button onclick="window.close()" style="background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
  </div>
  </div></body></html>`;

  const w = window.open('', '_blank', 'width=1000,height=800');
  if (w) { w.document.write(html); w.document.close(); }
}

function generateLessonPlanReport(name, style, format, ctx) {
  /* Term Breakup — "<Class> — Term Breakup" */
  if (name.includes('Term Breakup')) {
    const cls = name.replace(/\s*—\s*Term Breakup\s*$/, '').trim();
    tbGenerateReport(cls, style);
    return;
  }

  /* Session Settings cards */
  if (name === 'Academic Session')  { generateCardReport('session',   style); return; }
  if (name === 'Vacations')         { generateCardReport('vacations', style); return; }
  if (name === 'Session Summary')   { generateCardReport('summary',   style); return; }

  /* Per Week Lesson Plans variants */
  if (name.startsWith('Per Week Lesson Plans')) {
    const type = name.includes('Combined') || name.includes('All') ? 'combined' : 'individual';
    lpOpenReport(type, style, ctx?.pwSelectedClass || '');
    return;
  }

  /* Notebook section PDF — "Section <id> — <type> — Unit <unitNo>" */
  if (name.startsWith('Section ')) {
    const m = name.match(/^Section\s+(\S+)\s+—\s+(.+?)\s+—\s+Unit\s+(\S+)$/);
    if (m) {
      const qId = m[1], unitNo = m[3];
      const unit = ctx?.nbUnits?.find(u => String(u.unitNo) === String(unitNo));
      const q = unit?.questions?.find(x => String(x.id) === String(qId));
      if (unit && q) {
        const typeKey = q.typeId || q.type;
        const questions = { [typeKey]: { mainQ: q.mainQ || q.mainQuestion || '', rows: q.rows || q.items || [] } };
        nbGeneratePdfHtml(unit, questions, style === 'color');
        return;
      }
    }
  }

  /* Notebook unit PDF — "Unit <unitNo> — Notebook" */
  if (/—\s*Notebook\s*$/.test(name)) {
    const m = name.match(/^Unit\s+(\S+)/);
    const unitNo = m ? m[1] : '';
    const unit = ctx?.nbUnits?.find(u => String(u.unitNo) === String(unitNo));
    if (unit) {
      const questions = {};
      (unit.questions || []).forEach(q => {
        const typeKey = q.typeId || q.type;
        if (typeKey) questions[typeKey] = { mainQ: q.mainQ || q.mainQuestion || '', rows: q.rows || q.items || [] };
      });
      nbGeneratePdfHtml(unit, questions, style === 'color');
      return;
    }
  }

  /* Unit / Lesson PDF — Create-Lesson-Plans */
  if (name.startsWith('Unit ')) {
    const m = name.match(/^Unit\s+([^\s—]+)/);
    const unitNo = m ? m[1] : '';
    const unit = ctx?.units?.find(u => String(u.unitNo) === String(unitNo));
    if (unit) { clpUnitPdfReport(unit, ctx, style); return; }
  }
  if (name.startsWith('Lesson ')) {
    /* Render lesson as a single-lesson unit using clpUnitPdfReport */
    const parts = name.match(/Unit\s+([^\s]+)$/);
    const unitNo = parts ? parts[1] : '';
    const unit = ctx?.units?.find(u => String(u.unitNo) === String(unitNo));
    const lessonMatch = name.match(/^Lesson\s+([^\s]+)\s+—\s+(.+?)\s+·\s+Unit/);
    if (unit && lessonMatch) {
      const lessonNum = lessonMatch[1];
      const lesson = unit.lessons.find(l => String(l.num) === String(lessonNum));
      if (lesson) {
        clpUnitPdfReport({ ...unit, lessons: [lesson] }, ctx, style);
        return;
      }
    }
  }

  /* Fallback — minimal report for any other name (e.g. "Unit …") */
  const isColor = style === 'color';
  const bg     = isColor ? '#1E3A8A' : '#2C2C2C';
  const textD  = isColor ? '#0F172A' : '#111';
  const textM  = isColor ? '#64748B' : '#555';
  const border = isColor ? '#BFDBFE' : '#CCC';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name} — Report</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:${textD};font-size:13px}.page{width:210mm;margin:0 auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}@page{size:A4;margin:15mm}}</style>
  </head><body><div class="page">
    <div style="background:${bg};padding:24px 32px 28px;color:#fff">
      ${getReportLogo(style)}
      <div style="font-size:22px;font-weight:800">${name}</div>
      <div style="font-size:13px;opacity:.75;margin-bottom:16px">Academic Year 2026–2027 · ${isColor ? 'Colorful' : 'Colorless'} Report</div>
      <div style="display:flex;gap:10px">
        <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        <div style="background:rgba(255,255,255,.14);padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Format:</strong> ${(format||'pdf').toUpperCase()}</div>
      </div>
    </div>
    <div style="padding:28px 32px"><p style="font-size:13px;color:${textM};line-height:1.7">Report content for <strong style="color:${textD}">${name}</strong>.</p></div>
    <div style="border-top:1px solid ${border};padding:14px 32px;font-size:11px;color:${textM};display:flex;justify-content:space-between">
      <span>${getSchoolName()}</span><span>School Mentor ERP © 2026</span>
    </div>
    <div class="no-print" style="text-align:center;padding:22px;background:#F8FAFC;border-top:1px solid #E2E8F0">
      <button onclick="window.print()" style="background:${bg};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px">🖨 Print / Save as PDF</button>
      <button onclick="window.close()" style="background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Close</button>
    </div>
  </div></body></html>`;

  const w = window.open('', '_blank', 'width=900,height=700');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ═══════════════════════════════════════════════════════════════════
   CSS
   ═══════════════════════════════════════════════════════════════════ */
const LP_CSS = `
.lp-l2-tabs {
  display:grid; grid-template-columns:repeat(4,1fr);
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg); overflow:hidden;
  margin-bottom:20px; box-shadow:var(--shadow-sm);
}
.lp-l2-tab {
  padding:13px 14px; text-align:center; cursor:pointer;
  font-size:13px; font-weight:700;
  background:transparent; color:var(--text-muted);
  border:none; font-family:var(--font-body);
  display:flex; align-items:center; justify-content:center; gap:8px;
  transition:all .2s ease;
  border-right:1.5px solid var(--border-light);
}
.lp-l2-tab:last-child { border-right:none; }
.lp-l2-tab:hover:not(.active) { background:var(--bg-muted); color:var(--brand-primary); }
.lp-l2-tab.active {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
  box-shadow:inset 0 -3px 0 rgba(255,255,255,.18);
}
.lp-l2-tab i { font-size:11.5px; }

/* ══════════════════════════════════════════════════
   REDESIGNED SESSION CARDS — verbatim from HTML
══════════════════════════════════════════════════ */
.ss-cards-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:20px; }
.ss-card { border-radius:22px; padding:22px 24px; position:relative; overflow:hidden; box-shadow:0 10px 32px rgba(30,58,138,.22),0 2px 8px rgba(0,0,0,.07); transition:transform .22s ease,box-shadow .22s ease; }
.ss-card:hover { transform:translateY(-3px); box-shadow:0 18px 44px rgba(30,58,138,.3),0 4px 12px rgba(0,0,0,.1); }
.ss-card--session   { background:linear-gradient(145deg,#1E3A8A 0%,#1E40AF 55%,#1D4ED8 100%); }
.ss-card--vacations { background:linear-gradient(145deg,#1E40AF 0%,#2563EB 60%,#3B82F6 100%); }
.ss-card--summary   { background:linear-gradient(145deg,#152D6E 0%,#1E3A8A 55%,#1E40AF 100%); }
.ss-card--lessons   { background:linear-gradient(145deg,#1E3A8A 0%,#1D4ED8 60%,#2563EB 100%); }
.ss-card-orb { position:absolute; border-radius:50%; pointer-events:none; background:rgba(255,255,255,.07); }
.ss-card-orb--1 { width:160px;height:160px;right:-40px;top:-50px; }
.ss-card-orb--2 { width:80px;height:80px;right:60px;bottom:-20px;background:rgba(255,255,255,.05); }
.ss-card-orb--3 { width:180px;height:180px;left:-50px;bottom:-60px; }
.ss-card-orb--4 { width:120px;height:120px;right:-30px;top:-30px; }
.ss-card-orb--5 { width:200px;height:200px;right:-70px;bottom:-60px;background:rgba(255,255,255,.05); }
.ss-card-hdr { display:flex;align-items:center;gap:13px;margin-bottom:18px;position:relative;z-index:1; }
.ss-card-badge { width:42px;height:42px;border-radius:13px;flex-shrink:0;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.15); }
.ss-card-hdr-title { font-size:15px;font-weight:800;color:#fff;line-height:1.2;letter-spacing:-.01em; }
.ss-card-hdr-sub   { font-size:11px;color:rgba(255,255,255,.6);margin-top:3px;font-weight:500; }
.ss-card-edit-btn  { margin-left:auto;width:32px;height:32px;border-radius:9px;flex-shrink:0;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.85);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;transition:var(--tr); }
.ss-card-edit-btn:hover { background:rgba(255,255,255,.28);color:#fff;transform:scale(1.1); }
.ss-data-rows { display:flex;flex-direction:column;gap:6px;margin-bottom:14px;position:relative;z-index:1; }
.ss-data-row  { display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.1);transition:background .15s; }
.ss-data-row:hover { background:rgba(255,255,255,.17); }
.ss-data-icon { width:26px;height:26px;border-radius:7px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,.9);flex-shrink:0; }
.ss-data-label { font-size:12px;color:rgba(255,255,255,.7);font-weight:500;flex:1; }
.ss-data-val   { font-size:13.5px;font-weight:800;color:#fff; }
.ss-highlight-banner { display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:11px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);font-size:13px;color:rgba(255,255,255,.9);font-weight:500;line-height:1.55;position:relative;z-index:1; }
.ss-highlight-banner strong { color:#fff;font-weight:800;font-size:15px; }
.ss-vac-list { display:flex;flex-direction:column;position:relative;z-index:1; }
.ss-vac-row  { display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.12);gap:10px; }
.ss-vac-left { display:flex;align-items:center;gap:12px;flex:1;min-width:0; }
.ss-vac-dot  { width:10px;height:10px;border-radius:50%;flex-shrink:0;background:#60A5FA;box-shadow:0 0 8px rgba(96,165,250,.6); }
.ss-vac-name  { font-size:13.5px;font-weight:700;color:#fff; }
.ss-vac-range { font-size:11px;color:rgba(255,255,255,.6);margin-top:2px;display:flex;align-items:center;gap:5px; }
.ss-vac-range i { font-size:9px; }
.ss-vac-days  { font-size:22px;font-weight:800;color:#fff;flex-shrink:0;text-align:center;line-height:1; }
.ss-vac-days span { display:block;font-size:9.5px;font-weight:600;color:rgba(255,255,255,.55);text-align:center;margin-top:1px;text-transform:uppercase;letter-spacing:.5px; }
.ss-summ-hero { display:flex;align-items:center;margin-bottom:14px;padding:14px 0;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);position:relative;z-index:1; }
.ss-summ-hero-item { flex:1;text-align:center; }
.ss-summ-big { font-size:36px;font-weight:800;color:#fff;line-height:1;letter-spacing:-.03em; }
.ss-summ-lbl { font-size:10.5px;color:rgba(255,255,255,.6);margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px; }
.ss-summ-divider { width:1px;height:56px;background:rgba(255,255,255,.2);flex-shrink:0; }
.ss-summ-pills { display:flex;gap:8px;position:relative;z-index:1; }
.ss-summ-pill { flex:1;padding:10px 8px;border-radius:12px;text-align:center; }
.ss-summ-pill--blue  { background:rgba(255,255,255,.14); }
.ss-summ-pill--green { background:rgba(34,197,94,.2); }
.ss-summ-pill--amber { background:rgba(245,158,11,.2); }
.ss-summ-pill-val { font-size:22px;font-weight:800;color:#fff;line-height:1; }
.ss-summ-pill-lbl { font-size:9.5px;color:rgba(255,255,255,.6);margin-top:4px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;justify-content:center;gap:4px; }

/* ── Class picker chips ── */
.lp-class-chips { margin-bottom:12px; position:relative; z-index:1; }
.lp-chips-label {
  font-size:10px; font-weight:800; letter-spacing:.9px; text-transform:uppercase;
  color:rgba(255,255,255,.55); margin-bottom:10px;
  display:flex; align-items:center; gap:6px;
}
.lp-chips-label::after { content:''; flex:1; height:1px; background:rgba(255,255,255,.15); }
.lp-chips-row { display:flex; flex-wrap:wrap; gap:5px; }
.lp-chip {
  height:30px; padding:0 13px; border-radius:var(--radius-full);
  border:1.5px solid rgba(255,255,255,.25);
  background:rgba(255,255,255,.1);
  color:rgba(255,255,255,.85); font-family:var(--font-body);
  font-size:11.5px; font-weight:700; cursor:pointer;
  transition:all .18s cubic-bezier(.4,0,.2,1);
  position:relative; white-space:nowrap;
}
.lp-chip:hover {
  background:rgba(255,255,255,.22);
  border-color:rgba(255,255,255,.55);
  color:#fff; transform:translateY(-1px);
  box-shadow:0 3px 10px rgba(0,0,0,.18);
}
.lp-chip.active {
  background:#fff;
  border-color:#fff;
  color:#1E3A8A;
  box-shadow:0 4px 14px rgba(0,0,0,.22);
  transform:translateY(-2px);
}
.lp-chip.active::after {
  content:'';
  position:absolute; bottom:-7px; left:50%; transform:translateX(-50%);
  width:0; height:0;
  border-left:5px solid transparent;
  border-right:5px solid transparent;
  border-top:6px solid #fff;
}

/* ── Per-week empty state ── */
.lp-pw-empty {
  display:flex; flex-direction:column; align-items:center;
  padding:18px 12px 10px; text-align:center;
  position:relative; z-index:1;
}
.lp-pw-empty-icon {
  width:52px; height:52px; border-radius:16px;
  background:rgba(255,255,255,.12);
  border:1.5px dashed rgba(255,255,255,.3);
  display:flex; align-items:center; justify-content:center;
  font-size:22px; color:rgba(255,255,255,.5);
  margin-bottom:12px;
}
.lp-pw-empty-text {
  font-size:12.5px; color:rgba(255,255,255,.6); line-height:1.6;
  max-width:230px; font-weight:500;
}
.lp-pw-empty-arrow {
  display:flex; align-items:center; gap:5px;
  margin-top:10px; font-size:11px; font-weight:700;
  color:rgba(255,255,255,.45); letter-spacing:.4px;
}

/* ── Per-week subject grid on dark card ── */
.lp-pw-grid {
  display:grid; gap:0;
  border:1px solid rgba(255,255,255,.18);
  border-radius:14px; overflow:hidden;
  margin-top:4px;
  position:relative; z-index:1;
}
.lp-pw-cell {
  padding:14px 10px; text-align:center;
  border-right:1px solid rgba(255,255,255,.12);
  border-bottom:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.08);
  transition:background .15s ease; cursor:default;
}
.lp-pw-cell:hover { background:rgba(255,255,255,.16); }
.lp-pw-cell-name {
  font-size:11px; font-weight:700; color:rgba(255,255,255,.65);
  text-transform:uppercase; letter-spacing:.4px; margin-bottom:8px;
}
.lp-pw-cell-num  {
  font-size:30px; font-weight:800; color:#fff; line-height:1;
  letter-spacing:-.02em;
}
.lp-pw-cell-lbl  {
  font-size:9px; font-weight:700; color:rgba(255,255,255,.45);
  text-transform:uppercase; letter-spacing:.7px; margin-top:5px;
}
@media(max-width:900px){ .ss-cards-grid{grid-template-columns:1fr;gap:14px;} }
@media(max-width:600px){ .ss-card{padding:18px;} .ss-summ-big{font-size:28px;} }

/* ── Unified card report bar (used on all 4 session cards + per-week) ── */
.ss-card-report-bar,
.lp-report-bar {
  display:flex; align-items:center; gap:10px;
  margin-top:16px; padding-top:13px;
  border-top:1px solid rgba(255,255,255,.14);
  position:relative; z-index:1; flex-wrap:wrap;
}
.ss-card-report-label,
.lp-report-bar-label {
  display:flex; align-items:center; gap:6px;
  font-size:9.5px; font-weight:800; letter-spacing:1px;
  text-transform:uppercase; color:rgba(255,255,255,.45);
  white-space:nowrap; flex-shrink:0;
}
.ss-card-report-label i,
.lp-report-bar-label i { font-size:10px; }

.ss-card-report-btns,
.lp-report-btns { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }

.ss-card-rpt-btn,
.lp-rpt-btn {
  display:inline-flex; align-items:center; gap:6px;
  height:32px; padding:0 14px; border-radius:var(--radius-full);
  font-family:var(--font-body); font-size:12px; font-weight:700;
  cursor:pointer; transition:all .18s cubic-bezier(.4,0,.2,1);
  white-space:nowrap; letter-spacing:.1px;
}
.ss-card-rpt-btn i,
.lp-rpt-btn i { font-size:12px; }

/* ── Color PDF — red filled pill ── */
.ss-card-rpt-btn--color,
.lp-rpt-btn--pdf {
  background:linear-gradient(135deg,rgba(239,68,68,.85),rgba(220,38,38,.9));
  border:1.5px solid rgba(255,120,100,.55);
  color:#fff;
  box-shadow:0 2px 10px rgba(220,38,38,.35);
}
.ss-card-rpt-btn--color:hover,
.lp-rpt-btn--pdf:hover {
  background:linear-gradient(135deg,#EF4444,#DC2626);
  border-color:rgba(255,140,120,.8);
  transform:translateY(-1px);
  box-shadow:0 4px 16px rgba(220,38,38,.5);
}

/* ── B&W — ghost white pill ── */
.ss-card-rpt-btn--bw,
.lp-rpt-btn--bw {
  background:rgba(255,255,255,.12);
  border:1.5px solid rgba(255,255,255,.35);
  color:rgba(255,255,255,.9);
}
.ss-card-rpt-btn--bw:hover,
.lp-rpt-btn--bw:hover {
  background:rgba(255,255,255,.22);
  border-color:rgba(255,255,255,.65);
  color:#fff;
  transform:translateY(-1px);
  box-shadow:0 3px 12px rgba(0,0,0,.2);
}

.lp-rpt-sep { width:1px; height:22px; background:rgba(255,255,255,.18); margin:0 2px; flex-shrink:0; }
.lp-rpt-btn {
  background:rgba(255,255,255,.12);
  border:1.5px solid rgba(255,255,255,.28);
  color:rgba(255,255,255,.88);
}
.lp-rpt-btn:hover {
  background:rgba(255,255,255,.22);
  border-color:rgba(255,255,255,.55);
  color:#fff; transform:translateY(-1px);
  box-shadow:0 3px 12px rgba(0,0,0,.2);
}
.lp-rpt-btn--pdf {
  background:linear-gradient(135deg,rgba(239,68,68,.85),rgba(220,38,38,.9));
  border-color:rgba(255,120,100,.55); color:#fff;
  box-shadow:0 2px 10px rgba(220,38,38,.35);
}
.lp-rpt-btn--pdf:hover {
  background:linear-gradient(135deg,#EF4444,#DC2626);
  border-color:rgba(255,140,120,.8);
  transform:translateY(-1px);
  box-shadow:0 4px 16px rgba(220,38,38,.5);
}
.lp-rpt-btn--bw {
  background:rgba(255,255,255,.12);
  border-color:rgba(255,255,255,.35);
  color:rgba(255,255,255,.9);
}
.ss-card-rpt-btn:active,
.lp-rpt-btn:active { transform:scale(.95); }
@media(max-width:600px) {
  .lp-report-btns { gap:5px; }
  .ss-card-rpt-btn,.lp-rpt-btn { font-size:10.5px; padding:0 11px; height:30px; }
  .lp-rpt-sep { display:none; }
}

/* ── Term Breakups ── */
.tb-breakup-head {
  display:flex; align-items:center;
  background:var(--bg-muted); border-bottom:1px solid var(--border-light);
  padding:0 20px;
}
.tb-bp-th {
  padding:11px 10px; font-size:10.5px; font-weight:700;
  color:var(--text-muted); letter-spacing:.6px; text-transform:uppercase;
}
.tb-row-wrap { border-bottom:1px solid var(--border-light); }
.tb-row-wrap:last-child { border-bottom:none; }
.tb-row { display:flex; align-items:center; padding:0 20px; min-height:60px; }
.tb-bp-td { padding:12px 10px; font-size:13px; display:flex; align-items:center; color:var(--text-secondary); }
.tb-sno { color:var(--brand-primary); font-weight:800; font-size:14px; }
.tb-cls-name { display:flex; align-items:center; gap:8px; font-weight:700; color:var(--text-primary); }
.tb-cls-icon {
  width:28px; height:28px; border-radius:7px;
  background:linear-gradient(135deg,rgba(30,58,138,.1),rgba(30,64,175,.06));
  color:var(--brand-primary); font-size:11px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.tb-update-btn {
  display:flex; align-items:center; gap:6px;
  padding:6px 14px; border-radius:var(--radius-md);
  background:linear-gradient(135deg,#1E40AF,#1E3A8A); color:#fff;
  border:none; cursor:pointer; font-family:var(--font-body);
  font-size:12px; font-weight:700;
  box-shadow:0 3px 10px rgba(30,58,138,.3); transition:var(--tr);
}
.tb-update-btn:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(30,58,138,.4); }
.tb-detail {
  background:linear-gradient(135deg,rgba(30,58,138,.02),rgba(30,58,138,.04));
  border-top:1px solid var(--border-light);
  animation:fadeSlide .25s ease both;
}
.tb-detail-inner { padding:16px 20px; display:flex; flex-direction:column; gap:14px; }
.tb-detail-section { display:flex; flex-direction:column; gap:6px; }
.tb-detail-label { font-size:10.5px; font-weight:800; letter-spacing:.8px; text-transform:uppercase; color:var(--text-muted); }
.tb-detail-pills { display:flex; flex-wrap:wrap; gap:6px; }
.tb-detail-pill {
  padding:5px 11px; border-radius:99px;
  background:var(--bg-card); border:1.5px solid var(--border-light);
  font-size:11.5px; font-weight:700; color:var(--text-secondary);
}
.tb-detail-pill.subj { background: rgba(30,58,138,.05); border-color: rgba(30,58,138,.18); color: var(--brand-primary); }
.tb-detail-actions { display:flex; gap:8px; align-items:center; }

/* Clickable Terms / Subjects pills — Term Breakups expanded row */
.tb-detail-pill--clickable {
  cursor: pointer;
  border: 1.5px solid var(--border-light);
  font-family: var(--font-body);
  font-size: 11.5px;
  font-weight: 700;
  transition: all .18s cubic-bezier(.4,0,.2,1);
}
.tb-detail-pill--clickable:hover {
  border-color: var(--brand-primary);
  background: rgba(30,58,138,.06);
  color: var(--brand-primary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(30,58,138,.12);
}
.tb-detail-pill--clickable.active {
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 3px 10px rgba(30,58,138,.3);
  transform: translateY(-1px);
}
.tb-detail-pill--clickable.subj.active {
  background: linear-gradient(135deg,#7C3AED,#6D28D9);
  box-shadow: 0 3px 10px rgba(124,58,237,.3);
}
[data-theme="dark"] .tb-detail-pill--clickable:hover {
  border-color: #3B82F6;
  background: rgba(59,130,246,.12);
  color: #93C5FD;
}

/* Term Breakup units/topics view */
/* Term Breakup units/topics view — teal/cyan card style */
/* Term Breakup units/topics view — original brand-blue card style */
.tbview-unit-card {
  border: 1px solid #E0EAF5;
  border-radius: 14px;
  overflow: hidden;
  margin-bottom: 16px;
  background: linear-gradient(135deg,#F7FBFF,#EEF5FC);
}
.tbview-unit-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 800;
  font-size: 15px;
  color:#2e3c8a;
  padding: 14px 18px;
}
.tbview-unit-weeks {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  flex-shrink: 0;
}
.tbview-table { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
.tbview-table th {
  background: linear-gradient(135deg,#3B5B9E,#3A55A8);
  color: #fff;
  font-weight: 600;
  padding: 10px 12px;
  text-align: center;
  font-size: 11px;
  white-space: nowrap;
}
.tbview-table td {
  padding: 10px 14px;
  vertical-align: middle;
}
.tbview-cell-pill {
  display: block;
  width: 100%;
  box-sizing: border-box;
  background: #F1F3F7;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--text-secondary, #475569);
  text-align: center;
  min-height: 38px;
  line-height: 20px;
}
.tbview-cell-pill--empty { min-height: 38px; }
[data-theme="dark"] .tbview-unit-card { background: rgba(30,58,138,.1); border-color: rgba(59,130,246,.3); }
[data-theme="dark"] .tbview-unit-hdr { color: #93C5FD; }
[data-theme="dark"] .tbview-cell-pill { background: rgba(255,255,255,.06); color: var(--text-primary); }

/* ── Term Breakup Modal (.tbm-*) — verbatim from HTML ── */
.tbm-overlay { position:fixed;inset:0;background:rgba(10,18,40,.5);backdrop-filter:blur(6px);z-index:1300;display:flex;align-items:center;justify-content:center;padding:24px 16px;opacity:0;pointer-events:none;transition:opacity .25s ease;overflow:hidden; }
.tbm-overlay.open { opacity:1;pointer-events:all; }
.tbm-modal {
  background:var(--bg-card);border-radius:var(--radius-xl);border:1px solid var(--border-light);
  box-shadow:0 24px 60px rgba(10,18,40,.28);width:100%;max-width:900px;
  transform:translateY(16px) scale(.97);transition:transform .28s cubic-bezier(.34,1.26,.64,1);
  display:flex;flex-direction:column;
  height:min(860px, calc(100vh - 48px));
  overflow:hidden;
}
.tbm-overlay.open .tbm-modal { transform:none; }

/* Header — fixed top */
.tbm-header {
  display:flex;align-items:flex-start;justify-content:space-between;
  padding:18px 24px 14px;border-bottom:1px solid var(--border-light);
  background:var(--bg-card);flex-shrink:0;
  border-radius:var(--radius-xl) var(--radius-xl) 0 0;
}
.tbm-title { font-size:16px;font-weight:800;color:var(--text-primary);letter-spacing:-.01em;display:flex;align-items:center; }
.tbm-close {
  width:32px;height:32px;border-radius:9px;border:none;
  background:var(--bg-muted);color:var(--text-muted);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;font-size:13px;transition:var(--tr);flex-shrink:0;
}
.tbm-close:hover { background:rgba(220,38,38,.1);color:var(--error); }

/* Term tabs — fixed below header */
.tbm-term-tabs {
  display:flex;gap:6px;flex-wrap:wrap;
  padding:12px 24px 12px;
  border-bottom:1px solid var(--border-light);
  background:var(--bg-card);flex-shrink:0;
}
.tbm-term-tab {
  height:34px;padding:0 18px;border-radius:var(--radius-full);
  border:1.5px solid var(--border-light);background:var(--bg-card);
  font-family:var(--font-body);font-size:12.5px;font-weight:700;
  color:var(--text-muted);cursor:pointer;transition:var(--tr);
}
.tbm-term-tab:hover { border-color:var(--brand-primary);color:var(--brand-primary); }
.tbm-term-tab.active {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  border-color:transparent;color:#fff;
  box-shadow:0 4px 14px rgba(30,58,138,.35);
}

/* Subject tabs — fixed below term tabs */
.tbm-subj-tabs-wrap {
  border-bottom:2px solid var(--border-light);
  overflow-x:auto;scrollbar-width:none;
  flex-shrink:0;background:var(--bg-card);
}
.tbm-subj-tabs-wrap::-webkit-scrollbar { display:none; }
.tbm-subj-tabs { display:flex;gap:0;white-space:nowrap;padding:0 24px; }
.tbm-subj-tab {
  padding:10px 18px;border:none;background:transparent;
  font-family:var(--font-body);font-size:13px;font-weight:600;
  color:var(--text-muted);cursor:pointer;transition:var(--tr);
  border-bottom:2.5px solid transparent;margin-bottom:-2px;flex-shrink:0;
}
.tbm-subj-tab:hover { color:var(--brand-primary); }
.tbm-subj-tab.active { color:var(--brand-primary);border-bottom-color:var(--brand-primary);font-weight:800; }

/* Scroll wrapper — this is the ONLY thing that scrolls */
.tbm-scroll-area {
  flex:1;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  min-height:0;
  scrollbar-width:thin;
  scrollbar-color:rgba(30,64,175,.3) transparent;
}
.tbm-scroll-area::-webkit-scrollbar { width:5px; }
.tbm-scroll-area::-webkit-scrollbar-track { background:transparent; }
.tbm-scroll-area::-webkit-scrollbar-thumb { background:rgba(30,64,175,.25);border-radius:3px; }
.tbm-scroll-area::-webkit-scrollbar-thumb:hover { background:rgba(30,64,175,.45); }

/* Body — units container inside scroll area */
.tbm-body {
  padding:16px 24px 8px;
  display:flex;flex-direction:column;gap:14px;
}

/* Add More Units row — inside scroll area, at the bottom */
.tbm-add-units-row {
  text-align:center;
  padding:8px 24px 20px;
  background:var(--bg-card);
}

/* Footer — fixed bottom */
.tbm-footer {
  display:flex;justify-content:flex-end;gap:10px;
  padding:14px 24px 20px;
  border-top:1px solid var(--border-light);
  flex-shrink:0;background:var(--bg-card);
  border-radius:0 0 var(--radius-xl) var(--radius-xl);
}

.tbm-btn { height:40px;padding:0 26px;border-radius:var(--radius-md);font-family:var(--font-body);font-size:13.5px;font-weight:700;cursor:pointer;transition:var(--tr); }
.tbm-btn--cancel { background:var(--bg-muted);border:1.5px solid var(--border-light);color:var(--text-muted); }
.tbm-btn--cancel:hover { background:var(--bg-card);color:var(--text-primary); }
.tbm-btn--save { background:linear-gradient(135deg,#1E3A8A,#1E40AF);border:none;color:#fff;box-shadow:0 4px 12px rgba(30,58,138,.3); }
.tbm-btn--save:hover { transform:translateY(-1px);box-shadow:0 8px 20px rgba(30,58,138,.4); }

/* ── Unit block ── */
.tbm-unit-block {
  background:rgba(30,58,138,.03);border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg);overflow:hidden;
}
.tbm-unit-top {
  display:grid;grid-template-columns:200px 1fr 170px auto;
  gap:12px;align-items:end;padding:16px 16px 12px;
  border-bottom:1px solid var(--border-light);background:var(--bg-card);
}
.tbm-unit-top-btns { display:flex;gap:6px;align-items:flex-end; }
.tbm-unit-save-btn {
  width:38px;height:38px;border-radius:var(--radius-md);
  border:1.5px solid rgba(30,64,175,.25);background:rgba(30,64,175,.07);
  color:var(--brand-primary);cursor:pointer;font-size:14px;
  display:flex;align-items:center;justify-content:center;transition:var(--tr);
}
.tbm-unit-save-btn:hover { background:rgba(30,64,175,.16);transform:scale(1.06); }

/* ── Topic rows ── */
.tbm-topics-area { padding:10px 16px 14px;display:flex;flex-direction:column;gap:8px; }
.tbm-topic-row {
  display:grid;grid-template-columns:1fr 200px auto;
  gap:10px;align-items:center;
}
  .tbm-topic-action-cell {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 100%;
  padding-top: 18px;
}
.tbm-topic-del-btn {
  width:38px;height:38px;border-radius:var(--radius-md);
  border:1.5px solid rgba(220,38,38,.25);background:rgba(220,38,38,.06);
  color:#DC2626;cursor:pointer;font-size:13px;
  display:flex;align-items:center;justify-content:center;transition:var(--tr);
}
.tbm-topic-del-btn:hover { background:rgba(220,38,38,.16);transform:scale(1.06); }
.tbm-topic-add-btn {
  display:inline-flex;align-items:center;gap:7px;
  height:36px;padding:0 16px;margin-top:4px;
  border-radius:var(--radius-full);border:none;
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color:#fff;font-family:var(--font-body);font-size:12.5px;font-weight:700;
  cursor:pointer;transition:var(--tr);box-shadow:0 3px 10px rgba(30,58,138,.25);
}
.tbm-topic-add-btn:hover { transform:translateY(-1px);box-shadow:0 5px 16px rgba(30,58,138,.35); }

/* ── Inputs ── */
.tbm-input {
  width:100%;height:40px;
  border:1.5px solid var(--border-light);border-radius:var(--radius-md);
  padding:0 12px;font-family:var(--font-body);font-size:13px;
  color:var(--text-primary);background:var(--input-bg);
  outline:none;transition:var(--tr);
}
.tbm-input:hover { border-color:var(--border-med); }
.tbm-input:focus { border-color:var(--brand-primary);box-shadow:0 0 0 3px rgba(30,58,138,.09); }
.tbm-input::placeholder { color:var(--text-muted);font-size:12.5px; }
.tbm-label { font-size:11px;font-weight:700;color:var(--text-secondary);letter-spacing:.2px;margin-bottom:5px;display:block; }

/* ── Add More Units ── */
.tbm-add-units-btn {
  display:inline-flex;align-items:center;gap:8px;
  height:38px;padding:0 22px;border-radius:var(--radius-full);
  border:1.5px solid var(--brand-primary);background:transparent;
  font-family:var(--font-body);font-size:13px;font-weight:700;
  color:var(--brand-primary);cursor:pointer;transition:var(--tr);
}
.tbm-add-units-btn:hover { background:var(--brand-light); }

@media(max-width:768px){
  .tbm-unit-top {
    grid-template-columns:1fr !important;
    gap:10px !important;
    padding:14px 14px 12px !important;
  }
  .tbm-unit-top > div { width:100% !important; }
  .tbm-unit-top-btns { flex-direction:row; gap:8px; width:100%; }
  .tbm-unit-save-btn { flex:1; width:auto; border-radius:var(--radius-md); }

  .tbm-topic-row { grid-template-columns:1fr auto !important; gap:8px; }
  .tbm-topic-row > div:nth-child(2) { display:none; }

  .tbm-term-tabs { padding:12px 14px 0; gap:6px; flex-wrap:wrap; }
  .tbm-term-tab { height:32px; padding:0 14px; font-size:12px; }

  .tbm-subj-tabs-wrap { padding:10px 14px 0; }
  .tbm-subj-tab { padding:7px 12px; font-size:12px; }

  .tbm-unit-block { border-radius:var(--radius-md); }
  .tbm-topics-area { padding:8px 14px 12px; }

  .tbm-input { height:42px; font-size:13px; }

  .tbm-add-units-btn { width:100%; justify-content:center; }
  .tbm-footer { padding:12px 14px 16px; gap:8px; }
  .tbm-btn { height:46px; font-size:14px; flex:1; }

  .tbm-body { padding:14px 14px 8px; }
}

/* ── Create Lesson Plans hero ── */
.clp2-hero-card {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; border-radius:18px; padding:20px 24px;
  box-shadow:0 10px 30px rgba(30,58,138,.22); margin-bottom:18px;
  position:relative; overflow:hidden;
}
.clp2-hero-inner { display:flex; flex-direction:column; gap:18px; }
.clp2-hero-text {}
.clp2-hero-title { font-size:18px; font-weight:800; letter-spacing:-.02em; display:flex; align-items:center; gap:10px; }
.clp2-hero-icon {
  width:36px; height:36px; border-radius:10px;
  background:rgba(255,255,255,.18); color:#fff; font-size:14px;
  display:inline-flex; align-items:center; justify-content:center;
}
.clp2-hero-sub { font-size:12px; opacity:.85; margin-top:4px; padding-left:46px; }
.clp2-filter-row { display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:10px; align-items:end; }
.clp2-field { display:flex; flex-direction:column; gap:5px; }
.clp2-field-label { font-size:10.5px; font-weight:700; letter-spacing:.5px; text-transform:uppercase; opacity:.85; display:flex; align-items:center; gap:6px; }
.clp2-select-wrap { position:relative; }
.clp2-select {
  width:100%; height:42px; padding:0 36px 0 14px;
  background:rgba(255,255,255,.16); border:1.5px solid rgba(255,255,255,.28);
  color:#fff; border-radius:11px; outline:none;
  font-family:var(--font-body); font-size:13px; font-weight:600;
  appearance:none; cursor:pointer;
}
.clp2-select option { color:#0F172A; }
.clp2-select-arrow { position:absolute; right:14px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:.85; }
.clp2-fetch-btn {
  height:42px; padding:0 22px; border-radius:11px;
  background:#fff; color:#1E3A8A; border:none;
  font-family:var(--font-body); font-size:13px; font-weight:800;
  cursor:pointer; display:flex; align-items:center; gap:8px;
  box-shadow:0 6px 18px rgba(0,0,0,.18); transition:var(--tr);
}
.clp2-fetch-btn:hover { transform:translateY(-1px); box-shadow:0 10px 24px rgba(0,0,0,.22); }

.clp2-toolbar {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  margin-bottom:14px; flex-wrap:wrap;
}
.clp2-subtabs {
  display:flex; background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:11px; padding:4px; gap:4px;
}
.clp2-subtab {
  padding:9px 16px; border-radius:8px; border:none;
  background:transparent; color:var(--text-muted);
  font-family:var(--font-body); font-size:12.5px; font-weight:700;
  cursor:pointer; display:flex; align-items:center; gap:7px; transition:var(--tr);
}
.clp2-subtab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
.clp2-subtab.active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; }
.clp2-add-btn {
  height:40px; padding:0 18px; border-radius:11px;
  background:linear-gradient(135deg,#1E40AF,#1E3A8A); color:#fff;
  border:none; cursor:pointer; font-family:var(--font-body);
  font-size:13px; font-weight:800;
  display:flex; align-items:center; gap:8px;
  box-shadow:0 6px 16px rgba(30,58,138,.32); transition:var(--tr);
}
.clp2-add-btn:hover { transform:translateY(-1px); box-shadow:0 10px 22px rgba(30,58,138,.4); }

.clp2-table-card {
  background:var(--bg-card); border:1px solid var(--border-light);
  border-radius:14px; overflow:hidden; box-shadow:var(--shadow-sm);
}
.clp2-empty-state {
  text-align:center; padding:48px 24px;
  background:var(--bg-card); border:1px solid var(--border-light);
  border-radius:14px;
}
.clp2-empty-icon {
  width:64px; height:64px; border-radius:18px;
  background:linear-gradient(135deg,rgba(30,58,138,.08),rgba(30,64,175,.04));
  color:var(--brand-primary); font-size:26px;
  display:inline-flex; align-items:center; justify-content:center; margin-bottom:14px;
}
.clp2-empty-title { font-size:15px; font-weight:800; color:var(--text-primary); margin-bottom:4px; }
.clp2-empty-sub { font-size:12.5px; color:var(--text-muted); }

/* ── Unit rows ── */
.clpr-unit { border-bottom:1px solid var(--border-light); }
.clpr-unit:last-child { border-bottom:none; }
.clpr-unit-row {
  display:grid; grid-template-columns:60px 80px 1fr auto auto;
  align-items:center; gap:12px; padding:14px 18px;
  cursor:default;
}
.clpr-unit-row:hover { background:var(--bg-muted); }
.clpr-unit-sno {
  width:34px; height:34px; border-radius:10px;
  background:linear-gradient(135deg,#EFF6FF,#DBEAFE);
  color:var(--brand-primary); font-size:13px; font-weight:800;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.clpr-unit-no {
  font-size:12px; font-weight:800; color:var(--brand-primary);
  background:rgba(30,58,138,.08); padding:5px 11px; border-radius:99px;
  display:inline-block; white-space:nowrap;
}
.clpr-unit-name { font-size:14px; font-weight:700; color:var(--text-primary); }
.clpr-unit-stats { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
/* ── Unit row lesson stats — verbatim from HTML ── */
.clpr-stat-sep { color:var(--border-med); font-size:10px; }
.clpr-stat {
  display:inline-flex; align-items:center; gap:3px;
  font-size:10.5px; font-weight:700; padding:1px 7px;
  border-radius:20px; white-space:nowrap;
}
.clpr-stat i { font-size:9px; }
.clpr-stat--total  { background:rgba(30,58,138,.07);  color:#1E40AF; }
.clpr-stat--manual { background:rgba(22,163,74,.08);  color:#15803D; }
.clpr-stat--ai     { background:rgba(124,58,237,.08); color:#7C3AED; }
.clpr-unit-actions { display:flex; gap:6px; align-items:center; }

/* ── CLPR — Compact Mobile-First Unit Card — verbatim from HTML ── */
.clpr-unit-card {
  margin: 8px 10px;
  border-radius: 16px;
  border: 1.5px solid var(--border-light);
  background: var(--bg-card);
  box-shadow: 0 2px 8px rgba(30,58,138,.05);
  overflow: hidden;
  transition: box-shadow .2s ease;
}
.clpr-unit-card.open {
  box-shadow: 0 4px 20px rgba(30,58,138,.1);
  border-color: rgba(30,64,175,.2);
}
.clpr-unit-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; cursor: pointer; gap: 8px;
  transition: background .15s ease; min-width:0;
}
.clpr-unit-card.open .clpr-unit-header {
  background: linear-gradient(135deg,rgba(30,58,138,.04),rgba(30,64,175,.02));
  border-bottom: 1px solid var(--border-light);
}
.clpr-unit-left { display:flex; align-items:center; gap:10px; min-width:0; flex:1 1 0; overflow:hidden; }
.clpr-unit-icon-wrap {
  width:38px; height:38px; border-radius:11px; flex-shrink:0; flex-grow:0;
  background:linear-gradient(135deg,#1E3A8A,#2563EB);
  color:#fff; font-size:15px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 3px 10px rgba(30,58,138,.22);
}
.clpr-unit-info { min-width:0; flex:1 1 0; overflow:hidden; }
.clpr-unit-card .clpr-unit-name {
  font-size:14px; font-weight:700; color:var(--text-primary);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  line-height:1.3; min-width:0;
}
.clpr-unit-sub {
  font-size:11px; color:var(--text-muted); margin-top:2px;
  display:flex; align-items:center; gap:4px; flex-wrap:nowrap;
  white-space:nowrap; overflow:hidden;
}
.clpr-unit-card .clpr-unit-stats {
  display:flex; align-items:center; gap:5px;
  flex:1; justify-content:flex-end; flex-wrap:nowrap;
  padding:0 16px 0 0;
}
.clpr-unit-right { display:flex; align-items:center; gap:5px; flex:0 0 auto; }

/* ── Shared icon button ── */
.clpr-icon-btn {
  width:34px; height:34px; border-radius:9px; border:1.5px solid;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; transition:all .16s ease; font-size:12px;
  background:transparent; flex-shrink:0;
}
.clpr-icon-btn--pdf {
  border-color:rgba(220,38,38,.2); background:rgba(220,38,38,.05); color:#DC2626;
}
.clpr-icon-btn--pdf:hover { background:#DC2626; color:#fff; border-color:#DC2626; }
.clpr-icon-btn--del {
  border-color:rgba(220,38,38,.2); background:rgba(220,38,38,.04); color:#DC2626;
}
.clpr-icon-btn--del:hover { background:#DC2626; color:#fff; border-color:#DC2626; }
.clpr-icon-btn--expand {
  border-color:var(--border-light); background:var(--bg-muted); color:var(--text-muted);
  transition:all .25s cubic-bezier(.34,1.26,.64,1);
}
.clpr-icon-btn--expand.open {
  border-color:rgba(30,58,138,.3); color:#1E40AF;
  background:rgba(30,58,138,.07); transform:rotate(180deg);
}
@media (max-width:900px) {
  .clpr-unit-card .clpr-stat--manual, .clpr-unit-card .clpr-stat--ai,
  .clpr-unit-card .clpr-unit-stats .clpr-stat-sep:nth-child(n+2) { display:none; }
}
@media (max-width:768px) {
  .clpr-unit-card .clpr-unit-stats { display:none !important; }
  .clpr-unit-card .clpr-unit-left  { flex:1; max-width:none; }
}
@media (max-width:600px) {
  .clpr-unit-card .clpr-unit-header { padding:12px 14px; gap:8px; }
  .clpr-unit-card .clpr-unit-name { font-size:13px; }
}

/* ── NOTEBOOK ADD QUESTIONS BUTTON — verbatim from HTML ── */
.nb-aq-pill {
  all: unset;
  box-sizing: border-box;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  border: 2px solid #1E3A8A;
  background: linear-gradient(135deg,#EEF2FF,#E0E7FF);
  color: #1E3A8A;
  font-size: 12.5px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(30,58,138,.15);
  transition: background .18s, color .18s, box-shadow .18s, transform .12s;
}
.nb-aq-pill:hover {
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  color: #fff;
  border-color: #1E40AF;
  box-shadow: 0 4px 16px rgba(30,58,138,.4);
}
.nb-aq-pill:active { transform: scale(.95); }
.nb-aq-icon { font-size: 10px; pointer-events: none; }
.nb-aq-label { pointer-events: none; }
@media (max-width:768px) {
  .nb-aq-pill {
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: 50%;
    gap: 0;
    font-size: 16px;
    box-shadow: 0 2px 10px rgba(30,58,138,.2);
  }
  .nb-aq-icon { font-size: 15px; }
  .nb-aq-label { display: none; }
}

.clpr-lessons-panel {
  background:rgba(30,58,138,.02);
  border-top:1px solid var(--border-light);
  padding:8px 18px 12px;
  animation:fadeSlide .25s ease both;
}
.clpr-lesson-row {
  display:flex; align-items:center; gap:10px;
  padding:8px 10px; border-radius:8px;
  border:1px solid var(--border-light); background:var(--bg-card);
  margin-top:6px;
}

/* ── Lesson cards (compact single row) — verbatim from HTML ── */
.clpr-no-lessons {
  display:flex; align-items:center; justify-content:center; gap:7px;
  padding:16px 0; color:var(--text-muted); font-size:12.5px;
}
.clpr-lesson-card {
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:11px;
  border-left:3px solid #2563EB;
  margin-bottom:6px;
  margin-top:6px;
  transition:all .16s ease;
  overflow:visible;
}
.clpr-lesson-card:last-child { margin-bottom:0; }
.clpr-lesson-card:hover { border-color:rgba(30,64,175,.3); box-shadow:0 3px 12px rgba(30,58,138,.08); }
.clpr-lesson-top {
  display:flex; align-items:center; gap:8px;
  padding:9px 12px;
  flex-wrap:nowrap;
}
.clpr-lesson-meta {
  display:flex; align-items:center; gap:6px; flex:1; min-width:0;
}
.clpr-lesson-num {
  font-size:10.5px; font-weight:800; color:var(--text-muted);
  background:var(--bg-muted); border:1px solid var(--border-light);
  padding:2px 7px; border-radius:5px; flex-shrink:0;
  position:relative;
}
.clpr-lesson-num-tag {
  font-size:10.5px; font-weight:800; color:#1E40AF;
  background:rgba(30,58,138,.08); padding:2px 7px; border-radius:5px; flex-shrink:0;
}
.clpr-lesson-file-icon { color:var(--text-muted); font-size:12px; flex-shrink:0; }
.clpr-lesson-name {
  flex:1; min-width:0; font-size:12.5px; font-weight:700;
  color:var(--text-primary); white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis;
}
.clpr-lesson-actions { display:flex; align-items:center; gap:5px; flex-shrink:0; }
.clpr-action-btn {
  display:inline-flex; align-items:center; gap:5px;
  height:28px; padding:0 10px; border-radius:7px;
  font-family:var(--font-body); font-size:11px; font-weight:700;
  cursor:pointer; transition:all .16s ease;
  border:1.5px solid; background:transparent; white-space:nowrap;
}
.clpr-action-edit {
  border-color:rgba(30,58,138,.25); background:rgba(30,58,138,.05); color:#1E40AF;
}
.clpr-action-edit:hover { background:#1E40AF; color:#fff; border-color:#1E40AF; }
.clpr-action-pdf {
  border-color:rgba(220,38,38,.25); background:rgba(220,38,38,.05); color:#DC2626;
}
.clpr-action-pdf:hover { background:#DC2626; color:#fff; border-color:#DC2626; }
.clpr-action-del {
  border-color:rgba(220,38,38,.2); background:rgba(220,38,38,.04); color:#DC2626;
  padding:0; width:28px; justify-content:center;
}
.clpr-action-del:hover { background:#DC2626; color:#fff; border-color:#DC2626; }
@media (max-width:600px) {
  .clpr-action-btn span { display:none; }
  .clpr-action-btn { padding:0; width:28px; justify-content:center; }
}
.clpr-lesson-num {
  width:28px; height:28px; border-radius:8px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.clpr-lesson-topic { flex:1; font-size:13px; font-weight:600; color:var(--text-primary); min-width:0; }

/* ── Lesson source label — verbatim from HTML .clp-src-badge ── */
.clp-src-badge,
.clpr-source-pill {
  display:inline-flex; align-items:center; gap:4px;
  padding:2px 9px; border-radius:var(--radius-full);
  font-size:10.5px; font-weight:700; letter-spacing:.02em; flex-shrink:0;
}
.clp-src-badge.manual,
.clpr-source-pill.manual {
  background:rgba(22,163,74,.1); color:#16A34A; border:1px solid rgba(22,163,74,.2);
}
.clp-src-badge.ai,
.clpr-source-pill.mentorai {
  background:linear-gradient(135deg,rgba(124,58,237,.12),rgba(99,102,241,.1));
  color:#7C3AED; border:1px solid rgba(124,58,237,.22);
}
.clpr-q-type {
  font-size:11.5px; font-weight:800; color:#fff;
  background:linear-gradient(135deg,#7C3AED,#4F46E5);
  padding:5px 11px; border-radius:99px; white-space:nowrap;
}
.clpr-q-main { flex:1; font-size:12.5px; color:var(--text-secondary); min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.clpr-q-count { font-size:11px; font-weight:700; color:var(--text-muted); white-space:nowrap; }

.lp-mini-btn {
  display:inline-flex; align-items:center; gap:5px;
  height:30px; padding:0 11px; border-radius:8px;
  border:none; cursor:pointer; font-family:var(--font-body);
  font-size:11.5px; font-weight:700; transition:var(--tr);
}
.lp-mini-btn.primary {
  background:linear-gradient(135deg,#1E40AF,#1E3A8A); color:#fff;
  box-shadow:0 3px 8px rgba(30,58,138,.25);
}
.lp-mini-btn.primary:hover { transform:translateY(-1px); }

.lp-icon-del {
  width:34px; height:34px; border-radius:50%; border:none;
  background:rgba(220,38,38,.08); color:#DC2626;
  border:2px solid rgba(220,38,38,.25);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:12px; transition:var(--tr); flex-shrink:0;
}
.lp-icon-del:hover { background:#DC2626; color:#fff; transform:scale(1.1); box-shadow:0 3px 10px rgba(220,38,38,.3); }
.lp-icon-del.small { width:28px; height:28px; font-size:10px; }

/* ══════════════════════════════════════════════════
   ADD QUESTIONS MODAL — verbatim from HTML
══════════════════════════════════════════════════ */
.aq-overlay {
  position:fixed; inset:0;
  background:rgba(2,6,23,.72); backdrop-filter:blur(12px);
  z-index:9500; display:none; align-items:center; justify-content:center;
  padding:12px;
}
.aq-overlay.open { display:flex; }
.aq-modal {
  background:#fff; border-radius:24px;
  border:1px solid rgba(6,182,212,.2);
  box-shadow:0 40px 100px rgba(2,6,23,.3), 0 0 0 1px rgba(6,182,212,.1);
  width:100%; max-width:900px; max-height:92vh;
  display:flex; flex-direction:column;
  overflow:hidden;
}
.aq-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 24px; flex-shrink:0; position:relative; overflow:hidden;
  background:linear-gradient(135deg,#0C4A6E 0%,#0369A1 50%,#0891B2 100%);
}
.aq-header::before {
  content:''; position:absolute; top:-40px; right:-40px;
  width:160px; height:160px; border-radius:50%;
  background:rgba(255,255,255,.06); pointer-events:none;
}
.aq-header::after {
  content:''; position:absolute; bottom:-30px; left:20%;
  width:100px; height:100px; border-radius:50%;
  background:rgba(255,255,255,.04); pointer-events:none;
}
.aq-header-left { display:flex; align-items:center; gap:14px; z-index:1; }
.aq-header-icon {
  width:42px; height:42px; border-radius:13px;
  background:rgba(255,255,255,.2); color:#fff;
  font-size:18px; display:flex; align-items:center; justify-content:center;
  flex-shrink:0; box-shadow:0 4px 12px rgba(0,0,0,.15);
}
.aq-title { font-size:17px; font-weight:800; color:#fff; letter-spacing:-.02em; }
.aq-sub   { font-size:12px; color:rgba(255,255,255,.65); margin-top:2px; }
.aq-close-hover {
  all:unset; box-sizing:border-box;
  width:34px; height:34px; border-radius:10px;
  background:rgba(255,255,255,.15); color:#fff;
  cursor:pointer; font-size:14px;
  display:flex; align-items:center; justify-content:center;
  transition:all .2s; z-index:1;
}
.aq-close-hover:hover { background:rgba(220,38,38,.75); transform:scale(1.08); }

.aq-body {
  flex:1; overflow-y:auto; display:flex; flex-direction:column;
  background:#F0F9FF;
}
.aq-body::-webkit-scrollbar { width:5px; }
.aq-body::-webkit-scrollbar-thumb { background:#BAE6FD; border-radius:3px; }

.aq-type-section {
  padding:16px 22px 10px; flex-shrink:0;
  background:#fff;
  border-bottom:1.5px solid #E0F2FE;
}
.aq-type-label {
  font-size:10.5px; font-weight:800; color:#0E7490;
  text-transform:uppercase; letter-spacing:.8px; margin-bottom:12px;
  display:flex; align-items:center; gap:6px;
}
.aq-type-label::before {
  content:''; display:inline-block; width:3px; height:14px;
  background:linear-gradient(#0369A1,#06B6D4); border-radius:2px;
}
.aq-types-grid { display:flex; flex-wrap:wrap; gap:7px; }

.aq-type-btn-hover {
  display:inline-flex; align-items:center; gap:6px;
  height:34px; padding:0 13px; border-radius:10px;
  border:1.5px solid #BAE6FD; background:#EFF9FF;
  color:#0369A1; font-family:inherit; font-size:12px; font-weight:700;
  cursor:pointer; transition:all .18s ease;
  white-space:nowrap; flex-shrink:0;
}
.aq-type-btn-hover:hover {
  border-color:#0891B2; background:#E0F2FE;
  transform:translateY(-1px); box-shadow:0 3px 8px rgba(6,182,212,.2);
}
.aq-type-btn-hover.active {
  background:linear-gradient(135deg,#0369A1,#0891B2);
  color:#fff; border-color:transparent;
  box-shadow:0 4px 14px rgba(6,182,212,.4);
  transform:translateY(-1px);
}

.aq-form-area { flex:1; padding:16px 22px 16px; }

/* MQ input — verbatim */
.aq-mq-input {
  box-sizing:border-box; display:block; width:100%;
  height:48px; border:2px solid #BAE6FD;
  border-radius:13px; padding:0 16px;
  font-family:inherit; font-size:14px; font-weight:500; color:#0F172A;
  background:#fff; outline:none; transition:all .2s;
}
.aq-mq-input:focus {
  border-color:#0891B2; background:#FAFFFE;
  box-shadow:0 0 0 4px rgba(6,182,212,.12);
}
.aq-mq-input::placeholder { color:#94A3B8; font-weight:400; }

/* Row card */
.aq-row-card-hover {
  background:#fff; border:1.5px solid #BAE6FD; border-radius:14px;
  padding:16px 18px; margin-bottom:10px;
  transition:all .2s; cursor:default;
}
.aq-row-card-hover:hover {
  box-shadow:0 6px 20px rgba(6,182,212,.15);
  border-color:#7DD3FC; transform:translateY(-1px);
}

/* Inputs / textareas inside rows */
.aq-inp-hover {
  box-sizing:border-box; display:block; width:100%;
  height:44px; border:1.5px solid #CBD5E1; border-radius:10px;
  padding:0 13px; font-family:inherit; font-size:14px; color:#0F172A;
  background:#fff; outline:none; transition:all .18s;
}
.aq-inp-hover:hover { border-color:#7DD3FC; background:#FAFFFE; }
.aq-inp-hover:focus { border-color:#0891B2; background:#fff; box-shadow:0 0 0 3px rgba(6,182,212,.12); }

.aq-ta-hover {
  box-sizing:border-box; display:block; width:100%;
  min-height:80px; border:1.5px solid #CBD5E1; border-radius:10px;
  padding:10px 13px; font-family:inherit; font-size:14px; color:#0F172A;
  background:#fff; outline:none; resize:vertical; line-height:1.6;
  transition:all .18s;
}
.aq-ta-hover:hover { border-color:#7DD3FC; background:#FAFFFE; }
.aq-ta-hover:focus { border-color:#0891B2; background:#fff; box-shadow:0 0 0 3px rgba(6,182,212,.12); }

/* Row action buttons */
.aq-rb-btn {
  display:inline-flex; align-items:center; gap:5px;
  height:36px; padding:0 16px; border-radius:9px;
  border:1.5px solid rgba(220,38,38,.35);
  background:rgba(220,38,38,.04); color:#DC2626;
  font-size:12.5px; font-weight:700; cursor:pointer;
  transition:all .18s; font-family:inherit;
}
.aq-rb-btn:hover {
  background:#DC2626; color:#fff; border-color:#DC2626;
  box-shadow:0 4px 12px rgba(220,38,38,.3); transform:translateY(-1px);
}
.aq-sb-btn {
  display:inline-flex; align-items:center; gap:5px;
  height:36px; padding:0 16px; border-radius:9px;
  border:1.5px solid #0891B2; background:#fff; color:#0369A1;
  font-size:12.5px; font-weight:700; cursor:pointer;
  transition:all .18s; font-family:inherit;
}
.aq-sb-btn:hover {
  background:#0891B2; color:#fff; border-color:#0891B2;
  box-shadow:0 4px 12px rgba(6,182,212,.3); transform:translateY(-1px);
}

/* Add More */
.aq-add-more-hover {
  display:inline-flex; align-items:center; gap:8px;
  height:44px; padding:0 32px; border-radius:999px;
  background:linear-gradient(135deg,#0C4A6E,#0369A1,#0891B2); color:#fff;
  border:none; font-family:inherit; font-size:14px; font-weight:800;
  cursor:pointer; box-shadow:0 6px 18px rgba(6,182,212,.32);
  transition:all .22s;
}
.aq-add-more-hover:hover {
  transform:translateY(-2px);
  box-shadow:0 10px 28px rgba(6,182,212,.45);
  filter:brightness(1.08);
}
.aq-add-more-hover:active { transform:translateY(0); filter:brightness(.97); }

/* True/False */
.aq-tf-t-hover {
  flex:1; height:48px; border-radius:13px;
  font-family:inherit; font-size:15px; font-weight:800;
  cursor:pointer; transition:all .2s;
  display:flex; align-items:center; justify-content:center; gap:8px;
  border:2px solid #16A34A; color:#16A34A; background:#fff;
}
.aq-tf-t-hover:hover, .aq-tf-t-hover.sel {
  background:linear-gradient(135deg,#15803D,#16A34A); color:#fff;
  border-color:transparent; box-shadow:0 4px 14px rgba(22,163,74,.35);
  transform:translateY(-1px);
}
.aq-tf-f-hover {
  flex:1; height:48px; border-radius:13px;
  font-family:inherit; font-size:15px; font-weight:800;
  cursor:pointer; transition:all .2s;
  display:flex; align-items:center; justify-content:center; gap:8px;
  border:2px solid #DC2626; color:#DC2626; background:#fff;
}
.aq-tf-f-hover:hover, .aq-tf-f-hover.sel {
  background:linear-gradient(135deg,#B91C1C,#DC2626); color:#fff;
  border-color:transparent; box-shadow:0 4px 14px rgba(220,38,38,.35);
  transform:translateY(-1px);
}

/* Cancel / Save-all footer buttons */
.aq-cancel-hover {
  flex:1; height:48px; border-radius:13px;
  border:2px solid #E2E8F0; background:#F1F5F9; color:#64748B;
  font-family:inherit; font-size:14px; font-weight:700;
  cursor:pointer; transition:all .18s;
}
.aq-cancel-hover:hover { background:#E2E8F0; color:#334155; border-color:#CBD5E1; }
.aq-save-all-hover {
  flex:1; height:48px; border-radius:13px; border:none;
  background:linear-gradient(135deg,#0C4A6E,#0369A1,#0891B2); color:#fff;
  font-family:inherit; font-size:14px; font-weight:700;
  cursor:pointer; box-shadow:0 6px 18px rgba(6,182,212,.35);
  display:flex; align-items:center; justify-content:center; gap:8px;
  transition:all .2s;
}
.aq-save-all-hover:hover {
  filter:brightness(1.1); transform:translateY(-2px);
  box-shadow:0 10px 26px rgba(6,182,212,.45);
}
.aq-save-all-hover:active { transform:translateY(0); }

/* Mobile */
@media (max-width:600px) {
  .aq-overlay { padding:0; align-items:flex-end; }
  .aq-modal { border-radius:22px 22px 0 0; max-height:96vh; max-width:100%; }
  .aq-type-btn-hover { font-size:11px; padding:0 10px; height:32px; }
  .aq-form-area { padding:12px 14px; }
}

/* ══════════════════════════════════════════════════
   SUBMISSIONS — Teacher view — verbatim from HTML
══════════════════════════════════════════════════ */
@keyframes subModalIn { from{opacity:0;transform:translateY(16px) scale(.96)} to{opacity:1;transform:none} }

.sub-hero-card {
  border-radius:22px;
  background:linear-gradient(145deg,#1E3A8A 0%,#1E40AF 55%,#1D4ED8 100%);
  padding:24px 28px 20px; margin-bottom:20px;
  position:relative; overflow:hidden;
  box-shadow:0 10px 32px rgba(30,58,138,.28),0 2px 8px rgba(0,0,0,.08);
}
.sub-hero-orb { position:absolute; border-radius:50%; pointer-events:none; background:rgba(255,255,255,.06); }
.sub-hero-orb--1 { width:220px;height:220px;right:-60px;top:-80px; }
.sub-hero-orb--2 { width:120px;height:120px;left:40px;bottom:-50px;background:rgba(255,255,255,.04); }
.sub-hero-inner { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:20px; position:relative; z-index:1; flex-wrap:wrap; }
.sub-hero-left  { display:flex; align-items:center; gap:14px; }
.sub-hero-icon-wrap {
  width:48px; height:48px; border-radius:14px;
  background:rgba(255,255,255,.2); border:1px solid rgba(255,255,255,.3);
  display:flex; align-items:center; justify-content:center;
  font-size:20px; color:#fff; flex-shrink:0;
  box-shadow:0 4px 14px rgba(0,0,0,.18);
}
.sub-hero-title { font-size:18px; font-weight:800; color:#fff; letter-spacing:-.02em; line-height:1.2; }
.sub-hero-sub   { font-size:12px; color:rgba(255,255,255,.65); margin-top:3px; }

.sub-role-toggle {
  display:flex; gap:4px;
  background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2);
  border-radius:var(--radius-full); padding:4px;
}
.sub-role-btn {
  display:flex; align-items:center; gap:6px;
  height:32px; padding:0 14px; border-radius:var(--radius-full);
  border:none; font-family:var(--font-body);
  font-size:12px; font-weight:700; cursor:pointer;
  transition:all .2s cubic-bezier(.4,0,.2,1);
  background:transparent; color:rgba(255,255,255,.7);
}
.sub-role-btn:hover { color:#fff; background:rgba(255,255,255,.1); }
.sub-role-btn.active { background:rgba(255,255,255,.95); color:#1E3A8A; box-shadow:0 2px 10px rgba(0,0,0,.18); }
.sub-role-btn i { font-size:11px; }

.sub-filter-row { position:relative; z-index:2; }
.sub-filter-fields { display:grid; grid-template-columns:1fr 1fr 1fr auto; gap:10px; align-items:end; }
.sub-field { display:flex; flex-direction:column; gap:5px; }
.sub-field-label {
  font-size:10px; font-weight:800; letter-spacing:.6px;
  text-transform:uppercase; color:rgba(255,255,255,.6);
  display:flex; align-items:center; gap:5px;
}
.sub-field-label i { font-size:9px; }
.sub-select-wrap { position:relative; }
.sub-select {
  width:100%; height:44px;
  border:1.5px solid rgba(255,255,255,.25); border-radius:var(--radius-md);
  padding:0 36px 0 14px; font-family:var(--font-body);
  font-size:13px; font-weight:600; color:var(--text-primary);
  background:#fff; outline:none; cursor:pointer;
  appearance:none; -webkit-appearance:none;
}
.sub-select-arrow {
  position:absolute; right:11px; top:50%; transform:translateY(-50%);
  color:#64748B; pointer-events:none; font-size:10px;
}
.sub-fetch-btn {
  height:44px; padding:0 22px; border-radius:var(--radius-md);
  border:none; background:rgba(255,255,255,.95); color:#1E3A8A;
  font-family:var(--font-body); font-size:13px; font-weight:800;
  cursor:pointer; display:flex; align-items:center; gap:8px;
  white-space:nowrap; box-shadow:0 4px 14px rgba(0,0,0,.15);
}
.sub-fetch-btn:hover { background:#fff; transform:translateY(-1px); box-shadow:0 8px 22px rgba(0,0,0,.2); }

/* Empty state */
.sub-empty-state { text-align:center; padding:72px 24px; }
.sub-empty-icon {
  width:80px; height:80px; border-radius:22px; margin:0 auto 18px;
  background:linear-gradient(135deg,rgba(30,58,138,.08),rgba(30,64,175,.05));
  color:var(--brand-primary); font-size:32px;
  display:flex; align-items:center; justify-content:center;
}
.sub-empty-title { font-size:17px; font-weight:800; color:var(--text-primary); margin-bottom:7px; }
.sub-empty-sub   { font-size:13.5px; color:var(--text-muted); line-height:1.6; max-width:380px; margin:0 auto; }

/* Analytics strip */
.sub-analytics-strip { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:18px; }
.sub-stat-card {
  background:var(--bg-card); border:1px solid var(--border-light);
  border-radius:var(--radius-lg); padding:16px 18px;
  box-shadow:var(--shadow-sm); transition:var(--tr);
  position:relative; overflow:hidden;
}
.sub-stat-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
.sub-stat-icon {
  width:38px; height:38px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  font-size:16px; margin-bottom:10px;
}
.sub-stat-val { font-size:28px; font-weight:800; line-height:1; letter-spacing:-.03em; color:var(--text-primary); margin-bottom:4px; }
.sub-stat-lbl { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; }
.sub-stat-prog { margin-top:10px; height:5px; border-radius:3px; background:var(--bg-muted); overflow:hidden; }
.sub-stat-prog-bar { height:100%; border-radius:3px; transition:width .6s cubic-bezier(.4,0,.2,1); }
.sub-stat-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:10px; }
.sub-stat-card-top .sub-stat-icon { margin-bottom:0; flex-shrink:0; }
.sub-stat-sub-badge {
  font-size:10px; font-weight:700; padding:3px 8px;
  border-radius:var(--radius-full); white-space:nowrap;
  line-height:1.4; text-align:right; flex:1; opacity:.85;
}

/* Inner tabs */
.sub-inner-tabs {
  display:flex; gap:6px; margin-bottom:16px;
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  border-radius:var(--radius-xl); padding:5px;
}
.sub-inner-tab {
  flex:1; display:flex; align-items:center; justify-content:center;
  gap:8px; padding:11px 16px; border-radius:var(--radius-lg);
  border:none; font-family:var(--font-body);
  font-size:13px; font-weight:700; cursor:pointer;
  transition:all .22s cubic-bezier(.4,0,.2,1);
  background:transparent; color:var(--text-muted);
}
.sub-inner-tab:hover:not(.active) { background:var(--bg-card); color:var(--brand-primary); box-shadow:var(--shadow-xs); }
.sub-inner-tab.active {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color:#fff;
  box-shadow:0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}
.sub-inner-count {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:22px; height:20px; padding:0 6px;
  border-radius:var(--radius-full); font-size:10.5px; font-weight:800;
  background:rgba(255,255,255,.2); color:inherit;
}
.sub-inner-tab:not(.active) .sub-inner-count { background:var(--brand-light); color:var(--brand-primary); }

/* Toolbar */
.sub-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.sub-toolbar-left { display:flex; align-items:center; gap:12px; }

/* LP unit blocks */
.sub-lp-unit-block { border:1.5px solid var(--border-light); border-radius:var(--radius-lg); overflow:hidden; margin-bottom:10px; background:var(--bg-card); transition:var(--tr); }
.sub-lp-unit-block:hover { border-color:var(--border-med); box-shadow:var(--shadow-sm); }
.sub-lp-unit-header {
  display:flex; align-items:center; gap:12px;
  padding:14px 16px; cursor:pointer; user-select:none;
  background:linear-gradient(135deg,rgba(30,58,138,.04),transparent);
  border-bottom:1.5px solid transparent;
}
.sub-lp-unit-block.open .sub-lp-unit-header { border-bottom-color:var(--border-light); }
.sub-lp-unit-badge {
  flex-shrink:0; padding:4px 10px; border-radius:var(--radius-full);
  background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
  font-size:11px; font-weight:800; letter-spacing:.3px; white-space:nowrap;
}
.sub-lp-unit-info { flex:1; min-width:0; }
.sub-lp-unit-name { font-size:13.5px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sub-lp-unit-prog { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; min-width:70px; }
.sub-lp-unit-pct { font-size:12px; font-weight:800; }
.sub-lp-unit-bar { width:80px; height:5px; border-radius:3px; background:var(--border-light); overflow:hidden; }
.sub-lp-unit-bar-fill { height:100%; border-radius:3px; transition:width .4s ease; }
.sub-lp-unit-chevron {
  flex-shrink:0; width:28px; height:28px; border-radius:8px;
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; color:var(--text-muted);
}
.sub-lp-unit-block.open .sub-lp-unit-chevron i { transform:rotate(180deg); }
.sub-lp-unit-chevron i { transition:transform .25s ease; }
.sub-lp-unit-body { padding:10px 10px 6px; }

/* LP cards */
.sub-lp-card {
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg); padding:0;
  margin-bottom:10px; transition:var(--tr);
  box-shadow:var(--shadow-xs); overflow:hidden;
}
.sub-lp-card:hover { border-color:var(--border-med); box-shadow:var(--shadow-sm); transform:translateY(-1px); }
.sub-lp-card.is-submitted { border-color:rgba(22,163,74,.3); }
.sub-lp-card-inner { display:grid; grid-template-columns:48px 1fr auto; gap:0; align-items:stretch; }
.sub-lp-body { padding:14px 16px; display:flex; align-items:center; gap:12px; flex:1; min-width:0; }
.sub-lp-num {
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center;
}
.sub-lp-info { flex:1; min-width:0; }
.sub-lp-title { font-size:13.5px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:4px; }
.sub-lp-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.sub-lp-meta-item { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-muted); font-weight:500; }
.sub-lp-meta-item i { font-size:9.5px; color:var(--brand-primary); opacity:.7; }
.sub-unit-badge { background:rgba(30,58,138,.08); color:#1E40AF; border-radius:var(--radius-full); padding:2px 8px; font-weight:700; }
.sub-lp-actions { display:flex; align-items:center; gap:8px; padding:14px 16px; flex-shrink:0; }
.sub-lp-status {
  display:inline-flex; align-items:center; gap:5px;
  padding:4px 11px; border-radius:var(--radius-full);
  font-size:11px; font-weight:700; white-space:nowrap;
}
.sub-lp-status--pending   { background:rgba(217,119,6,.1); color:#D97706; }
.sub-lp-status--submitted { background:rgba(22,163,74,.1); color:#16A34A; }
.sub-lp-view-btn {
  display:flex; align-items:center; gap:5px;
  height:32px; padding:0 13px; border-radius:var(--radius-md);
  border:1.5px solid rgba(30,58,138,.2); background:rgba(30,58,138,.06);
  color:var(--brand-primary); font-family:var(--font-body);
  font-size:11.5px; font-weight:700; cursor:pointer; transition:var(--tr);
}
.sub-lp-view-btn:hover { background:var(--brand-primary); color:#fff; border-color:var(--brand-primary); transform:scale(1.04); }

/* LP viewer modal */
.lp-viewer-overlay {
  position:fixed; inset:0; background:rgba(2,6,23,.72);
  backdrop-filter:blur(14px); z-index:9999;
  display:none; align-items:center; justify-content:center; padding:16px;
}
.lp-viewer-overlay.open { display:flex; }
.lp-viewer-modal {
  background:var(--bg-card); border-radius:22px;
  width:100%; max-width:720px; max-height:90vh;
  display:flex; flex-direction:column;
  box-shadow:0 40px 100px rgba(2,6,23,.4);
  border:1.5px solid var(--border-light);
  animation:subModalIn .22s cubic-bezier(.34,1.56,.64,1) both;
}
.lp-viewer-header {
  display:flex; align-items:center; gap:14px;
  padding:20px 24px 18px; border-bottom:1.5px solid var(--border-light); flex-shrink:0;
}
.lp-viewer-header-icon {
  width:46px; height:46px; border-radius:13px;
  background:linear-gradient(135deg,#EFF6FF,#DBEAFE);
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.lp-viewer-header-icon i { color:#1E3A8A; font-size:20px; }
.lp-viewer-title { font-size:17px; font-weight:800; color:var(--text-primary); }
.lp-viewer-sub   { font-size:12px; color:var(--text-muted); margin-top:2px; }
.lp-viewer-close {
  margin-left:auto; width:34px; height:34px; border-radius:10px;
  background:var(--bg-muted); border:none; color:var(--text-muted);
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:14px; flex-shrink:0;
}
.lp-viewer-close:hover { background:var(--border-light); color:var(--text-primary); }
.lp-viewer-body { flex:1; overflow-y:auto; padding:24px; }
.lp-viewer-section {
  margin-bottom:20px; padding:18px 20px;
  background:var(--bg-muted); border-radius:var(--radius-lg);
  border:1.5px solid var(--border-light);
}
.lp-viewer-section-label {
  font-size:10.5px; font-weight:800; letter-spacing:.8px;
  text-transform:uppercase; color:var(--brand-primary);
  margin-bottom:8px; display:flex; align-items:center; gap:7px;
}
.lp-viewer-section-label::after { content:''; flex:1; height:1px; background:var(--border-light); }
.lp-viewer-section-value { font-size:14px; color:var(--text-primary); font-weight:500; line-height:1.6; }
.lp-viewer-meta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
.lp-viewer-meta-card { padding:14px 16px; background:var(--bg-muted); border-radius:var(--radius-md); border:1.5px solid var(--border-light); }
.lp-viewer-meta-key { font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.6px; margin-bottom:4px; }
.lp-viewer-meta-val { font-size:13px; font-weight:700; color:var(--text-primary); }
.lp-viewer-footer {
  display:flex; align-items:center; justify-content:flex-end; gap:10px;
  padding:16px 24px; border-top:1.5px solid var(--border-light); flex-shrink:0;
}
.lp-viewer-submit-btn {
  display:flex; align-items:center; gap:8px;
  height:42px; padding:0 22px; border-radius:var(--radius-md);
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  border:none; color:#fff; font-family:var(--font-body);
  font-size:13px; font-weight:700; cursor:pointer;
  box-shadow:0 4px 14px rgba(30,58,138,.35);
}
.lp-viewer-submit-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); box-shadow:0 8px 22px rgba(30,58,138,.45); }
.lp-viewer-submit-btn.done,
.lp-viewer-submit-btn:disabled {
  background:linear-gradient(135deg,#16A34A,#15803D);
  box-shadow:0 4px 14px rgba(22,163,74,.3); cursor:default;
}
.lp-viewer-cancel-btn {
  display:flex; align-items:center; gap:7px;
  height:42px; padding:0 18px; border-radius:var(--radius-md);
  background:transparent; border:1.5px solid var(--border-med);
  color:var(--text-muted); font-family:var(--font-body);
  font-size:13px; font-weight:600; cursor:pointer;
}
.lp-viewer-cancel-btn:hover { background:var(--bg-muted); color:var(--text-primary); }

/* SNB (notebook submissions) */
.snb-unit-block {
  border:1.5px solid var(--border-light); border-radius:var(--radius-lg);
  margin-bottom:14px; overflow:hidden; background:var(--bg-card);
  box-shadow:var(--shadow-xs); transition:border-color .18s, box-shadow .18s;
}
.snb-unit-block:hover { border-color:var(--border-med); box-shadow:var(--shadow-sm); }
.snb-unit-hdr {
  display:flex; flex-direction:column; gap:6px; padding:14px 16px;
  cursor:pointer; user-select:none;
  background:linear-gradient(135deg,rgba(30,58,138,.04),rgba(30,64,175,.02));
  border-bottom:1.5px solid transparent;
}
.snb-unit-block.open .snb-unit-hdr { border-bottom-color:var(--border-light); background:linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.03)); }
.snb-unit-row1 { display:flex; align-items:center; gap:10px; }
.snb-unit-row1 .snb-unit-name { flex:1; min-width:0; }
.snb-unit-badge {
  flex-shrink:0; padding:5px 12px; border-radius:var(--radius-full);
  background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
  font-size:11px; font-weight:800; letter-spacing:.3px; white-space:nowrap;
  box-shadow:0 3px 10px rgba(30,58,138,.28);
}
.snb-unit-icon-wrap {
  width:38px; height:38px; border-radius:11px; flex-shrink:0;
  background:linear-gradient(135deg,rgba(30,58,138,.1),rgba(30,64,175,.06));
  color:var(--brand-primary); font-size:16px;
  display:flex; align-items:center; justify-content:center;
}
.snb-unit-name { font-size:14px; font-weight:800; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.snb-unit-meta { display:flex; align-items:center; gap:8px; font-size:11.5px; font-weight:600; color:var(--text-muted); flex-wrap:wrap; padding-left:2px; }
.snb-unit-meta i { font-size:10px; }
.snb-sep { opacity:.4; }
.snb-unit-prog-wrap { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; min-width:80px; }
.snb-unit-pct { font-size:12.5px; font-weight:800; }
.snb-unit-bar { width:90px; height:6px; border-radius:3px; background:var(--bg-muted); overflow:hidden; }
.snb-unit-bar-fill { height:100%; border-radius:3px; transition:width .5s cubic-bezier(.4,0,.2,1); }
.snb-unit-chevron {
  flex-shrink:0; width:30px; height:30px; border-radius:9px;
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; color:var(--text-muted);
}
.snb-unit-chevron i { transition:transform .28s cubic-bezier(.4,0,.2,1); }
.snb-unit-block.open .snb-unit-chevron { background:rgba(30,58,138,.08); border-color:var(--border-med); color:var(--brand-primary); }
.snb-unit-block.open .snb-unit-chevron i { transform:rotate(180deg); }
.snb-unit-body { padding:10px 12px 12px; }

.snb-qtype-row {
  position:relative; margin-bottom:8px;
  border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  background:var(--bg-card); overflow:hidden;
}
.snb-qtype-row:hover { border-color:var(--border-med); box-shadow:var(--shadow-xs); }
.snb-qtype-row.open { border-color:var(--border-med); box-shadow:var(--shadow-sm); }
.snb-qtype-hdr {
  display:flex; flex-direction:column; gap:4px; padding:11px 14px;
  cursor:pointer; user-select:none;
  background:linear-gradient(135deg,rgba(30,58,138,.02),transparent);
  border-bottom:1px solid transparent;
}
.snb-qtype-row.open .snb-qtype-hdr { border-bottom-color:var(--border-light); background:rgba(30,58,138,.04); }
.snb-qtype-row-a { display:flex; align-items:center; gap:10px; }
.snb-qtype-row-a .snb-qtype-label { flex:1; min-width:0; }
.snb-qtype-connector {
  position:absolute; left:18px; top:-9px; width:2px; height:9px;
  background:linear-gradient(180deg,var(--border-med),var(--border-light));
  border-radius:1px; pointer-events:none;
}
.snb-qtype-row:first-child .snb-qtype-connector { display:none; }
.snb-qtype-icon {
  width:34px; height:34px; border-radius:10px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:14px; color:#fff; box-shadow:0 3px 10px rgba(0,0,0,.14);
}
.snb-qtype-label { font-size:13px; font-weight:800; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.snb-qtype-mq { font-size:11px; color:var(--text-muted); padding-left:44px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-style:italic; }
.snb-qtype-badges { display:flex; align-items:center; gap:5px; flex-shrink:0; }
.snb-badge {
  display:inline-flex; align-items:center; gap:3px;
  padding:3px 8px; border-radius:var(--radius-full);
  font-size:11px; font-weight:700;
}
.snb-badge i { font-size:9px; }
.snb-badge--sub  { background:rgba(22,163,74,.1); color:#16A34A; }
.snb-badge--pend { background:rgba(217,119,6,.1); color:#D97706; }
.snb-qtype-prog-wrap { display:flex; flex-direction:column; align-items:flex-end; gap:3px; flex-shrink:0; min-width:64px; }
.snb-qtype-pct { font-size:11.5px; font-weight:800; }
.snb-qtype-bar { width:70px; height:5px; border-radius:3px; background:var(--bg-muted); overflow:hidden; }
.snb-qtype-bar-fill { height:100%; border-radius:3px; transition:width .5s ease; }
.snb-qtype-chevron {
  flex-shrink:0; width:26px; height:26px; border-radius:7px;
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  display:flex; align-items:center; justify-content:center;
  font-size:10px; color:var(--text-muted);
}
.snb-qtype-chevron i { transition:transform .25s ease; }
.snb-qtype-row.open .snb-qtype-chevron { background:rgba(30,58,138,.08); border-color:var(--border-med); color:var(--brand-primary); }
.snb-qtype-row.open .snb-qtype-chevron i { transform:rotate(180deg); }
.snb-qtype-submit-btn {
  display:flex; align-items:center; gap:6px;
  height:32px; padding:0 13px; border-radius:var(--radius-md);
  background:linear-gradient(135deg,#7C3AED,#6D28D9);
  border:none; color:#fff; font-family:var(--font-body);
  font-size:11.5px; font-weight:700; cursor:pointer;
  white-space:nowrap; flex-shrink:0;
  box-shadow:0 3px 10px rgba(124,58,237,.3);
}
.snb-qtype-submit-btn:hover { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 6px 16px rgba(124,58,237,.4); }
.snb-done-badge {
  display:flex; align-items:center; gap:5px;
  font-size:11px; font-weight:700; color:#16A34A;
  padding:0 10px; flex-shrink:0; white-space:nowrap;
}
.snb-items-panel { background:var(--bg-muted); border-top:1px solid var(--border-light); }
.sub-qitem {
  display:flex; align-items:center;
  border-bottom:1px solid var(--border-light); min-width:0;
}
.sub-qitem:last-child { border-bottom:none; }
.sub-qitem.is-submitted { background:rgba(22,163,74,.03); }
.sub-qitem-body { padding:11px 14px; display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
.sub-qitem-num {
  width:24px; height:24px; border-radius:7px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:10px; font-weight:800; color:#fff;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
}
.sub-qitem-text {
  font-size:13px; color:var(--text-primary); line-height:1.5;
  flex:1; min-width:0;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.sub-qitem-actions { display:flex; align-items:center; gap:6px; padding:11px 14px; flex-shrink:0; }
.sub-qitem-status {
  display:inline-flex; align-items:center; gap:4px;
  padding:3px 9px; border-radius:var(--radius-full);
  font-size:10.5px; font-weight:700; white-space:nowrap;
}
.sub-qitem-status--pending   { background:rgba(217,119,6,.1); color:#D97706; }
.sub-qitem-status--submitted { background:rgba(22,163,74,.1); color:#16A34A; }

/* NB submit modal */
.nb-submit-overlay {
  position:fixed; inset:0; background:rgba(2,6,23,.72);
  backdrop-filter:blur(14px); z-index:9999;
  display:none; align-items:center; justify-content:center; padding:16px;
}
.nb-submit-overlay.open { display:flex; }
.nb-submit-modal {
  background:var(--bg-card); border-radius:22px;
  width:100%; max-width:560px; max-height:88vh;
  display:flex; flex-direction:column;
  box-shadow:0 40px 100px rgba(2,6,23,.4);
  border:1.5px solid var(--border-light);
  animation:subModalIn .22s cubic-bezier(.34,1.56,.64,1) both;
}
.nb-submit-modal-header {
  display:flex; align-items:center; gap:13px;
  padding:20px 24px 16px; border-bottom:1.5px solid var(--border-light); flex-shrink:0;
}
.nb-submit-modal-icon {
  width:44px; height:44px; border-radius:12px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center; font-size:18px; color:#fff;
}
.nb-submit-modal-title { font-size:16px; font-weight:800; color:var(--text-primary); }
.nb-submit-modal-sub   { font-size:12px; color:var(--text-muted); margin-top:2px; }
.nb-submit-modal-close {
  margin-left:auto; width:34px; height:34px; border-radius:10px;
  background:var(--bg-muted); border:none; color:var(--text-muted);
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:14px; flex-shrink:0;
}
.nb-submit-modal-close:hover { background:var(--border-light); color:var(--text-primary); }
.nb-submit-modal-toolbar {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 24px; border-bottom:1px solid var(--border-light);
  background:var(--bg-muted); flex-shrink:0;
}
.nb-submit-select-all-label { display:flex; align-items:center; gap:8px; font-size:12.5px; font-weight:700; color:var(--text-secondary); cursor:pointer; }
.nb-submit-count-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:var(--radius-full);
  background:rgba(30,64,175,.1); color:#1E40AF;
  font-size:11px; font-weight:700;
}
.nb-submit-items-list { flex:1; overflow-y:auto; padding:16px 24px; display:flex; flex-direction:column; gap:8px; }
.nb-submit-item {
  display:flex; align-items:center; gap:12px;
  padding:12px 14px; border-radius:var(--radius-md);
  border:1.5px solid var(--border-light); background:var(--bg-card);
  cursor:pointer;
}
.nb-submit-item:hover { border-color:var(--border-med); background:var(--bg-muted); }
.nb-submit-item.is-checked { border-color:var(--brand-primary); background:rgba(30,58,138,.04); }
.nb-submit-item.is-submitted { opacity:.6; cursor:default; }
.nb-submit-item-num {
  width:26px; height:26px; border-radius:8px; flex-shrink:0;
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; font-weight:800; color:var(--text-muted);
}
.nb-submit-item.is-checked .nb-submit-item-num { background:rgba(30,58,138,.1); border-color:rgba(30,58,138,.2); color:#1E40AF; }
.nb-submit-item-text { flex:1; font-size:13px; color:var(--text-primary); font-weight:500; min-width:0; }
.nb-submit-item-status {
  font-size:11px; font-weight:700; padding:3px 9px; border-radius:var(--radius-full);
  flex-shrink:0;
}
.nb-submit-item-status.submitted { background:rgba(22,163,74,.1); color:#16A34A; }
.nb-submit-item-status.pending   { background:rgba(217,119,6,.1); color:#D97706; }
.nb-submit-modal-footer {
  display:flex; align-items:center; justify-content:flex-end; gap:10px;
  padding:16px 24px; border-top:1.5px solid var(--border-light); flex-shrink:0;
}
.nb-submit-modal-submit-btn {
  display:flex; align-items:center; gap:8px;
  height:42px; padding:0 22px; border-radius:var(--radius-md);
  background:linear-gradient(135deg,#7C3AED,#6D28D9);
  border:none; color:#fff; font-family:var(--font-body);
  font-size:13px; font-weight:700; cursor:pointer;
  box-shadow:0 4px 14px rgba(124,58,237,.35);
}
.nb-submit-modal-submit-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-1px); }
.nb-submit-modal-submit-btn:disabled { opacity:.45; cursor:not-allowed; }
.nb-submit-modal-cancel-btn {
  display:flex; align-items:center; gap:7px;
  height:42px; padding:0 18px; border-radius:var(--radius-md);
  background:transparent; border:1.5px solid var(--border-med);
  color:var(--text-muted); font-family:var(--font-body);
  font-size:13px; font-weight:600; cursor:pointer;
}
.nb-submit-modal-cancel-btn:hover { background:var(--bg-muted); color:var(--text-primary); }

@media (max-width:900px) {
  .sub-filter-fields { grid-template-columns:1fr 1fr; }
  .sub-analytics-strip { grid-template-columns:1fr 1fr; }
  .lp-viewer-meta-grid { grid-template-columns:1fr; }
}
@media (max-width:600px) {
  .sub-filter-fields { grid-template-columns:1fr; }
  .sub-fetch-btn { width:100%; justify-content:center; }
  .sub-analytics-strip { grid-template-columns:1fr; }
  .sub-lp-card-inner { grid-template-columns:1fr !important; }
  .sub-lp-actions { padding-top:0; flex-wrap:wrap; }
  .snb-qtype-row-a { flex-wrap:wrap; }
  .snb-qtype-prog-wrap { display:none; }
  .snb-qtype-mq { padding-left:0; }
  .lp-viewer-overlay,
  .nb-submit-overlay { padding:8px; }
}

/* ══════════════════════════════════════════════════
   SUBMISSION PDF REPORT MODAL — verbatim from HTML
══════════════════════════════════════════════════ */
.sub-pdf-btn {
  display:inline-flex; align-items:center; gap:5px;
  height:32px; padding:0 12px; border-radius:var(--radius-md);
  background:linear-gradient(135deg,#DC2626,#B91C1C);
  border:none; color:#fff; font-family:var(--font-body);
  font-size:11.5px; font-weight:700; cursor:pointer; transition:var(--tr);
  white-space:nowrap; box-shadow:0 3px 10px rgba(220,38,38,.28); flex-shrink:0;
}
.sub-pdf-btn:hover { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 6px 18px rgba(220,38,38,.4); }
.sub-pdf-btn--unit { height:28px; font-size:10.5px; padding:0 10px; }

.sub-pdf-overlay {
  position:fixed; inset:0; background:rgba(2,6,23,.7);
  backdrop-filter:blur(18px); z-index:10000;
  display:none; align-items:center; justify-content:center; padding:16px;
}
.sub-pdf-overlay.open { display:flex; }
.sub-pdf-modal {
  background:var(--bg-card); border-radius:22px;
  width:100%; max-width:560px; max-height:92vh; overflow:auto;
  box-shadow:0 32px 80px rgba(2,6,23,.5), 0 0 0 1px var(--border-light);
  animation:subModalIn .22s cubic-bezier(.34,1.56,.64,1) both;
}
.sub-pdf-glow { height:3px; background:linear-gradient(90deg,#1E3A8A 0%,#2563EB 40%,#DC2626 70%,#EF4444 100%); }

.sub-pdf-header {
  display:flex; align-items:center; gap:13px;
  padding:18px 22px 16px;
  border-bottom:1.5px solid var(--border-light);
  background:linear-gradient(135deg,rgba(220,38,38,.03),transparent);
}
.sub-pdf-header-icon {
  width:44px; height:44px; border-radius:12px; flex-shrink:0;
  background:linear-gradient(135deg,#DC2626,#B91C1C);
  display:flex; align-items:center; justify-content:center;
  font-size:20px; color:#fff;
  box-shadow:0 6px 16px rgba(220,38,38,.35);
}
.sub-pdf-title { font-size:16px; font-weight:800; color:var(--text-primary); line-height:1.2; }
.sub-pdf-sub   { font-size:11.5px; color:var(--text-muted); margin-top:3px; }
.sub-pdf-close {
  margin-left:auto; width:32px; height:32px; border-radius:9px; flex-shrink:0;
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  color:var(--text-muted); cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  font-size:13px;
}
.sub-pdf-close:hover { background:var(--border-light); color:var(--text-primary); }

.sub-pdf-school-bar {
  display:flex; align-items:center; gap:11px;
  padding:13px 22px;
  background:linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.02));
  border-bottom:1.5px solid var(--border-light);
}
.sub-pdf-school-logo {
  width:40px; height:40px; border-radius:11px; flex-shrink:0;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  display:flex; align-items:center; justify-content:center;
  font-size:18px; color:#fff;
  box-shadow:0 4px 12px rgba(30,58,138,.3);
}
.sub-pdf-school-name { font-size:13px; font-weight:800; color:var(--text-primary); }
.sub-pdf-school-tag  { font-size:10.5px; color:var(--text-muted); margin-top:2px; }
.sub-pdf-school-badge {
  margin-left:auto; display:flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:var(--radius-full);
  background:rgba(22,163,74,.1); color:#16A34A;
  font-size:10.5px; font-weight:700; flex-shrink:0;
  border:1px solid rgba(22,163,74,.2);
}

.sub-pdf-body { padding:18px 22px 16px; }
.sub-pdf-section-lbl {
  font-size:10px; font-weight:800; letter-spacing:.9px; text-transform:uppercase;
  color:var(--text-muted); margin-bottom:12px;
  display:flex; align-items:center; gap:8px;
}
.sub-pdf-section-lbl::after { content:''; flex:1; height:1px; background:var(--border-light); }

.sub-pdf-style-list { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
.sub-pdf-style-row {
  display:flex; align-items:center; gap:14px;
  padding:13px 16px; border-radius:var(--radius-md);
  border:2px solid var(--border-light); cursor:pointer;
  transition:var(--tr); background:var(--bg-card);
  position:relative; overflow:hidden;
}
.sub-pdf-style-row::before {
  content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
  background:transparent; transition:background .15s;
  border-radius:2px 0 0 2px;
}
.sub-pdf-style-row:hover { border-color:var(--border-med); box-shadow:var(--shadow-xs); }
.sub-pdf-style-row.active { border-color:rgba(220,38,38,.5); background:rgba(220,38,38,.03); }
.sub-pdf-style-row.active::before { background:#DC2626; }

.sub-pdf-thumb {
  width:48px; height:60px; border-radius:6px; flex-shrink:0;
  overflow:hidden; border:1px solid var(--border-light);
  display:flex; flex-direction:column; gap:0;
  box-shadow:0 2px 8px rgba(0,0,0,.1);
}
.sub-pdf-thumb--color { background:#fff; }
/* Colorless thumb — paper-white look, light borders only, no dark header band */
.sub-pdf-thumb--bw    { background:#fff; border:1px solid #E5E7EB; }
.pdf-thumb-hdr { height:14px; flex-shrink:0; }
.sub-pdf-thumb--color .pdf-thumb-hdr { background:linear-gradient(90deg,#1E3A8A,#2563EB); }
.sub-pdf-thumb--bw    .pdf-thumb-hdr { background:#FFFFFF; border-bottom:1px solid #1F2937; }
.pdf-thumb-body { padding:4px 5px; display:flex; flex-direction:column; gap:3px; flex:1; }
.pdf-thumb-row  { height:4px; border-radius:2px; }
.sub-pdf-thumb--color .pdf-thumb-row:nth-child(odd)  { background:#DBEAFE; }
.sub-pdf-thumb--color .pdf-thumb-row:nth-child(even) { background:#EFF6FF; }
/* Colorless rows: thin gray lines, no fills */
.sub-pdf-thumb--bw    .pdf-thumb-row:nth-child(odd)  { background:transparent; border-bottom:1px solid #9CA3AF; }
.sub-pdf-thumb--bw    .pdf-thumb-row:nth-child(even) { background:transparent; border-bottom:1px solid #D1D5DB; }
.pdf-thumb-bar { height:4px; border-radius:2px; margin-top:2px; }
.sub-pdf-thumb--color .pdf-thumb-bar { background:linear-gradient(90deg,#1E40AF,#3B82F6); width:70%; }
.sub-pdf-thumb--bw    .pdf-thumb-bar { background:transparent; border:1px solid #4B5563; width:70%; }
.pdf-thumb-tag { height:4px; border-radius:2px; width:40%; margin-top:2px; }
.sub-pdf-thumb--color .pdf-thumb-tag { background:rgba(22,163,74,.5); }
.sub-pdf-thumb--bw    .pdf-thumb-tag { background:transparent; border:1px solid #6B7280; }

.sub-pdf-style-info { flex:1; }
.sub-pdf-style-name { font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:3px; }
.sub-pdf-style-hint { font-size:11px; color:var(--text-muted); line-height:1.4; }

.sub-pdf-radio {
  width:18px; height:18px; border-radius:50%; flex-shrink:0;
  border:2px solid var(--border-med); display:flex; align-items:center; justify-content:center;
}
.sub-pdf-radio::after {
  content:''; width:8px; height:8px; border-radius:50%;
  background:#DC2626; transform:scale(0); transition:transform .15s;
}
.sub-pdf-style-row.active .sub-pdf-radio { border-color:#DC2626; }
.sub-pdf-style-row.active .sub-pdf-radio::after { transform:scale(1); }

.sub-pdf-scope-card {
  display:flex; align-items:center; gap:12px;
  padding:12px 14px; border-radius:var(--radius-md);
  background:var(--bg-muted); border:1.5px solid var(--border-light);
}
.sub-pdf-scope-icon {
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-size:15px;
  display:flex; align-items:center; justify-content:center;
}
.sub-pdf-scope-title { font-size:13px; font-weight:800; color:var(--text-primary); }
.sub-pdf-scope-desc  { font-size:11px; color:var(--text-muted); margin-top:2px; }

.sub-pdf-footer {
  display:flex; align-items:center; justify-content:flex-end; gap:10px;
  padding:14px 22px 18px; border-top:1.5px solid var(--border-light);
}
.sub-pdf-cancel-btn {
  display:flex; align-items:center; gap:6px;
  height:40px; padding:0 18px; border-radius:var(--radius-md);
  background:transparent; border:1.5px solid var(--border-med);
  color:var(--text-muted); font-family:var(--font-body);
  font-size:13px; font-weight:600; cursor:pointer;
}
.sub-pdf-cancel-btn:hover { background:var(--bg-muted); color:var(--text-primary); }
.sub-pdf-gen-btn {
  display:flex; align-items:center; gap:7px;
  height:40px; padding:0 20px; border-radius:var(--radius-md);
  background:linear-gradient(135deg,#DC2626,#B91C1C);
  border:none; color:#fff; font-family:var(--font-body);
  font-size:13px; font-weight:800; cursor:pointer;
  box-shadow:0 4px 14px rgba(220,38,38,.35);
}
.sub-pdf-gen-btn:hover { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 8px 22px rgba(220,38,38,.45); }

.snb-unit-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }

@media (max-width:600px) {
  .sub-pdf-modal { border-radius:16px; }
  .sub-pdf-style-row { padding:10px 12px; }
  .sub-pdf-thumb { width:42px; height:54px; }
}

/* ══════════════════════════════════════════════════
   ADMIN OVERVIEW — verbatim from HTML .sub-admin-*
══════════════════════════════════════════════════ */
.sub-admin-grid {
  display:grid; grid-template-columns:1fr 1fr;
  gap:16px;
}
.sub-admin-card {
  background:var(--bg-card); border:1px solid var(--border-light);
  border-radius:var(--radius-lg); overflow:hidden;
  box-shadow:var(--shadow-sm); transition:var(--tr);
}
.sub-admin-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
.sub-admin-card-hdr {
  padding:14px 18px; border-bottom:1px solid var(--border-light);
  background:linear-gradient(135deg,rgba(30,58,138,.04),transparent);
  display:flex; align-items:center; gap:10px;
}
.sub-admin-card-icon {
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-size:14px;
  display:flex; align-items:center; justify-content:center;
}
.sub-admin-card-title { font-size:14px; font-weight:800; color:var(--text-primary); margin-bottom:1px; }
.sub-admin-card-sub   { font-size:11px; color:var(--text-muted); }
.sub-admin-teacher-row {
  display:flex; align-items:center; gap:12px;
  padding:12px 18px; border-bottom:1px solid var(--border-light);
  transition:background .15s; cursor:pointer;
}
.sub-admin-teacher-row:last-child { border-bottom:none; }
.sub-admin-teacher-row:hover { background:rgba(30,58,138,.03); }
.sub-admin-teacher-avatar {
  width:36px; height:36px; border-radius:50%; flex-shrink:0;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; font-size:12px; font-weight:800;
  display:flex; align-items:center; justify-content:center;
}
.sub-admin-teacher-info { flex:1; min-width:0; }
.sub-admin-teacher-name { font-size:13px; font-weight:700; color:var(--text-primary); margin-bottom:2px; }
.sub-admin-teacher-sub  { font-size:11px; color:var(--text-muted); }
.sub-admin-teacher-prog { width:80px; flex-shrink:0; }
.sub-admin-teacher-pct  { font-size:12px; font-weight:800; text-align:right; margin-bottom:4px; }
.sub-admin-prog {
  height:5px; border-radius:3px;
  background:var(--bg-muted); overflow:hidden;
}
.sub-admin-prog-fill {
  height:100%; border-radius:3px;
  background:linear-gradient(90deg,#1E40AF,#3B82F6);
  transition:width .6s ease;
}
.sub-admin-scroll {
  max-height:280px; overflow-y:auto;
  scrollbar-width:thin; scrollbar-color:var(--border-med) transparent;
}
.sub-admin-scroll::-webkit-scrollbar { width:5px; }
.sub-admin-scroll::-webkit-scrollbar-thumb { background:var(--border-med); border-radius:99px; }
.sub-admin-scroll--horiz {
  overflow-x:auto; overflow-y:hidden; max-height:none;
}
.sub-admin-scroll--horiz::-webkit-scrollbar { height:5px; }
.sub-admin-scroll--horiz::-webkit-scrollbar-thumb { background:var(--border-med); border-radius:99px; }

.sub-pdf-btn--admin { height:28px; font-size:10.5px; padding:0 10px; }

/* Subject scroll cards (full-width admin row) */
.subj-scroll-card {
  flex-shrink:0; width:170px;
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg); padding:16px 16px 14px;
  box-shadow:var(--shadow-xs); transition:var(--tr);
  display:flex; flex-direction:column; gap:0;
}
.subj-scroll-card:hover { transform:translateY(-2px); box-shadow:var(--shadow-sm); border-color:var(--border-med); }
.subj-scroll-icon {
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,#EFF6FF,#DBEAFE);
  border:1.5px solid #BFDBFE;
  display:flex; align-items:center; justify-content:center;
  margin-bottom:12px;
}
.subj-scroll-name {
  font-size:14px; font-weight:800; color:var(--text-primary);
  margin-bottom:3px; line-height:1.2;
}
.subj-scroll-counts { font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:10px; }
.subj-scroll-pct { font-size:22px; font-weight:900; line-height:1; letter-spacing:-.02em; margin-bottom:8px; }
.subj-scroll-bar-track {
  height:5px; border-radius:99px;
  background:var(--bg-muted); overflow:hidden; margin-bottom:10px;
}
.subj-scroll-bar-fill { height:100%; border-radius:99px; transition:width .6s cubic-bezier(.4,0,.2,1); }
.subj-scroll-status {
  display:inline-flex; align-items:center; gap:5px;
  font-size:10.5px; font-weight:700; padding:3px 9px;
  border-radius:var(--radius-full); width:fit-content;
}

@media (max-width:900px) {
  .sub-admin-grid { grid-template-columns:1fr; }
}
@media (max-width:600px) {
  .sub-admin-teacher-row { padding:9px 13px; }
  .sub-admin-teacher-name { font-size:12.5px; }
  .sub-admin-teacher-prog { width:65px; }
}

/* ── Generic LP modal ── */
.lp-overlay {
  position:fixed; inset:0; background:rgba(10,22,40,.55); backdrop-filter:blur(6px);
  z-index:2000; display:none;
  align-items:center; justify-content:center; padding:20px;
}
.lp-overlay.open { display:flex; }
.lp-modal {
  background:var(--bg-card); border-radius:18px;
  width:100%; max-height:90vh; overflow-y:auto;
  border:1px solid var(--border-light);
  box-shadow:var(--shadow-xl);
  animation:modalIn .28s cubic-bezier(.34,1.26,.64,1) both;
}
.lp-modal-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:18px 22px; border-bottom:1px solid var(--border-light);
  position:sticky; top:0; background:var(--bg-card); z-index:5;
}
.lp-modal-title-row { display:flex; align-items:center; gap:12px; flex:1; min-width:0; }
.lp-modal-icon {
  width:38px; height:38px; border-radius:11px;
  background:linear-gradient(135deg,#DBEAFE,#BFDBFE);
  color:#1E40AF; font-size:15px;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.lp-modal-title { font-size:16px; font-weight:800; color:var(--text-primary); letter-spacing:-.01em; }
.lp-modal-sub { font-size:11.5px; color:var(--text-muted); margin-top:2px; }
.lp-modal-close {
  width:32px; height:32px; border-radius:9px; border:none;
  background:var(--bg-muted); color:var(--text-muted);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:13px; transition:var(--tr); flex-shrink:0;
}
.lp-modal-close:hover { background:rgba(220,38,38,.1); color:var(--error); }
.lp-modal-tabrow {
  display:flex; gap:6px; padding:10px 22px;
  border-bottom:1px solid var(--border-light); background:var(--bg-muted);
  overflow-x:auto;
}
.lp-modal-tab {
  padding:8px 14px; border-radius:8px; border:1.5px solid var(--border-light);
  background:var(--bg-card); color:var(--text-muted);
  font-family:var(--font-body); font-size:12px; font-weight:700;
  cursor:pointer; display:flex; align-items:center; gap:7px;
  transition:var(--tr); white-space:nowrap;
}
.lp-modal-tab.active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; border-color:transparent; }
.lp-modal-body { padding:18px 22px; }
.lp-modal-footer {
  display:flex; gap:10px; justify-content:flex-end;
  padding:14px 22px; border-top:1px solid var(--border-light);
  background:var(--bg-card);
}
.lp-btn {
  display:inline-flex; align-items:center; gap:7px;
  height:40px; padding:0 18px; border-radius:10px;
  border:none; cursor:pointer; font-family:var(--font-body);
  font-size:13px; font-weight:700; transition:var(--tr);
}
.lp-btn.primary { background:linear-gradient(135deg,#1E40AF,#1E3A8A); color:#fff; box-shadow:0 4px 14px rgba(30,58,138,.28); }
.lp-btn.primary:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(30,58,138,.38); }
.lp-btn.primary:disabled { opacity:.5; cursor:not-allowed; transform:none; box-shadow:none; }
.lp-btn.ghost {
  background:transparent; color:var(--text-secondary);
  border:1.5px solid var(--border-light);
}
.lp-btn.ghost:hover { background:var(--bg-muted); }
.lp-summary-strip {
  display:flex; align-items:flex-start; gap:10px;
  margin-top:14px; padding:11px 14px;
  background:rgba(30,58,138,.06); border:1px solid rgba(30,58,138,.18);
  border-radius:10px; font-size:12px; color:#334155; line-height:1.6;
}
.lp-summary-strip i { color:var(--brand-primary); margin-top:2px; flex-shrink:0; }
.lp-add-row {
  display:flex; align-items:center; gap:8px;
  width:100%; padding:11px 14px;
  border:1.5px dashed var(--border-med); border-radius:10px;
  background:transparent; cursor:pointer;
  color:var(--brand-primary); font-family:var(--font-body);
  font-size:12.5px; font-weight:800;
  transition:var(--tr); margin-top:10px;
}
.lp-add-row:hover { background:rgba(30,58,138,.04); border-style:solid; }
.lp-vac-row-edit {
  display:grid; grid-template-columns:14px 1fr 160px 160px auto;
  gap:8px; align-items:center; padding:8px 0;
  border-bottom:1px solid var(--border-light);
}
.lp-vac-row-edit:last-of-type { border-bottom:none; }
.lp-vac-color-pill { width:14px; height:14px; border-radius:50%; }

/* Unit Mgr modal */
.umgr-unit-row {
  display:flex; align-items:center; gap:8px;
  padding:8px 4px; border-bottom:1px solid var(--border-light);
}
.umgr-drag-handle {
  width:24px; color:var(--text-muted); cursor:grab;
  display:flex; align-items:center; justify-content:center; font-size:12px;
}
.umgr-sno-badge {
  min-width:36px; height:30px; padding:0 10px; border-radius:8px;
  background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  color:#fff; font-size:12px; font-weight:800;
  display:inline-flex; align-items:center; justify-content:center;
  border:none; cursor:pointer; transition:var(--tr);
  box-shadow:0 2px 8px rgba(30,58,138,.3);
}
.umgr-sno-badge:hover { transform:scale(1.05); box-shadow:0 4px 12px rgba(30,58,138,.4); }
.umgr-no-input {
  width:60px; height:34px; padding:0 10px;
  border:1.5px solid var(--border-light); border-radius:8px;
  background:var(--input-bg); color:var(--text-primary);
  font-family:var(--font-body); font-size:13px; font-weight:700;
  text-align:center; outline:none;
}
.umgr-name-input {
  flex:1; height:34px; padding:0 12px;
  border:1.5px solid var(--border-light); border-radius:8px;
  background:var(--input-bg); color:var(--text-primary);
  font-family:var(--font-body); font-size:13px; outline:none;
}
.umgr-name-input:focus, .umgr-no-input:focus {
  border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.1);
}
.umgr-lesson-count {
  background:rgba(30,58,138,.08); color:var(--brand-primary);
  padding:5px 9px; border-radius:99px;
  font-size:11px; font-weight:800;
  display:inline-flex; align-items:center; gap:4px; white-space:nowrap;
}
.umgr-del-btn {
  width:32px; height:32px; border-radius:8px; border:1.5px solid rgba(220,38,38,.25);
  background:rgba(220,38,38,.06); color:#DC2626;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:11px; transition:var(--tr);
}
.umgr-del-btn:hover { background:#DC2626; color:#fff; transform:scale(1.08); }

/* ══════════════════════════════════════════════════════
   UPLOAD LESSON PLAN MODAL — verbatim from HTML
══════════════════════════════════════════════════════ */

/* Overlay */
.clpm-overlay {
  position: fixed; inset: 0;
  background: rgba(4,10,28,.72); backdrop-filter: blur(12px);
  z-index: 1300; display: flex; align-items: center; justify-content: center;
  padding: 12px; opacity: 0; pointer-events: none;
  transition: opacity .3s ease;
}
.clpm-overlay.open { opacity: 1; pointer-events: all; }

/* Modal shell */
.clpm-modal {
  background: #fff; border-radius: 24px;
  border: 1px solid rgba(30,58,138,.12);
  box-shadow: 0 40px 100px rgba(4,10,28,.28), 0 8px 32px rgba(4,10,28,.12);
  width: 100%; max-width: 1280px;
  height: min(94vh, 880px);
  display: flex; flex-direction: column;
  transform: translateY(24px) scale(.96);
  transition: transform .35s cubic-bezier(.34,1.26,.64,1);
  overflow: hidden;
}
.clpm-overlay.open .clpm-modal { transform: none; }

/* HEADER */
.clpm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; height: 70px; flex-shrink: 0;
  background: linear-gradient(135deg,#0F2460 0%,#1E3A8A 45%,#1E40AF 100%);
  position: relative; overflow: hidden;
}
.clpm-header::before {
  content:''; position:absolute; top:-40px; right:-40px;
  width:160px; height:160px; border-radius:50%;
  background:rgba(255,255,255,.05); pointer-events:none;
}
.clpm-header::after {
  content:''; position:absolute; bottom:-50px; left:200px;
  width:120px; height:120px; border-radius:50%;
  background:rgba(255,255,255,.04); pointer-events:none;
}
.clpm-title { font-size: 16px; font-weight: 800; color: #fff; letter-spacing: -.01em; }

/* Header breadcrumb chips — verbatim style from HTML's clpmHeaderMeta */
.clpm-header-meta {
  display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;
  position:relative; z-index:1;
}
.clpm-header-chip {
  display:inline-flex; align-items:center; gap:5px;
  background:rgba(255,255,255,.18); border:1px solid rgba(255,255,255,.28);
  border-radius:20px; padding:3px 11px;
  font-size:11.5px; font-weight:600; color:#fff; letter-spacing:.01em;
}
.clpm-header-chip--accent {
  background:rgba(255,255,255,.3); border-color:rgba(255,255,255,.4);
  font-weight:700;
}
.clpm-close {
  width: 34px; height: 34px; border-radius: 10px; border: none;
  background: rgba(255,255,255,.12); color: rgba(255,255,255,.85);
  cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center;
  transition: all .18s ease; flex-shrink: 0; z-index:1;
}
.clpm-close:hover { background: rgba(220,38,38,.75); color:#fff; transform:scale(1.08); }

/* BODY */
.clpm-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }

/* LEFT PANEL */
.clpm-left {
  width: 290px; flex-shrink: 0;
  border-right: 1px solid #EEF2FB;
  overflow-y: auto; overflow-x: hidden;
  background: #F7F9FF;
  scrollbar-width: thin; scrollbar-color: #C7D7F5 transparent;
}
.clpm-left::-webkit-scrollbar { width: 4px; }
.clpm-left::-webkit-scrollbar-thumb { background: #C7D7F5; border-radius: 2px; }

/* CLML — Compact Modal Left Panel */
.clml-unit { border-bottom:1px solid #EEF2FB; }
.clml-unit:last-child { border-bottom:none; }
.clml-unit-hdr {
  display:flex; align-items:center; justify-content:space-between;
  padding:9px 12px 7px;
  background:linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.02));
  border-bottom:1px solid #EEF2FB; gap:8px;
}
.clml-unit-hdr-left { display:flex; align-items:center; gap:6px; min-width:0; flex:1; }
.clml-unit-badge {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
  font-size:10px; font-weight:800; padding:2px 8px; border-radius:20px;
  white-space:nowrap; flex-shrink:0; box-shadow:0 2px 6px rgba(30,58,138,.25);
}
.clml-unit-name {
  font-size:12px; font-weight:700; color:#1E40AF;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.clml-unit-hdr-right { display:flex; align-items:center; gap:5px; flex-shrink:0; }
.clml-lesson-count {
  font-size:10.5px; font-weight:700; color:var(--text-muted);
  background:var(--bg-muted); padding:2px 7px; border-radius:5px;
  display:flex; align-items:center; gap:3px;
}
.clml-field-row {
  display:flex; align-items:center; gap:5px; margin-bottom:5px;
}
.clml-field-lbl {
  font-size:9px; font-weight:900; color:#94A3B8;
  text-transform:uppercase; letter-spacing:.6px;
  flex-shrink:0; width:34px;
}
.clml-field-input {
  flex:0 0 60px; height:30px;
  border:1.5px solid #E2E8F0; border-radius:7px;
  padding:0 8px; font-family:var(--font-body); font-size:12.5px;
  font-weight:700; color:#0F172A; background:#F8FAFF; outline:none;
  transition:all .15s ease;
}
.clml-field-input--grow { flex:1; }
.clml-field-input:not(:disabled):focus { border-color:#1E40AF; background:#fff; }
.clml-field-input:disabled { background:#F1F5F9; color:#94A3B8; border-color:transparent; }

.clml-edit-btn {
  width:26px; height:26px; border-radius:7px;
  border:1.5px solid #E2E8F0; background:#F8FAFF; color:#64748B;
  cursor:pointer; font-size:9.5px;
  display:flex; align-items:center; justify-content:center;
  transition:all .15s ease; flex-shrink:0;
}
.clml-edit-btn:hover { border-color:#1E40AF; color:#1E40AF; background:#EFF6FF; }
.clml-save-btn {
  width:26px; height:26px; border-radius:7px; border:none;
  background:linear-gradient(135deg,#16A34A,#15803D); color:#fff;
  cursor:pointer; font-size:10px;
  display:flex; align-items:center; justify-content:center;
  transition:all .15s ease; flex-shrink:0;
}
.clml-save-btn:hover { filter:brightness(1.1); }
.clml-toggle {
  width:24px; height:24px; border-radius:6px;
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  color:var(--text-muted); cursor:pointer; font-size:9px;
  display:flex; align-items:center; justify-content:center;
  transition:all .18s ease;
}
.clml-toggle:hover { border-color:#1E40AF; color:#1E40AF; }

.clml-lesson {
  background:#fff; border-radius:9px;
  border:1.5px solid #E8EFF8; border-left:3px solid #2563EB;
  padding:8px 10px; margin-bottom:6px;
  transition:border-color .15s ease;
}
.clml-lesson:hover { border-color:#93C5FD; }

.clml-add-lesson {
  width:100%; height:30px; border-radius:8px;
  border:1.5px dashed #93C5FD; background:transparent; color:#1E40AF;
  font-family:var(--font-body); font-size:11.5px; font-weight:700;
  cursor:pointer; transition:all .15s ease; margin-top:4px;
  display:flex; align-items:center; justify-content:center; gap:5px;
}
.clml-add-lesson:hover { background:#EFF6FF; border-style:solid; }
.clml-add-unit {
  margin:10px 10px 12px; width:calc(100% - 20px); height:34px; border-radius:9px;
  border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-family:var(--font-body); font-size:12.5px; font-weight:700;
  cursor:pointer; transition:all .2s ease;
  display:flex; align-items:center; justify-content:center; gap:6px;
  box-shadow:0 3px 12px rgba(30,58,138,.28);
}
.clml-add-unit:hover { transform:translateY(-1px); box-shadow:0 5px 16px rgba(30,58,138,.38); }
.clml-lesson-hdr {
  display:flex; align-items:center; justify-content:space-between;
  margin-bottom:6px;
}
.clml-lesson-tags { display:flex; align-items:center; gap:4px; }
.clml-ltag {
  font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px;
}
.clml-ltag--seq { background:var(--bg-muted); color:var(--text-muted); border:1px solid var(--border-light); }
.clml-ltag--num { background:rgba(30,58,138,.08); color:#1E40AF; }
.clml-lesson-actions { display:flex; gap:5px; }
.clml-action-btn {
  flex:1; height:27px; border-radius:7px;
  font-family:var(--font-body); font-size:11px; font-weight:700;
  cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px;
  transition:all .15s ease;
}
.clml-action-save {
  border:1.5px solid #E2E8F0; background:#F8FAFF; color:#64748B;
}
.clml-action-save:hover { border-color:#1E40AF; background:rgba(30,58,138,.06); color:#1E40AF; }
.clml-action-fetch {
  border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff;
}
.clml-action-fetch:hover { filter:brightness(1.1); }

/* RIGHT PANEL */
.clpm-right {
  flex:1; min-width:0; overflow-y:auto;
  padding:0; background:#F4F7FF;
  scrollbar-width:thin; scrollbar-color:#C7D7F5 transparent;
  display:flex; flex-direction:column;
}
.clpm-right::-webkit-scrollbar { width:5px; }
.clpm-right::-webkit-scrollbar-thumb { background:#C7D7F5; border-radius:3px; }

/* Right panel top info bar */
.clpm-right-topbar {
  padding: 14px 18px;
  border-bottom: 1px solid #EEF2FB;
  background: #fff; flex-shrink: 0;
}
.clpm-ctx-row,
.clpm-unit-row,
.clpm-lang-row { display: flex; align-items: center; gap: 8px; }
.clpm-lang-row { flex-wrap: wrap; margin-top: 8px; }
.clpm-unit-row { margin-top: 8px; }
.clpm-ctx-pill {
  display: flex; align-items: center; gap: 10px;
  flex: 1; min-width: 0;
  background: #F0F6FF; border: 1.5px solid #BFDBFE;
  border-radius: 12px; padding: 8px 12px;
  transition: border-color .15s ease;
}
.clpm-ctx-pill--blue { border-color: #BFDBFE; }
.clpm-ctx-icon {
  width: 28px; height: 28px; border-radius: 8px;
  background: linear-gradient(135deg,#1E3A8A,#1E40AF);
  color: #fff; font-size: 11px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.clpm-ctx-icon--sm { width: 24px; height: 24px; font-size: 9px; border-radius: 6px; }
.clpm-ctx-body { min-width: 0; }
.clpm-ctx-label {
  font-size: 9.5px; font-weight: 800; color: #94A3B8;
  text-transform: uppercase; letter-spacing: .6px; line-height: 1;
  margin-bottom: 2px;
}
.clpm-ctx-val {
  font-size: 13px; font-weight: 800; color: #1E3A8A;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.clpm-unit-field-chip {
  display: flex; align-items: center; gap: 8px;
  background: #F8FAFF; border: 1.5px solid #E8EFF8;
  border-radius: 12px; padding: 8px 12px;
  transition: border-color .15s ease; min-width: 100px;
}
.clpm-unit-field-chip:focus-within {
  border-color: #1E40AF; background: #fff;
  box-shadow: 0 0 0 3px rgba(30,64,175,.08);
}
.clpm-unit-field-chip--grow { flex: 1; min-width: 0; }
.clpm-ctx-input {
  border: none; outline: none; background: transparent;
  font-family: var(--font-body); font-size: 13px;
  font-weight: 800; color: #1E3A8A;
  padding: 0; min-width: 0;
}
.clpm-ctx-input::placeholder { color: #CBD5E1; font-weight: 500; }

.clpm-lang-label {
  font-size: 10px; font-weight: 800; color: #94A3B8;
  text-transform: uppercase; letter-spacing: .6px; white-space: nowrap;
}
.clpm-lang-pills {
  display:flex; align-items:center;
  background:#F0F4FF; border:1.5px solid #DBEAFE; border-radius:10px;
  padding:3px; gap:2px;
}
.clpm-lang-pill {
  display:flex; align-items:center; gap:5px;
  height:28px; padding:0 12px; border-radius:7px; border:none;
  font-family:var(--font-body); font-size:12px; font-weight:700;
  cursor:pointer; transition:all .18s ease;
  background:transparent; color:#64748B; white-space:nowrap;
}
.clpm-lang-pill.active {
  background:#fff; color:#1E3A8A;
  box-shadow:0 1px 4px rgba(30,58,138,.15);
}
.clpm-lang-pill:hover:not(.active) { background:rgba(255,255,255,.6); color:#1E3A8A; }
.clpm-lang-flag { font-size:13px; line-height:1; }

/* Right form area */
.clpm-form-area { padding:20px 24px 0; flex-shrink:0; }
.clpm-step-label {
  font-size:10px; font-weight:900; letter-spacing:1.2px; text-transform:uppercase;
  color:#94A3B8; margin-bottom:10px; display:flex; align-items:center; gap:8px;
}
.clpm-step-label::after { content:''; flex:1; height:1px; background:#EEF2FB; }
.clpm-inputs-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
.clpm-field-group { display:flex; flex-direction:column; gap:5px; }
.clpm-field-label {
  font-size:11px; font-weight:800; color:#475569; display:flex; align-items:center; gap:4px;
  letter-spacing:.2px;
}
.clpm-field-label .req { color:#EF4444; font-size:14px; line-height:1; }
.clpm-input {
  height:42px; border:1.5px solid #E2E8F0; border-radius:10px;
  padding:0 14px; font-family:var(--font-body); font-size:13.5px;
  color:#0F172A; background:#fff; outline:none; width:100%;
  transition:all .18s ease; box-shadow:0 1px 3px rgba(0,0,0,.04);
}
.clpm-input:hover { border-color:#93C5FD; }
.clpm-input:focus { border-color:#1E40AF; box-shadow:0 0 0 3px rgba(30,64,175,.1); }
.clpm-eg { font-size:11px; color:#94A3B8; white-space:nowrap; font-style:italic; }
.clpm-input-with-hint { display:flex; gap:8px; align-items:center; }

/* Rich Text Sections */
.clpm-sections-area { padding:0 24px 20px; flex:1; }
.clpm-rte-section {
  margin-bottom:14px; background:#fff;
  border-radius:14px; border:1.5px solid #E8EEF8;
  overflow:hidden; transition:all .2s ease;
  box-shadow:0 2px 8px rgba(30,58,138,.04);
}
.clpm-rte-section:hover { border-color:#93C5FD; box-shadow:0 4px 16px rgba(30,58,138,.08); }
.clpm-rte-section:focus-within { border-color:#1E40AF; box-shadow:0 0 0 3px rgba(30,64,175,.08),0 4px 16px rgba(30,58,138,.08); }
.clpm-rte-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:0 16px; height:46px;
  background:linear-gradient(135deg,#EFF6FF,#F5F9FF);
  border-bottom:1px solid #E8EEF8; gap:8px;
}
.clpm-rte-title-wrap { flex:1; min-width:0; display:flex; align-items:center; gap:8px; }
.clpm-rte-section-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; background:#2563EB; }
.clpm-rte-section-dot--purple { background:#7C3AED; }
.clpm-rte-section-dot--blue   { background:#1E40AF; }
.clpm-rte-section-dot--orange { background:#EA580C; }
.clpm-rte-section-dot--green  { background:#16A34A; }
.clpm-rte-title {
  font-size:13.5px; font-weight:800; color:#0F172A;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.clpm-rte-hint-text {
  font-size:11px; color:#94A3B8; font-style:italic;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}

/* Time input in section header */
.clpm-time-input-wrap {
  display:flex; align-items:center; gap:4px;
  background:#fff; border:1.5px solid #E2E8F0; border-radius:8px;
  padding:0 10px; height:32px; flex-shrink:0;
  transition:border-color .18s ease;
}
.clpm-time-input-wrap:focus-within { border-color:#1E40AF; }
.clpm-time-icon { font-size:11px; color:#94A3B8; }
.clpm-time-input {
  width:36px; border:none; outline:none; background:transparent;
  font-family:var(--font-body); font-size:13px; font-weight:800; color:#1E3A8A;
  text-align:center;
}
.clpm-time-suffix { font-size:10px; font-weight:700; color:#94A3B8; }

/* Rich-text toolbar */
.clpm-rte-toolbar {
  display:flex; align-items:center; gap:1px;
  padding:4px 10px; border-bottom:1px solid #F0F4FC;
  background:#FAFCFF; flex-wrap:wrap;
}
.clpm-tb-btn {
  width:28px; height:28px; border-radius:6px; border:none;
  background:transparent; color:#475569; cursor:pointer;
  font-size:12.5px; display:flex; align-items:center; justify-content:center;
  transition:all .14s ease; font-family:var(--font-body);
}
.clpm-tb-btn:hover { background:#EFF6FF; color:#1E40AF; }
.clpm-tb-btn:active { background:#DBEAFE; transform:scale(.91); }
.clpm-tb-select {
  height:26px; border:1.5px solid #E2E8F0; border-radius:5px;
  padding:0 6px; font-size:11.5px; background:#fff; color:#475569; outline:none; cursor:pointer;
}
.clpm-tb-select:focus { border-color:#1E40AF; }
.clpm-tb-divider { width:1px; height:18px; background:#E8EFF8; margin:0 3px; flex-shrink:0; }

/* Editor */
.clpm-editor {
  min-height:120px; max-height:340px;
  padding:15px 18px; overflow-y:auto;
  font-family:var(--font-body); font-size:13.5px; color:#0F172A;
  outline:none; line-height:1.78; background:#fff;
}
.clpm-editor:empty::before { content:attr(data-placeholder); color:#CBD5E1; pointer-events:none; font-style:italic; }
.clpm-editor p, .clpm-editor div { margin:0 0 6px; }
.clpm-editor ol, .clpm-editor ul { padding-left:22px; margin:8px 0; }
.clpm-editor li { margin-bottom:4px; }
.clpm-editor blockquote { border-left:3px solid #1E40AF; padding-left:14px; color:#64748B; margin:10px 0; font-style:italic; }
.clpm-editor table { border-collapse:collapse; width:100%; margin:10px 0; font-size:13px; }
.clpm-editor td, .clpm-editor th { border:1px solid #E2E8F0; padding:7px 12px; }
.clpm-editor th { background:#EFF6FF; font-weight:700; color:#1E3A8A; }
.clpm-editor img { max-width:100%; border-radius:8px; margin:8px 0; }
.clpm-editor strong { color:#0F172A; }

/* FOOTER */
.clpm-footer {
  display:flex; align-items:center; justify-content:space-between;
  padding:12px 24px 16px;
  border-top:1px solid #EEF2FB; flex-shrink:0; background:#fff;
}
.clpm-footer-hint { font-size:12px; color:#94A3B8; display:flex; align-items:center; gap:6px; }
.clpm-footer-btns { display:flex; gap:10px; }
.clpm-btn {
  height:42px; padding:0 24px; border-radius:11px;
  font-family:var(--font-body); font-size:13.5px; font-weight:700;
  cursor:pointer; transition:all .2s ease; border:none;
  display:flex; align-items:center; gap:8px;
}
.clpm-btn--cancel {
  background:#F1F5F9; border:1.5px solid #E2E8F0; color:#64748B; padding:0 20px;
}
.clpm-btn--cancel:hover { background:#E2E8F0; color:#334155; }
.clpm-btn--save {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color:#fff; box-shadow:0 4px 14px rgba(30,58,138,.35);
}
.clpm-btn--save:hover { transform:translateY(-1px); box-shadow:0 7px 20px rgba(30,58,138,.45); }
.clpm-btn--save:active { transform:scale(.97); }

/* RTL mode */
.clpm-modal.rtl-mode {
  font-family: 'Noto Nastaliq Urdu','Jameel Noori Nastaleeq','Alvi Nastaleeq',serif;
}
.clpm-modal.rtl-mode .clpm-rte-title { font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif; font-size:14px; }
.clpm-modal.rtl-mode .clpm-step-label { font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif; font-size:13px; letter-spacing:0; }
.clpm-modal.rtl-mode .clpm-field-label { font-family:'Noto Nastaliq Urdu','Jameel Noori Nastaleeq',serif; font-size:12px; }

@media (max-width:900px) {
  .clpm-left { width:100%; height:190px; border-right:none; border-bottom:1px solid #EEF2FB; flex-shrink:0; }
  .clpm-modal { height:95vh; border-radius:20px 20px 0 0; }
  .clpm-overlay { align-items:flex-end; padding:0; }
  .clpm-body { flex-direction:column; }
}

.lp-item-list { display:flex; flex-direction:column; gap:6px; margin-top:8px; }
.lp-item-row {
  display:flex; align-items:center; gap:10px;
  padding:8px 12px; border:1px solid var(--border-light);
  border-radius:9px; background:var(--bg-muted);
}
.lp-item-num {
  width:24px; height:24px; border-radius:7px;
  background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  color:#fff; font-size:11px; font-weight:800;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.lp-item-text { flex:1; font-size:13px; color:var(--text-primary); }

/* Dark mode */
[data-theme="dark"] .lp-l2-tabs { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .lp-l2-tab  { color:var(--text-muted); border-color:var(--border-light); }
[data-theme="dark"] .lp-l2-tab:hover:not(.active) { background:var(--bg-muted); color:#93C5FD; }
[data-theme="dark"] .tb-cls-icon { background:rgba(59,130,246,.15); color:#60A5FA; }
[data-theme="dark"] .tb-detail { background:linear-gradient(135deg,rgba(14,22,40,.6),rgba(19,31,56,.4)); border-color:var(--border-light); }
[data-theme="dark"] .tb-detail-pill { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .lp-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .lp-modal-header, [data-theme="dark"] .lp-modal-footer { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .lp-modal-title { color:#E2E8F8; }
[data-theme="dark"] .lp-modal-tabrow { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .lp-modal-tab { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .lp-modal-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .clp2-table-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clpr-unit-row:hover { background:rgba(59,130,246,.06); }
[data-theme="dark"] .clpr-unit-name { color:#E2E8F8; }
[data-theme="dark"] .clpr-lessons-panel { background:rgba(59,130,246,.04); border-color:var(--border-light); }
[data-theme="dark"] .clpr-lesson-row { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clpr-lesson-topic { color:#E2E8F8; }
[data-theme="dark"] .clpr-stat { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .clpm-editor { background:var(--input-bg); color:#E2E8F8; }
[data-theme="dark"] .clpm-section { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clpm-section-title { color:#E2E8F8; }
[data-theme="dark"] .clpm-toolbar { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .clpm-toolbar button { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .umgr-no-input, [data-theme="dark"] .umgr-name-input { background:var(--input-bg); border-color:var(--border-light); color:#E2E8F8; }
[data-theme="dark"] .lp-item-row { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .lp-item-text { color:#E2E8F8; }
[data-theme="dark"] .clp2-empty-state { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clp2-empty-title { color:#E2E8F8; }
[data-theme="dark"] .tb-breakup-head { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .tb-row-wrap { border-color:var(--border-light); }
[data-theme="dark"] .tb-cls-name { color:#E2E8F8; }

/* Responsive */
@media (max-width:1100px) {
  .ss-cards-grid { grid-template-columns:1fr; }
}
@media (max-width:900px) {
  .lp-l2-tabs { grid-template-columns:repeat(2,1fr); }
  .lp-l2-tab { border-bottom:1.5px solid var(--border-light); }
  .lp-l2-tab:nth-child(2) { border-right:none; }
  .clp2-filter-row { grid-template-columns:1fr; }
  .clpr-unit-row { grid-template-columns:50px 1fr; }
  .clpr-unit-row > .clpr-unit-no, .clpr-unit-row > .clpr-unit-stats { grid-column:1 / -1; }
  .clpr-unit-actions { grid-column:1 / -1; flex-wrap:wrap; }
  .tb-row { flex-wrap:wrap; gap:6px; }
  .tb-bp-td { padding:6px 4px; }
}
@media (max-width:600px) {
  .lp-l2-tab { font-size:11.5px; padding:11px 8px; }
  .lp-l2-tab span { display:none; }
  .lp-vac-row-edit { grid-template-columns:14px 1fr; }
  .lp-vac-row-edit > .form-input { grid-column:1 / -1; }
  .lp-vac-row-edit > .lp-icon-del { grid-column:1 / -1; justify-self:flex-end; }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE PATCH — Lesson Plans module (≤ 768px)
   Pure CSS, additive. No JSX/state/logic touched. Preserves all
   existing colours, gradients, icons, typography, shadows.
   Fixes: Create-Lesson-Plan padding/dropdowns/fetch · Lesson Plans
   meta+actions wrap · Notebook Plans overlap (#1 / "5 Words" /
   "Manual") · L2 tab strip horizontal scroll.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 768px) {
  /* ── L2 Tabs (Session / Term Breakups / Create / Submissions)
       → horizontal scroll, never wrap, never hide labels ── */
  .lp-l2-tabs {
    display: flex !important;
    grid-template-columns: none !important;
    flex-wrap: nowrap !important;
    overflow-x: auto !important;
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    border-radius: 12px;
  }
  .lp-l2-tabs::-webkit-scrollbar { display: none; }
  .lp-l2-tab {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
    padding: 11px 14px !important;
    font-size: 12px !important;
    border-bottom: none !important;
  }
  .lp-l2-tab span { display: inline !important; }

  /* ── SCREEN 1 — Create Lesson Plan card ── */
  .clp2-hero-card {
    padding: 18px 16px !important;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .clp2-hero-inner { gap: 14px !important; }
  .clp2-hero-title { font-size: 16px !important; }
  .clp2-hero-sub { padding-left: 0 !important; }
  .clp2-filter-row {
    grid-template-columns: 1fr !important;
    gap: 12px !important;
    align-items: stretch !important;
  }
  .clp2-field { width: 100% !important; min-width: 0 !important; }
  .clp2-select-wrap { width: 100% !important; }
  .clp2-select {
    width: 100% !important;
    box-sizing: border-box !important;
    height: 44px !important;
    max-width: 100% !important;
  }
  .clp2-fetch-btn {
    width: 100% !important;
    height: 44px !important;
    justify-content: center !important;
    white-space: nowrap !important;
    box-sizing: border-box !important;
  }

  /* ── SCREEN 2 — Lesson Plans tab (UnitRow .clpr-unit-row) ──
     Convert the 5-col grid into a 2-row flex-wrap card.
     Row 1: [SN] [Unit#] Unit name              [Expand]
     Row 2: metadata pills (Lessons · Manual · AI)
     Row 3: actions (PDF · Word · Delete) — equal-height, no overflow */
  .clpr-unit-row {
    display: flex !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    grid-template-columns: none !important;
    column-gap: 8px !important;
    row-gap: 10px !important;
    padding: 12px 14px !important;
  }
  .clpr-unit-sno { order: 1; flex: 0 0 auto; }
  .clpr-unit-no  { order: 2; flex: 0 0 auto; }
  .clpr-unit-row > .clpr-unit-name {
    order: 3; flex: 1 1 auto !important;
    min-width: 0 !important;
    word-break: break-word !important;
    overflow-wrap: break-word !important;
  }
  .clpr-unit-row > .clpr-unit-stats {
    order: 4;
    flex: 1 1 100% !important;
    grid-column: auto !important;
    gap: 6px !important;
    flex-wrap: wrap !important;
  }
  .clpr-unit-row > .clpr-unit-stats .clpr-stat-sep { display: none; }
  .clpr-unit-row > .clpr-unit-actions {
    order: 5;
    flex: 1 1 100% !important;
    grid-column: auto !important;
    display: flex !important;
    gap: 8px !important;
    flex-wrap: nowrap !important;
    justify-content: flex-end !important;
  }
  .clpr-unit-row > .clpr-unit-actions .export-btn {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    height: 36px;
    min-height: 36px;
    justify-content: center !important;
    white-space: nowrap !important;
  }
  .clpr-unit-row > .clpr-unit-actions .lp-icon-del,
  .clpr-unit-row > .clpr-unit-actions .expand-btn {
    flex: 0 0 36px !important;
    min-height: 36px;
    width: 36px !important;
    height: 36px !important;
  }

  /* ── SCREEN 3 — Notebook Plans (inside expanded NbUnitRow) ──
     Each lesson card .clpr-lesson-top has 4 children:
       1 .clpr-lesson-meta (#N + type tag + name)
       2 inline-styled rowsCount badge ("5 items")
       3 .clp-src-badge (Manual / Mentor AI)
       4 .clpr-lesson-actions
     Desktop forces flex-wrap:nowrap → they overlap on phones.
     Allow wrap, give meta its own row, badges + actions share row 2. */
  .clpr-lesson-card { overflow: visible; }
  .clpr-lesson-top {
    flex-wrap: wrap !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 10px 12px !important;
  }
  .clpr-lesson-meta {
    order: 1 !important;
    flex: 1 1 100% !important;
    min-width: 0 !important;
    gap: 6px !important;
  }
  .clpr-lesson-meta .clpr-lesson-name {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  .clpr-lesson-top > span:not(.clpr-lesson-num):not(.clpr-lesson-num-tag) {
    order: 2 !important;
    flex: 0 0 auto !important;
  }
  .clpr-lesson-top > .clp-src-badge {
    order: 3 !important;
    flex: 0 0 auto !important;
  }
  .clpr-lesson-top > .clpr-lesson-actions {
    order: 4 !important;
    flex: 0 0 auto !important;
    margin-left: auto !important;
    gap: 6px !important;
    flex-shrink: 0 !important;
  }

  /* Inner Lesson/Notebook sub-tabs (.clp2-subtabs) — horizontal scroll
     so two tabs never wrap */
  .clp2-subtabs {
    flex-wrap: nowrap !important;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .clp2-subtabs::-webkit-scrollbar { display: none; }
  .clp2-subtab {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
  }
}

/* ── Tighter padding / touch-target tweaks at ≤ 600px ── */
@media (max-width: 600px) {
  .clp2-hero-card { padding: 16px 14px !important; }
  .clp2-hero-title { font-size: 15.5px !important; }
  .clp2-hero-sub { font-size: 11px !important; }

  .clpr-unit-row > .clpr-unit-actions .export-btn {
    padding: 0 10px;
    font-size: 11.5px;
  }
  .clpr-unit-row > .clpr-unit-actions .lp-icon-del,
  .clpr-unit-row > .clpr-unit-actions .expand-btn {
    flex: 0 0 36px !important;
    width: 36px !important;
    height: 36px !important;
  }

  /* Notebook lesson actions stay compact even at tiny widths */
  .clpr-lesson-top > .clpr-lesson-actions .clpr-action-btn,
  .clpr-lesson-top > .clpr-lesson-actions .clpr-icon-btn {
    min-height: 32px;
  }
}

/* ── Global Lesson Plans mobile guardrails ── */
@media (max-width: 768px) {
  /* Prevent any nested wrapper from horizontally overflowing the viewport */
  .clp2-hero-card,
  .clp2-table-card,
  .clpr-unit,
  .clpr-unit-card,
  .clpr-lesson-card {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  .clp2-hero-card,
  .clp2-table-card { overflow-x: hidden; }
}

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE — LessonPlans coverage. The brand-coloured hero cards keep
   their vivid look; surfaces, inputs, tabs, modals get dark variants.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── L2 tabs (Session / Term Breakups / Create / View) ─── */
[data-theme="dark"] .lp-l2-tabs { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .lp-l2-tab { color:var(--text-muted); }
[data-theme="dark"] .lp-l2-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }

/* ─── Session Settings (3 hero cards) ─── */
[data-theme="dark"] .ss-grid { background:transparent; }
[data-theme="dark"] .ss-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ss-card-hdr-title { color:var(--text-primary); }
[data-theme="dark"] .ss-card-hdr-sub { color:var(--text-muted); }
[data-theme="dark"] .ss-card-edit-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .ss-card-edit-btn:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .ss-data-row { border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .ss-data-icon { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .ss-data-label { color:var(--text-secondary); }
[data-theme="dark"] .ss-data-val { color:var(--text-primary); }
[data-theme="dark"] .ss-highlight-banner { background:rgba(34,197,94,.1); border-color:rgba(34,197,94,.3); color:#86EFAC; }
[data-theme="dark"] .ss-card-report-bar { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .ss-card-report-label { color:var(--text-secondary); }
[data-theme="dark"] .ss-card-rpt-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .ss-card-rpt-btn--color:hover { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .ss-card-rpt-btn--bw:hover { background:var(--bg-muted); color:var(--text-primary); border-color:var(--border-med); }
[data-theme="dark"] .ss-vac-row { border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .ss-vac-name { color:var(--text-primary); }
[data-theme="dark"] .ss-vac-range { color:var(--text-muted); }
[data-theme="dark"] .ss-vac-days { color:var(--text-primary); }
[data-theme="dark"] .ss-summ-pill { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .ss-summ-pill-val { color:var(--text-primary); }
[data-theme="dark"] .ss-summ-pill-lbl { color:var(--text-muted); }
[data-theme="dark"] .ss-summ-hero-item { color:var(--text-primary); }
[data-theme="dark"] .ss-summ-big { color:var(--text-primary); }
[data-theme="dark"] .ss-summ-lbl { color:var(--text-muted); }
[data-theme="dark"] .ss-summ-divider { background:var(--border-light); }

/* Per-week lesson plans card */
[data-theme="dark"] .lp-class-chips { border-top-color:var(--border-light); }
[data-theme="dark"] .lp-chips-label { color:var(--text-muted); }
[data-theme="dark"] .lp-chip { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .lp-chip:hover { background:var(--bg-card); border-color:var(--border-med); color:var(--text-primary); }
[data-theme="dark"] .lp-chip.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }
[data-theme="dark"] .lp-pw-grid { background:transparent; }
[data-theme="dark"] .lp-pw-cell { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .lp-pw-cell-name { color:var(--text-primary); }
[data-theme="dark"] .lp-pw-cell-num { color:var(--text-primary); }
[data-theme="dark"] .lp-pw-cell-lbl { color:var(--text-muted); }
[data-theme="dark"] .lp-pw-empty { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .lp-pw-empty-icon { color:var(--text-muted); }
[data-theme="dark"] .lp-pw-empty-text { color:var(--text-secondary); }
[data-theme="dark"] .lp-pw-empty-arrow { color:#3B82F6; }
[data-theme="dark"] .lp-report-bar { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .lp-report-bar-label { color:var(--text-secondary); }
[data-theme="dark"] .lp-rpt-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .lp-rpt-btn:hover { background:var(--bg-muted); color:var(--text-primary); }
[data-theme="dark"] .lp-rpt-btn--pdf:hover { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .lp-rpt-btn--bw:hover { background:var(--bg-muted); color:var(--text-primary); }
[data-theme="dark"] .lp-rpt-sep { background:var(--border-light); }

/* ─── Modals shared (lp-modal, tbm-modal, clpm-modal, lp-viewer, sub-pdf, nb-submit) ─── */
[data-theme="dark"] .lp-overlay,
[data-theme="dark"] .tbm-overlay,
[data-theme="dark"] .clpm-overlay,
[data-theme="dark"] .lp-viewer-overlay,
[data-theme="dark"] .sub-pdf-overlay,
[data-theme="dark"] .nb-submit-overlay,
[data-theme="dark"] .umgr-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .lp-modal,
[data-theme="dark"] .tbm-modal,
[data-theme="dark"] .clpm-modal,
[data-theme="dark"] .lp-viewer-modal,
[data-theme="dark"] .sub-pdf-modal,
[data-theme="dark"] .nb-submit-modal { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-xl); }
[data-theme="dark"] .lp-modal-header,
[data-theme="dark"] .tbm-header,
[data-theme="dark"] .clpm-header,
[data-theme="dark"] .lp-viewer-header,
[data-theme="dark"] .sub-pdf-header,
[data-theme="dark"] .nb-submit-modal-header { border-bottom-color:var(--border-light); background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); }
[data-theme="dark"] .lp-modal-title,
[data-theme="dark"] .tbm-title,
[data-theme="dark"] .clpm-title,
[data-theme="dark"] .lp-viewer-title,
[data-theme="dark"] .sub-pdf-title,
[data-theme="dark"] .nb-submit-modal-title { color:var(--text-primary); }
[data-theme="dark"] .lp-modal-sub,
[data-theme="dark"] .tbm-sub,
[data-theme="dark"] .clpm-sub,
[data-theme="dark"] .lp-viewer-sub,
[data-theme="dark"] .sub-pdf-sub,
[data-theme="dark"] .nb-submit-modal-sub { color:var(--text-muted); }
[data-theme="dark"] .lp-modal-close,
[data-theme="dark"] .tbm-close,
[data-theme="dark"] .clpm-close,
[data-theme="dark"] .lp-viewer-close,
[data-theme="dark"] .sub-pdf-close,
[data-theme="dark"] .nb-submit-modal-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .lp-modal-close:hover,
[data-theme="dark"] .tbm-close:hover,
[data-theme="dark"] .clpm-close:hover,
[data-theme="dark"] .lp-viewer-close:hover,
[data-theme="dark"] .sub-pdf-close:hover,
[data-theme="dark"] .nb-submit-modal-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }
[data-theme="dark"] .lp-modal-body,
[data-theme="dark"] .tbm-body,
[data-theme="dark"] .clpm-body,
[data-theme="dark"] .lp-viewer-body,
[data-theme="dark"] .sub-pdf-body,
[data-theme="dark"] .nb-submit-modal-body { color:var(--text-primary); background:var(--bg-card); }
[data-theme="dark"] .lp-modal-footer,
[data-theme="dark"] .tbm-footer,
[data-theme="dark"] .clpm-footer,
[data-theme="dark"] .lp-viewer-footer,
[data-theme="dark"] .sub-pdf-footer,
[data-theme="dark"] .nb-submit-modal-footer { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .lp-modal-tab { color:var(--text-muted); }
[data-theme="dark"] .lp-modal-tab.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .lp-modal-tab:hover:not(.active) { background:var(--bg-muted); }
[data-theme="dark"] .lp-modal-section-label { color:var(--text-secondary); }
[data-theme="dark"] .lp-modal-icon { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .lp-form-row { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .lp-form-row .form-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .lp-vac-row-edit { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .lp-vac-row-edit .form-input { background:var(--input-bg, var(--bg-card)); }
[data-theme="dark"] .lp-icon-del { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .lp-icon-del:hover { background:var(--error); color:#fff; border-color:var(--error); }
[data-theme="dark"] .lp-add-row { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .lp-add-row:hover { background:var(--bg-card); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .lp-btn.ghost { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .lp-btn.ghost:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .lp-btn.primary { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .lp-btn.primary:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }

/* Term Breakups page */
[data-theme="dark"] .tb-row-wrap { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tb-row { background:var(--bg-card); }
[data-theme="dark"] .tb-row:hover { background:var(--bg-muted); }
[data-theme="dark"] .tb-bp-td { color:var(--text-primary); border-bottom-color:var(--border-light); }
[data-theme="dark"] .tb-breakup-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .tb-bp-th { color:var(--text-muted); }
[data-theme="dark"] .tb-cls-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .tb-cls-name { color:var(--text-primary); }
[data-theme="dark"] .tb-sno { color:var(--text-muted); }
[data-theme="dark"] .tb-update-btn { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .tb-update-btn:hover { background:rgba(59,130,246,.2); border-color:#3B82F6; }
[data-theme="dark"] .tb-detail { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .tb-detail-label { color:var(--text-muted); }
[data-theme="dark"] .tb-detail-pill { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .tb-detail-pill.subj { background:rgba(124,58,237,.15); border-color:rgba(124,58,237,.3); color:#C4B5FD; }

/* Term Breakup edit modal (tbm-) */
[data-theme="dark"] .tbm-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .tbm-tab { color:var(--text-muted); }
[data-theme="dark"] .tbm-tab.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .tbm-subj-tabs { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tbm-subj-tab { color:var(--text-muted); }
[data-theme="dark"] .tbm-subj-tab.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .tbm-unit { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .tbm-unit-header { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .tbm-unit-name-input,
[data-theme="dark"] .tbm-topic-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .tbm-unit-name-input::placeholder,
[data-theme="dark"] .tbm-topic-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .tbm-unit-save-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .tbm-unit-save-btn:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .tbm-topic-row { border-bottom-color:var(--border-light); }
[data-theme="dark"] .tbm-topic-del-btn { background:rgba(220,38,38,.12); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .tbm-topic-add-btn { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .tbm-topic-add-btn:hover { background:rgba(59,130,246,.2); }
[data-theme="dark"] .tbm-add-units-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .tbm-add-units-btn:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .tbm-btn--cancel { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .tbm-btn--cancel:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .tbm-btn--save { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* Create Lesson Plans (clp2-) */
[data-theme="dark"] .clp2-hero-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clp2-hero-inner { background:transparent; }
[data-theme="dark"] .clp2-hero-icon { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .clp2-hero-text { color:var(--text-primary); }
[data-theme="dark"] .clp2-hero-title { color:var(--text-primary); }
[data-theme="dark"] .clp2-hero-sub { color:var(--text-muted); }
[data-theme="dark"] .clp2-filter-row { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .clp2-field { color:var(--text-primary); }
[data-theme="dark"] .clp2-field-label { color:var(--text-secondary); }
[data-theme="dark"] .clp2-select-wrap { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); }
[data-theme="dark"] .clp2-select { background:transparent; color:var(--text-primary); }
[data-theme="dark"] .clp2-select-arrow { color:var(--text-muted); }
[data-theme="dark"] .clp2-fetch-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .clp2-toolbar { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clp2-subtabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .clp2-subtab { color:var(--text-muted); }
[data-theme="dark"] .clp2-subtab.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .clp2-add-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .clp2-add-btn:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .clp2-empty-state { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clp2-empty-icon { color:var(--text-muted); background:var(--bg-muted); }
[data-theme="dark"] .clp2-empty-title { color:var(--text-primary); }
[data-theme="dark"] .clp2-empty-sub { color:var(--text-muted); }

/* Lesson plan units list (clpr-) */
[data-theme="dark"] .clpr-unit { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clpr-unit-header { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .clpr-unit-sno { color:var(--text-muted); }
[data-theme="dark"] .clpr-unit-no { color:var(--text-secondary); }
[data-theme="dark"] .clpr-unit-name { color:var(--text-primary); }
[data-theme="dark"] .clpr-stat { color:var(--text-secondary); }
[data-theme="dark"] .clpr-stat--total { color:#93C5FD; }
[data-theme="dark"] .clpr-stat--manual { color:#86EFAC; }
[data-theme="dark"] .clpr-stat--ai { color:#C4B5FD; }
[data-theme="dark"] .clpr-stat-sep { color:var(--text-muted); }
[data-theme="dark"] .clpr-unit-actions { background:transparent; }
[data-theme="dark"] .clpr-unit-right { background:transparent; }
[data-theme="dark"] .clpr-icon-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .clpr-icon-btn:hover { background:var(--bg-muted); }
[data-theme="dark"] .clpr-icon-btn--pdf:hover { color:#FCA5A5; border-color:rgba(220,38,38,.3); background:rgba(220,38,38,.1); }
[data-theme="dark"] .clpr-icon-btn--del:hover { color:#fff; background:var(--error); border-color:var(--error); }
[data-theme="dark"] .clpr-icon-btn--expand { background:var(--bg-muted); }
[data-theme="dark"] .clpr-icon-btn--expand:hover { background:var(--bg-card); }
[data-theme="dark"] .clpr-lessons-list { background:transparent; }
[data-theme="dark"] .clpr-lesson { background:var(--bg-card); border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .clpr-lesson:hover { background:var(--bg-muted); }
[data-theme="dark"] .clpr-lesson-num { color:var(--text-secondary); }
[data-theme="dark"] .clpr-lesson-topic { color:var(--text-primary); }
[data-theme="dark"] .clpr-lesson-actions { background:transparent; }
[data-theme="dark"] .clpr-action-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .clpr-action-edit:hover { background:rgba(59,130,246,.15); color:#93C5FD; border-color:#3B82F6; }
[data-theme="dark"] .clpr-action-pdf:hover { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .clpr-action-del:hover { background:var(--error); color:#fff; border-color:var(--error); }
[data-theme="dark"] .clp-src-badge { background:var(--bg-muted); color:var(--text-muted); border-color:var(--border-light); }
[data-theme="dark"] .nb-aq-pill { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* Lesson editor modal (clpm-) */
[data-theme="dark"] .clpm-body { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .clpm-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .clpm-tab { color:var(--text-muted); }
[data-theme="dark"] .clpm-tab.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .clpm-lang-row { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .clpm-lang-label { color:var(--text-secondary); }
[data-theme="dark"] .clpm-lang-pill { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .clpm-lang-pill.active { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; border-color:transparent; }
[data-theme="dark"] .clpm-tb { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .clpm-tb-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .clpm-tb-btn:hover { background:var(--bg-muted); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .clpm-tb-select { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .clpm-editor { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .clpm-editor:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .clpm-btn { font-weight:700; }
[data-theme="dark"] .clpm-btn--cancel { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .clpm-btn--save { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* Lesson list inside editor (clml-) */
[data-theme="dark"] .clml-unit { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clml-unit-hdr { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .clml-unit-name { color:var(--text-primary); }
[data-theme="dark"] .clml-unit-badge { background:var(--bg-card); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .clml-toggle { color:var(--text-muted); }
[data-theme="dark"] .clml-lesson { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .clml-lesson:hover { background:var(--bg-muted); }
[data-theme="dark"] .clml-lesson-hdr { color:var(--text-primary); }
[data-theme="dark"] .clml-lesson-count { color:var(--text-secondary); }
[data-theme="dark"] .clml-lesson-tags { color:var(--text-muted); }
[data-theme="dark"] .clml-ltag { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .clml-ltag--num { background:rgba(59,130,246,.15); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .clml-ltag--seq { background:rgba(124,58,237,.15); color:#C4B5FD; border-color:rgba(124,58,237,.3); }
[data-theme="dark"] .clml-field-row { color:var(--text-primary); }
[data-theme="dark"] .clml-field-lbl { color:var(--text-muted); }
[data-theme="dark"] .clml-field-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .clml-field-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .clml-edit-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .clml-edit-btn:hover { background:var(--bg-card); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .clml-action-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .clml-action-save:hover { background:rgba(34,197,94,.15); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .clml-action-fetch:hover { background:rgba(59,130,246,.15); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .clml-add-lesson { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .clml-add-lesson:hover { background:var(--bg-card); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .clml-add-unit { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .clml-save-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* Units Manager modal (umgr-) */
[data-theme="dark"] .umgr-unit-row { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .umgr-unit-row:hover { background:var(--bg-muted); }
[data-theme="dark"] .umgr-drag-handle { color:var(--text-muted); }
[data-theme="dark"] .umgr-sno-badge { background:var(--bg-muted); color:var(--text-primary); border-color:var(--border-light); }
[data-theme="dark"] .umgr-no-input,
[data-theme="dark"] .umgr-name-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .umgr-no-input::placeholder,
[data-theme="dark"] .umgr-name-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .umgr-lesson-count { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .umgr-del-btn { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .umgr-del-btn:hover { background:var(--error); color:#fff; border-color:var(--error); }

/* Submissions (sub-, snb-) */
[data-theme="dark"] .sub-role-toggle { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .sub-role-btn { color:var(--text-muted); }
[data-theme="dark"] .sub-role-btn.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .sub-filters { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .sub-filter-field { color:var(--text-primary); }
[data-theme="dark"] .sub-filter-label { color:var(--text-secondary); }
[data-theme="dark"] .sub-fetch-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .sub-fetch-btn:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .sub-inner-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .sub-inner-tab { color:var(--text-muted); }
[data-theme="dark"] .sub-inner-tab.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .sub-inner-count { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .sub-inner-tab.active .sub-inner-count { background:rgba(59,130,246,.18); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .sub-lp-section { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .sub-lp-unit-header { background:var(--bg-muted); border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .sub-lp-row { border-bottom-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .sub-lp-row:hover { background:var(--bg-muted); }
[data-theme="dark"] .sub-lp-status.submitted { color:#86EFAC; }
[data-theme="dark"] .sub-lp-status.pending { color:#FCD34D; }
[data-theme="dark"] .sub-lp-view-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .sub-lp-view-btn:hover { background:#3B82F6; color:#fff; border-color:#3B82F6; }
[data-theme="dark"] .sub-pdf-btn { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .sub-pdf-btn:hover { background:rgba(220,38,38,.25); border-color:var(--error); }
[data-theme="dark"] .sub-pdf-btn--unit,
[data-theme="dark"] .sub-pdf-btn--admin { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }

/* Notebook plans (snb-) */
[data-theme="dark"] .snb-unit { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .snb-unit-hdr { background:var(--bg-muted); border-bottom-color:var(--border-light); }
[data-theme="dark"] .snb-unit-right { background:transparent; }
[data-theme="dark"] .snb-qtype { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .snb-qtype-hdr { color:var(--text-primary); }
[data-theme="dark"] .snb-qtype-label { color:var(--text-primary); }
[data-theme="dark"] .snb-qtype-badges { color:var(--text-muted); }
[data-theme="dark"] .snb-badge { border-color:var(--border-light); }
[data-theme="dark"] .snb-badge--sub { background:rgba(34,197,94,.15); color:#86EFAC; }
[data-theme="dark"] .snb-badge--pend { background:rgba(217,119,6,.15); color:#FCD34D; }
[data-theme="dark"] .snb-qtype-bar-wrap { background:var(--bg-muted); }
[data-theme="dark"] .snb-qtype-bar-track { background:var(--bg-muted); }
[data-theme="dark"] .snb-qtype-submit-btn { background:linear-gradient(135deg,#7C3AED,#6D28D9); color:#fff; }
[data-theme="dark"] .snb-done-badge { background:rgba(34,197,94,.15); color:#86EFAC; border:1px solid rgba(34,197,94,.3); }

/* Lesson plan viewer (lp-viewer-) */
[data-theme="dark"] .lp-viewer-section { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .lp-viewer-section-label { color:var(--text-secondary); }
[data-theme="dark"] .lp-viewer-section-value { color:var(--text-primary); }
[data-theme="dark"] .lp-viewer-cancel-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .lp-viewer-cancel-btn:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .lp-viewer-submit-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .lp-viewer-submit-btn.done,
[data-theme="dark"] .lp-viewer-submit-btn:disabled { background:rgba(34,197,94,.2); color:#86EFAC; }

/* NB submit modal */
[data-theme="dark"] .nb-submit-item { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .nb-submit-item:hover:not(.submitted) { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .nb-submit-item.checked { border-color:#3B82F6; background:rgba(59,130,246,.1); }
[data-theme="dark"] .nb-submit-item-checkbox { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .nb-submit-item.checked .nb-submit-item-checkbox { background:#3B82F6; border-color:#3B82F6; color:#fff; }
[data-theme="dark"] .nb-submit-item-preview { color:var(--text-primary); }
[data-theme="dark"] .nb-submit-item-status.submitted { color:#86EFAC; }
[data-theme="dark"] .nb-submit-item-status.pending { color:#FCD34D; }
[data-theme="dark"] .nb-submit-modal-cancel-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .nb-submit-modal-submit-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }

/* PDF picker modal */
[data-theme="dark"] .sub-pdf-style-row,
[data-theme="dark"] .sub-pdf-scope { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .sub-pdf-style-row.active,
[data-theme="dark"] .sub-pdf-scope.selected { background:rgba(59,130,246,.12); border-color:#3B82F6; }
[data-theme="dark"] .sub-pdf-style-label { color:var(--text-primary); }
[data-theme="dark"] .sub-pdf-style-desc { color:var(--text-muted); }
[data-theme="dark"] .sub-pdf-cancel-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .sub-pdf-gen-btn { background:linear-gradient(135deg,#DC2626,#B91C1C); color:#fff; }

/* Add Questions modal — surfaces had hardcoded light backgrounds (#fff, #F0F9FF, #BAE6FD borders).
   Keep the brand-cyan header as-is, but recolor the body shell, type chips, row cards and inputs
   so the modal is legible against the dark theme. Coloured chips inside rows still get their
   accent fills since they communicate semantic state. */
[data-theme="dark"] .aq-modal { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .aq-body { background:var(--bg-muted); }
[data-theme="dark"] .aq-body::-webkit-scrollbar-thumb { background:var(--border-med); }
[data-theme="dark"] .aq-type-section { background:var(--bg-card); border-bottom-color:var(--border-light); }
[data-theme="dark"] .aq-type-label { color:#7DD3FC; }
[data-theme="dark"] .aq-type-btn-hover { background:var(--bg-muted); border-color:var(--border-light); color:#93C5FD; }
[data-theme="dark"] .aq-type-btn-hover:hover { background:var(--bg-card); border-color:#0891B2; }
[data-theme="dark"] .aq-mq-input,
[data-theme="dark"] .aq-inp-hover,
[data-theme="dark"] .aq-ta-hover { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .aq-mq-input::placeholder,
[data-theme="dark"] .aq-inp-hover::placeholder,
[data-theme="dark"] .aq-ta-hover::placeholder { color:var(--text-muted); }
[data-theme="dark"] .aq-mq-input:focus,
[data-theme="dark"] .aq-inp-hover:focus,
[data-theme="dark"] .aq-ta-hover:focus { background:var(--bg-card); border-color:#0891B2; box-shadow:0 0 0 3px rgba(8,145,178,.18); }
[data-theme="dark"] .aq-row-card-hover { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .aq-row-card-hover:hover { border-color:var(--border-med); }
[data-theme="dark"] .aq-sb-btn { background:var(--bg-card); color:#67E8F9; border-color:#0891B2; }
[data-theme="dark"] .aq-rb-btn { background:rgba(220,38,38,.12); color:#FCA5A5; border-color:rgba(220,38,38,.35); }
[data-theme="dark"] .aq-tf-t-hover { background:var(--bg-card); color:#86EFAC; border-color:#16A34A; }
[data-theme="dark"] .aq-tf-f-hover { background:var(--bg-card); color:#FCA5A5; border-color:#DC2626; }
[data-theme="dark"] .aq-cancel-hover { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .aq-cancel-hover:hover { background:var(--bg-muted); border-color:var(--border-med); color:var(--text-primary); }
[data-theme="dark"] .aq-footer { background:var(--bg-card) !important; border-top-color:var(--border-light) !important; }

/* ───────────────────────── MOBILE (≤600px) ─────────────────────────
   Real internal screen responsiveness: L2 tabs scroll, session cards
   stack, term-breakup table scrolls horizontally, create-lesson
   filter row stacks, unit cards collapse, add-questions modal
   becomes single-column, submissions hero stacks. */
@media (max-width:600px) {
  /* L2 sub-tab strip — horizontal scroll instead of squashing 4 cols */
  .lp-l2-tabs { display:flex; grid-template-columns:none; overflow-x:auto; overflow-y:hidden; flex-wrap:nowrap; scrollbar-width:none; margin-bottom:14px; }
  .lp-l2-tabs::-webkit-scrollbar { display:none; }
  .lp-l2-tab { flex:0 0 auto; min-width:140px; padding:11px 14px; font-size:12px; white-space:nowrap; border-right:1px solid var(--border-light); border-bottom:none; }
  .lp-l2-tab span { display:inline; }

  /* Session cards already 1-col at 900px — tighten padding */
  .ss-cards-grid { gap:12px; margin-bottom:14px; }
  .ss-card { padding:16px 16px; border-radius:18px; }
  .ss-card-hdr { gap:10px; margin-bottom:14px; }
  .ss-card-badge { width:36px; height:36px; font-size:15px; border-radius:11px; }
  .ss-card-hdr-title { font-size:14px; }
  .ss-card-hdr-sub { font-size:10.5px; }
  .ss-data-row { padding:8px 10px; gap:8px; }
  .ss-data-icon { width:24px; height:24px; font-size:9px; }
  .ss-data-label { font-size:11.5px; }
  .ss-data-val { font-size:12.5px; }
  .ss-highlight-banner { padding:10px 12px; font-size:12px; }
  .ss-summ-big { font-size:26px; }
  .ss-summ-hero { padding:12px 0; margin-bottom:12px; }
  .ss-summ-divider { height:42px; }
  .ss-summ-pill-val { font-size:18px; }
  .ss-vac-row { padding:9px 0; gap:8px; }
  .ss-vac-name { font-size:12.5px; }
  .ss-vac-days { font-size:18px; }

  /* Subject pickers — class chips wrap */
  .lp-chips-row { gap:5px; }
  .lp-chip { height:28px; padding:0 11px; font-size:11px; }

  /* Per-week subject grid — collapse to 2 cols */
  .lp-pw-grid { grid-template-columns:repeat(2,1fr) !important; }
  .lp-pw-cell { padding:12px 8px; }
  .lp-pw-cell-name { font-size:10px; margin-bottom:6px; }
  .lp-pw-cell-num { font-size:24px; }
  .lp-pw-cell-lbl { font-size:8.5px; }

  /* Card report bar — wrap buttons */
  .ss-card-report-bar, .lp-report-bar { flex-direction:column; align-items:stretch; gap:8px; padding-top:11px; margin-top:12px; }
  .ss-card-report-btns, .lp-report-btns { width:100%; justify-content:stretch; }
  .ss-card-rpt-btn, .lp-rpt-btn { flex:1 1 auto; justify-content:center; padding:0 10px; font-size:11px; }

  /* Term Breakups — horizontal scroll table */
  .tb-breakup-head, .tb-row { padding:0 12px; min-width:560px; }
  .tb-breakup-head { overflow:visible; }
  .clp2-table-card, .section-card { overflow-x:auto; }
  .tb-bp-th { font-size:10px; padding:10px 6px; }
  .tb-bp-td { font-size:12px; padding:10px 6px; }
  .tb-sno { font-size:13px; }
  .tb-cls-name { gap:6px; font-size:12.5px; }
  .tb-cls-icon { width:24px; height:24px; font-size:10px; }
  .tb-update-btn { padding:5px 11px; font-size:11px; }
  .tb-detail-inner { padding:12px 12px; gap:12px; }
  .tb-detail-pill { font-size:11px; padding:4px 9px; }
  .tb-detail-actions { flex-wrap:wrap; gap:6px; }

  /* Create Lesson Plans — hero card + filter row */
  .clp2-hero-card { padding:16px 14px; border-radius:18px; }
  .clp2-hero-title { font-size:15px; gap:8px; }
  .clp2-hero-icon { width:36px; height:36px; font-size:14px; border-radius:11px; }
  .clp2-hero-sub { font-size:11px; padding-left:0; margin-top:8px; }
  .clp2-filter-row { grid-template-columns:1fr; gap:8px; }
  .clp2-fetch-btn { width:100%; justify-content:center; }

  /* Toolbar (subtabs + add) stack */
  .clp2-toolbar { flex-direction:column; align-items:stretch; gap:10px; padding:12px 12px; }
  .clp2-subtabs { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; width:100%; }
  .clp2-subtabs::-webkit-scrollbar { display:none; }
  .clp2-subtab { flex:0 0 auto; padding:8px 14px; font-size:12px; white-space:nowrap; }
  .clp2-add-btn { width:100%; justify-content:center; padding:0 14px; }

  /* Unit cards — full width, single column header */
  .clpr-unit-card { margin:8px 6px; border-radius:14px; }
  .clpr-unit-header { padding:10px 10px; gap:6px; }
  .clpr-unit-row { grid-template-columns:1fr; gap:8px; padding:12px 12px; }
  .clpr-unit-row > .clpr-unit-actions { justify-content:flex-end; flex-wrap:wrap; }
  .clpr-unit-icon-wrap { width:32px; height:32px; font-size:13px; border-radius:9px; }
  .clpr-unit-card .clpr-unit-name { font-size:12.5px; }
  .clpr-unit-sub { font-size:10.5px; }
  .clpr-unit-card .clpr-unit-stats { padding:0 4px 0 0; gap:3px; }
  .clpr-icon-btn { width:30px; height:30px; font-size:11px; }
  .clpr-lessons-panel { padding:10px 8px; }
  .clpr-lesson-card { padding:10px 10px; }
  .clpr-lesson-top { flex-wrap:wrap; gap:6px; }
  .clpr-lesson-name { font-size:12.5px; }
  .clpr-lesson-actions { flex-wrap:wrap; gap:5px; }

  /* Add-questions modal — full width, single column */
  .aq-modal { border-radius:14px; }
  .aq-header { padding:14px 14px; flex-direction:column; align-items:flex-start; gap:10px; }
  .aq-header-icon { width:36px; height:36px; font-size:15px; }
  .aq-title { font-size:15px; }
  .aq-sub { font-size:11px; }
  .aq-close-hover { align-self:flex-end; margin-top:-44px; }
  .aq-body { padding:0 0 12px; }
  .aq-type-section { padding:12px 14px; }
  .aq-types-grid { gap:6px; }
  .aq-form-area { padding:12px 14px; }
  .aq-row-card-hover { padding:10px 10px; }
  .aq-rb-btn, .aq-sb-btn { width:30px; height:30px; font-size:11px; }
  .aq-cancel-hover, .aq-save-all-hover { width:100%; justify-content:center; }

  /* Submissions hero + filter + analytics */
  .sub-hero-card { padding:16px 14px 14px; margin-bottom:14px; border-radius:18px; }
  .sub-hero-inner { flex-direction:column; align-items:stretch; gap:12px; margin-bottom:14px; }
  .sub-hero-left { gap:10px; }
  .sub-hero-icon-wrap { width:38px; height:38px; font-size:16px; border-radius:11px; }
  .sub-hero-title { font-size:15px; }
  .sub-hero-sub { font-size:11px; }
  .sub-role-toggle { align-self:flex-start; }
  .sub-role-btn { padding:0 12px; font-size:11.5px; }
  .sub-filter-fields { grid-template-columns:1fr; gap:8px; }
  .sub-fetch-btn { width:100%; justify-content:center; }
  .sub-analytics-strip { grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
  .sub-stat-card { padding:12px 12px; }
  .sub-stat-val { font-size:22px; }
  .sub-stat-icon { width:32px; height:32px; font-size:13px; border-radius:9px; }
  .sub-stat-lbl { font-size:10.5px; }
  .sub-empty-state { padding:48px 16px; }
  .sub-empty-icon { width:64px; height:64px; font-size:24px; border-radius:18px; }
  .sub-empty-title { font-size:15px; }
  .sub-empty-sub { font-size:12px; }
  .sub-admin-grid { grid-template-columns:1fr !important; gap:10px; }

  /* Lesson viewer meta grid — single column */
  .lp-viewer-meta-grid { grid-template-columns:1fr; gap:8px; }
  .lp-viewer-modal { border-radius:14px; }
  .lp-viewer-header { padding:14px 14px; flex-wrap:wrap; gap:10px; }
  .lp-viewer-body { padding:14px 14px; }
  .lp-viewer-footer { flex-direction:column; gap:8px; padding:12px 14px; }
  .lp-viewer-submit-btn, .lp-viewer-cancel-btn { width:100%; justify-content:center; }

  /* Lesson plan modal (lp-modal) — stack header/footer */
  .lp-modal { border-radius:14px; }
  .lp-modal-header { padding:14px 14px; flex-wrap:wrap; gap:8px; }
  .lp-modal-tabrow { overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; }
  .lp-modal-tabrow::-webkit-scrollbar { display:none; }
  .lp-modal-tab { flex:0 0 auto; white-space:nowrap; }
  .lp-modal-body { padding:14px 14px; }
  .lp-modal-footer { flex-direction:column; gap:8px; padding:12px 14px; }
  .lp-btn { width:100%; justify-content:center; }

  /* CLPM modal (lesson editor) — collapse into single column */
  .clpm-modal { border-radius:14px; }
  .clpm-header { padding:14px 14px; flex-direction:column; align-items:flex-start; gap:10px; }
  .clpm-header-meta { flex-wrap:wrap; gap:6px; }
  .clpm-left, .clpm-right { width:100%; padding:14px 14px; }
  .clpm-right-topbar { flex-wrap:wrap; gap:8px; }
  .clpm-rte-header { flex-direction:column; align-items:stretch; gap:8px; }
  .clpm-rte-toolbar { flex-wrap:wrap; gap:5px; }
  .clpm-footer { flex-direction:column; gap:8px; padding:12px 14px; }
  .clpm-btn { width:100%; justify-content:center; }

  /* Term Breakup Modal — reduce padding */
  .tbm-header { padding:14px 14px; gap:8px; }
  .tbm-title { font-size:14px; }

  /* Unit Manager modal rows */
  .umgr-unit-row { flex-wrap:wrap; gap:8px; padding:10px 10px; }
  .umgr-name-input, .umgr-no-input { font-size:13px; }
  .umgr-lesson-count { width:100%; justify-content:flex-start; font-size:11px; }
  .umgr-del-btn { margin-left:auto; }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — Academics → Lesson Plans (≤ 767px)
   Converts the div-based Term Breakup table rows into cards:
   Class name on top, then PDF + Word buttons side-by-side, then
   Update + chevron actions.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 767px) {
  /* ─── Term Breakup → CARD layout ─── */
  .tb-breakup-head { display: none !important; }
  .tb-row-wrap {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .tb-row {
    display: flex !important;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 12px 14px;
    background: transparent;
  }
  .tb-row > .tb-bp-td {
    width: 100% !important;
    flex: none !important;
    padding: 0 !important;
    justify-content: flex-start !important;
  }
  /* Hide the small S.No. cell label on mobile (number stays inline) */
  .tb-row > .tb-bp-td:first-child .tb-sno {
    display: inline-flex;
    margin-right: 8px;
  }
  /* Class name cell — primary heading */
  .tb-cls-name { gap: 8px; font-size: 14px; font-weight: 700; }
  .tb-cls-icon { width: 32px; height: 32px; flex-shrink: 0; }
  /* ─── ROOT-CAUSE OVERRIDES — kill the legacy "horizontal scroll table"
        rules from @media (max-width:600px) above that were applying
        min-width: 560px to .tb-row and overflow-x: auto to .section-card.
        Those forced the row wider than the viewport on mobile, pushing
        the Word button off-screen and clipping it. ─── */
  .tb-row {
    min-width: unset !important;
    max-width: 100% !important;
    width: 100% !important;
    padding: 12px !important;
    box-sizing: border-box !important;
  }
  .tb-breakup-head { min-width: unset !important; }
  .section-card,
  .clp2-table-card {
    overflow: visible !important;
    overflow-x: visible !important;
    overflow-y: visible !important;
  }

  /* ─── PROBLEM 1 FIX — Download Report (PDF + Word) button row.
        Per user spec: container uses overflow:visible so the buttons
        cannot be clipped, padding-right: 0, box-sizing: border-box.
        Each button uses flex: 1 1 0% + width: 0 so they share space
        equally regardless of intrinsic content width. ─── */
  .tb-row > .tb-bp-td:nth-of-type(3) {
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    gap: 8px !important;
    overflow: visible !important;
    padding: 0 !important;
    padding-right: 0 !important;
    margin-top: 4px;
  }
  .tb-row > .tb-bp-td:nth-of-type(3) > *,
  .tb-row > .tb-bp-td:nth-of-type(3) > button,
  .tb-row > .tb-bp-td:nth-of-type(3) > a,
  .tb-row > .tb-bp-td:nth-of-type(3) .export-btn {
    flex: 1 1 0% !important;
    width: 0 !important;
    min-width: 0 !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    justify-content: center;
    padding: 7px 8px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Update action — full-width below the PDF/Word row */
  .tb-row > .tb-bp-td:nth-of-type(4) { margin-top: 4px; }
  .tb-row > .tb-bp-td:nth-of-type(4) .tb-update-btn { width: 100%; justify-content: center; }

  /* ─── Chevron — placed at TOP-RIGHT of the card, in line with the
        class-name row. This makes the card compact (no extra row at
        the bottom for just the dropdown icon). ─── */
  .tb-row { position: relative; padding-right: 48px !important; }
  .tb-row > .tb-bp-td:last-child {
    position: absolute !important;
    top: 12px !important;
    right: 12px !important;
    width: auto !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
  }
  .tb-row > .tb-bp-td:last-child .expand-btn {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }

  /* ─── PROBLEM 2 FIX — Card container compact, no empty space.
        Hides the S.No cell entirely (the card IS the class entry),
        clears desktop's min-height: 60px, tightens padding.
        Per user spec: also hides any empty <div> spacer inside the
        card that might be adding height. ─── */
  .tb-row-wrap {
    padding-bottom: 12px !important;
    margin-bottom: 10px !important;
    min-height: unset !important;
    height: auto !important;
  }
  .tb-row {
    min-height: unset !important;
    height: auto !important;
    padding: 12px !important;
    padding-bottom: 12px !important;
    gap: 6px !important;
  }
  /* S.No cell — hidden on mobile (the card itself identifies the class) */
  .tb-row > .tb-bp-td:first-child { display: none !important; }
  /* Any empty <div> spacer inside the card row → no height */
  .tb-row-wrap > div:empty,
  .tb-row > div:empty {
    display: none !important;
    height: 0 !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  /* ─── Section header above Term Breakup table ─── */
  .lp-report-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }

  /* ─── Lesson Plans hero / filters ─── */
  .clp2-hero-card,
  .clp2-filter-row,
  .sub-filter-fields,
  .sub-hero-card {
    grid-template-columns: 1fr !important;
    gap: 10px;
  }
  .clp2-toolbar { flex-direction: column; align-items: stretch; gap: 10px; }
  .clp2-subtabs,
  .lp-l2-tabs {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }
  .clp2-subtabs::-webkit-scrollbar,
  .lp-l2-tabs::-webkit-scrollbar { display: none; }
  .lp-l2-tabs { grid-template-columns: none !important; display: flex !important; gap: 6px; }
  .lp-l2-tabs > * { flex: 0 0 auto; min-width: 140px; }

  /* ─── Subject submissions analytics strip ─── */
  .sub-analytics-strip { grid-template-columns: 1fr 1fr !important; gap: 8px; }

  /* ─── Viewer / detail grids ─── */
  .lp-viewer-meta-grid,
  .lp-pw-grid { grid-template-columns: 1fr !important; gap: 8px; }

  /* ─── Modal footers — stacked buttons ─── */
  .lp-modal-footer,
  .clpm-footer,
  .aq-footer {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .lp-modal-footer > button,
  .clpm-footer > button,
  .aq-footer > button { width: 100%; }

  /* ─── Add Questions modal — 1-col ─── */
  .aq-modal { max-width: 95vw !important; max-height: 90vh !important; }
  .aq-row-card,
  .aq-mq-input,
  .aq-inp,
  .aq-ta { width: 100%; }

  /* ─── Unit progression list ─── */
  .clpr-unit-row,
  .clpr-unit-card {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 12px 14px;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   TABLET RESPONSIVE — Lesson Plans (768px – 1023px)
   ═══════════════════════════════════════════════════════════════════ */
@media (min-width: 768px) and (max-width: 1023px) {
  .sub-analytics-strip { grid-template-columns: repeat(2, 1fr); }
  .ss-cards-grid { grid-template-columns: repeat(2, 1fr); }
  .clp2-filter-row,
  .sub-filter-fields { grid-template-columns: repeat(2, 1fr); }
}

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE — Add Questions modal (.aq-*) + Lesson Edit modal
   (.clpm-*). These two modals were ported "verbatim from HTML" with
   hardcoded #fff / light-blue palettes and no dark coverage. We
   override surfaces, inputs, type chips, badges, and the inline-
   styled inner cards (matched via [style*="…"] attribute selectors
   because the JSX uses inline backgrounds).
   ═══════════════════════════════════════════════════════════════════ */
[data-theme="dark"] .aq-modal {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
  color: var(--text-primary);
}
[data-theme="dark"] .aq-body { background: var(--bg-base) !important; }
[data-theme="dark"] .aq-type-section {
  background: var(--bg-card) !important;
  border-bottom-color: var(--border-light) !important;
}
[data-theme="dark"] .aq-type-label { color: #93C5FD !important; }
[data-theme="dark"] .aq-type-btn-hover {
  background: var(--bg-muted) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .aq-type-btn-hover:hover { background: var(--bg-card) !important; border-color: #3B82F6 !important; color: #93C5FD !important; }
[data-theme="dark"] .aq-type-btn-hover.active {
  background: linear-gradient(135deg,#1E3A8A,#1E40AF) !important;
  color: #fff !important;
  border-color: transparent !important;
}
[data-theme="dark"] .aq-form-area { background: var(--bg-base) !important; }
/* Inline-styled inner card: <div style={{ background:'#fff', border:'1.5px solid #BAE6FD' }}> */
[data-theme="dark"] .aq-form-area > div[style*="#fff"],
[data-theme="dark"] .aq-form-area > div[style*="#BAE6FD"] {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
}
/* Inline-styled inner header gradient on the white card */
[data-theme="dark"] .aq-form-area > div > div[style*="F0F9FF"],
[data-theme="dark"] .aq-form-area > div > div[style*="E0F2FE"] {
  background: var(--bg-muted) !important;
  border-bottom-color: var(--border-light) !important;
}
/* Section title text (was #0C4A6E navy) → readable on dark */
[data-theme="dark"] .aq-form-area > div > div div[style*="#0C4A6E"] { color: var(--text-primary) !important; }
[data-theme="dark"] .aq-form-area div[style*="#0369A1"] { color: #93C5FD !important; }

/* Main Question + row inputs/textareas */
[data-theme="dark"] .aq-mq-input,
[data-theme="dark"] .aq-inp-hover,
[data-theme="dark"] .aq-ta-hover {
  background: var(--input-bg, var(--bg-card)) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .aq-mq-input::placeholder,
[data-theme="dark"] .aq-inp-hover::placeholder,
[data-theme="dark"] .aq-ta-hover::placeholder { color: var(--text-muted) !important; }
[data-theme="dark"] .aq-mq-input:focus,
[data-theme="dark"] .aq-inp-hover:focus,
[data-theme="dark"] .aq-ta-hover:focus {
  background: var(--bg-card) !important;
  border-color: #3B82F6 !important;
  box-shadow: 0 0 0 3px rgba(59,130,246,.18) !important;
}

/* Row card (Word/Opposite, Fill-blanks, etc.) */
[data-theme="dark"] .aq-row-card-hover {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .aq-row-card-hover:hover { border-color: #3B82F6 !important; }

/* Inline-styled "Statement contenteditable" inside Comprehension */
[data-theme="dark"] .aq-row-card-hover div[contenteditable] {
  background: var(--bg-card) !important;
  color: var(--text-primary) !important;
  border-color: var(--border-light) !important;
}

/* Inline labels (uppercase muted) inside rows */
[data-theme="dark"] .aq-row-card-hover span[style*="#475569"],
[data-theme="dark"] .aq-row-card-hover span[style*="#0369A1"] {
  color: var(--text-muted) !important;
}

/* Inline action-row dashed separator */
[data-theme="dark"] .aq-row-card-hover div[style*="dashed #E0F2FE"] { border-top-color: var(--border-light) !important; }

/* Inline rest of row text/numbers */
[data-theme="dark"] .aq-row-card-hover span[style*="#0F172A"] { color: var(--text-primary) !important; }

/* MCQ option boxes (inline backgrounds) */
[data-theme="dark"] .aq-row-card-hover div[style*="#EFF6FF"] { background: rgba(59,130,246,.15) !important; }
[data-theme="dark"] .aq-row-card-hover div[style*="#F5F3FF"] { background: rgba(124,58,237,.15) !important; }
[data-theme="dark"] .aq-row-card-hover div[style*="#EFF9FF"] { background: rgba(6,182,212,.15) !important; }
[data-theme="dark"] .aq-row-card-hover div[style*="#FFFBEB"] { background: rgba(217,119,6,.15) !important; }
[data-theme="dark"] .aq-row-card-hover input[style*="#EFF6FF"],
[data-theme="dark"] .aq-row-card-hover input[style*="#F5F3FF"],
[data-theme="dark"] .aq-row-card-hover input[style*="#EFF9FF"],
[data-theme="dark"] .aq-row-card-hover input[style*="#FFFBEB"] {
  background: transparent !important;
  color: var(--text-primary) !important;
}

/* Fill-in-blanks helper strip (was #F0F9FF) */
[data-theme="dark"] .aq-row-card-hover div[style*="#F0F9FF"] {
  background: rgba(59,130,246,.10) !important;
}
[data-theme="dark"] .aq-row-card-hover input[style*="#fff"][style*="0891B2"] {
  background: var(--input-bg, var(--bg-card)) !important;
  color: var(--text-primary) !important;
}

/* True/False buttons */
[data-theme="dark"] .aq-tf-t-hover,
[data-theme="dark"] .aq-tf-f-hover { background: var(--bg-card) !important; }
[data-theme="dark"] .aq-tf-t-hover { color: #4ADE80 !important; border-color: #15803D !important; }
[data-theme="dark"] .aq-tf-f-hover { color: #FCA5A5 !important; border-color: #B91C1C !important; }

/* Cancel button */
[data-theme="dark"] .aq-cancel-hover {
  background: var(--bg-muted) !important;
  color: var(--text-secondary) !important;
  border-color: var(--border-light) !important;
}
[data-theme="dark"] .aq-cancel-hover:hover { background: var(--bg-card) !important; color: var(--text-primary) !important; }

/* Inline-styled .aq-footer (white bg + light-blue border) */
[data-theme="dark"] .aq-footer[style] {
  background: var(--bg-card) !important;
  border-top-color: var(--border-light) !important;
}

/* Bottom "+ Add More" container border */
[data-theme="dark"] .aq-form-area > div > div[style*="#E0F2FE"][style*="center"] { border-top-color: var(--border-light) !important; }

/* ── Lesson Edit Modal (.clpm-*) dark mode ── */
[data-theme="dark"] .clpm-modal {
  background: var(--bg-card) !important;
  border-color: var(--border-light) !important;
  color: var(--text-primary);
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE PATCH (≤ 767px) — Add Questions modal + Notebook items
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 767px) {
  /* Modal container — fit viewport, scroll body only */
  .aq-overlay { padding: 0 !important; align-items: flex-end !important; }
  .aq-modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 95vh !important;
    border-radius: 18px 18px 0 0 !important;
  }
  .aq-header { padding: 14px 16px !important; }
  .aq-header-icon { width: 36px !important; height: 36px !important; font-size: 15px !important; }
  .aq-title { font-size: 14.5px !important; }
  .aq-sub { font-size: 11px !important; }

  /* Type-selector grid — wraps cleanly, touch-friendly chips */
  .aq-type-section { padding: 12px 14px 8px !important; }
  .aq-types-grid { gap: 8px !important; }
  .aq-type-btn-hover {
    flex: 0 0 auto !important;
    height: 36px !important;
    padding: 0 12px !important;
    font-size: 12px !important;
    white-space: nowrap !important;
  }

  /* Form area inner card — full width, less inset */
  .aq-form-area { padding: 12px 12px !important; }
  .aq-form-area > div { border-radius: 14px !important; }
  .aq-form-area > div > div:first-child {
    padding: 14px 14px 12px !important;
  }

  /* Row card — tighten and prevent overflow */
  .aq-row-card-hover {
    padding: 12px 12px !important;
    margin-bottom: 10px !important;
    overflow: visible !important;
  }
  .aq-row-card-hover > div[style*="flex"] {
    flex-wrap: wrap !important;
    gap: 10px !important;
  }
  /* Word/Opposite two-col rows: each field full-width on phones */
  .aq-row-card-hover > div > div[style*="flex: 1"] {
    flex: 1 1 100% !important;
    min-width: 0 !important;
  }
  /* Arrow between cols on two-col layouts */
  .aq-row-card-hover > div > div[style*="paddingBottom: 10"],
  .aq-row-card-hover > div > div[style*="padding-bottom: 10"] {
    display: none !important;
  }

  .aq-inp-hover,
  .aq-mq-input { height: 40px !important; font-size: 13px !important; }
  .aq-ta-hover { min-height: 70px !important; font-size: 13px !important; }

  /* Row action buttons — Remove + Save aligned right, never clipped */
  .aq-row-card-hover > div[style*="border-top: 1px dashed"],
  .aq-row-card-hover > div[style*="borderTop: 1px dashed"] {
    display: flex !important;
    flex-direction: row !important;
    justify-content: flex-end !important;
    gap: 8px !important;
    width: 100% !important;
    margin-top: 12px !important;
    padding-top: 10px !important;
    overflow: visible !important;
  }
  .aq-rb-btn,
  .aq-sb-btn {
    flex-shrink: 0 !important;
    height: 34px !important;
    padding: 0 12px !important;
    font-size: 11.5px !important;
  }

  /* Add More — full-width touch CTA */
  .aq-add-more-hover {
    width: 100% !important;
    height: 42px !important;
    padding: 0 18px !important;
    font-size: 13px !important;
    justify-content: center !important;
  }

  /* Footer — Cancel + Save Questions stack to column, full-width */
  .aq-footer[style] {
    flex-direction: column !important;
    gap: 8px !important;
    padding: 12px 14px !important;
  }
  .aq-cancel-hover,
  .aq-save-all-hover {
    width: 100% !important;
    height: 44px !important;
    font-size: 13px !important;
  }

  /* True/False buttons stay 50/50 */
  .aq-tf-t-hover,
  .aq-tf-f-hover { height: 42px !important; font-size: 13.5px !important; }

  /* MCQ options 2x2 → 1 col on phones for breathing room */
  .aq-row-card-hover > div[style*="grid-template-columns: 1fr 1fr"],
  .aq-row-card-hover > div[style*="gridTemplateColumns: '1fr 1fr'"] {
    grid-template-columns: 1fr !important;
  }
  /* MCQ Correct Answer row — wrap input below label so it's not clipped */
  .aq-row-card-hover > div[style*="#BBF7D0"] {
    flex-wrap: wrap !important;
  }
  .aq-row-card-hover > div[style*="#BBF7D0"] input[style*="0 13px"] {
    flex: 1 1 100% !important;
    min-width: 0 !important;
  }

  /* Fill-blanks helper row — label + input full-width */
  .aq-row-card-hover > div[style*="#F0F9FF"] {
    flex-wrap: wrap !important;
  }
  .aq-row-card-hover > div[style*="#F0F9FF"] input[style*="0 13px"] {
    flex: 1 1 100% !important;
    max-width: none !important;
    min-width: 0 !important;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE PATCH (≤ 767px) — Notebook Plans lesson item rows
   Reinforces the previous mobile fix with the exact two-row layout
   the user described:
     Row 1: [#1] [type badge] [📄] [text…]
     Row 2: [items badge] [Manual] [✏️] [📄] [🗑️]
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 767px) {
  .clpr-lesson-card { padding: 0 !important; }
  .clpr-lesson-top {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
    padding: 10px 12px !important;
  }
  /* Row 1 — meta line (#1 + type tag + icon + ellipsing text) */
  .clpr-lesson-top > .clpr-lesson-meta {
    order: 1 !important;
    width: 100% !important;
    flex: 0 0 100% !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
    overflow: hidden !important;
    gap: 6px !important;
  }
  .clpr-lesson-top > .clpr-lesson-meta .clpr-lesson-name {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    font-size: 13px !important;
  }

  /* Row 2 — badges + actions */
  .clpr-lesson-top > span:not(.clpr-lesson-num):not(.clpr-lesson-num-tag),
  .clpr-lesson-top > .clp-src-badge {
    order: 2 !important;
    flex: 0 0 auto !important;
  }
  .clpr-lesson-top > .clpr-lesson-actions {
    order: 3 !important;
    margin-left: auto !important;
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 6px !important;
    flex-wrap: nowrap !important;
    flex-shrink: 0 !important;
  }
  /* Action buttons → 32×32 icon-only, hide labels */
  .clpr-lesson-top > .clpr-lesson-actions .clpr-action-btn,
  .clpr-lesson-top > .clpr-lesson-actions .clpr-icon-btn {
    width: 32px !important;
    height: 32px !important;
    padding: 4px !important;
    flex-shrink: 0 !important;
    justify-content: center !important;
  }
  .clpr-lesson-top > .clpr-lesson-actions .clpr-action-btn span { display: none !important; }
}
`;
