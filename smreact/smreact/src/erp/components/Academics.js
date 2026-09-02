import React, { useEffect, useMemo, useState } from 'react';
import LessonPlans from './LessonPlans';
import Tooltip from './Tooltip';
import TutorialModal from './TutorialModal';
import { buildUrl, assertSessionPayload, registerSessionToast, apiMessage, resolveMediaUrl } from '../../utils/apiConfig';
import { deliverReport } from './reportDelivery';
import { useModuleReadOnly, validateSessionDateFromStorage } from '../pages/Settings/settingsStore';
import { usePermissions } from '../context/PermissionsContext';
import RouteFallback from '../shared/RouteFallback';
/* Resource Library LIVE hai — school ke apne PDF resources branchID ki base
   par (/api/manage-resource-library). Wahi table chain portal bhi use karta
   hai, wahan scope networkID ka hota hai. */
import {
  fetchBranchResources, saveBranchResource, deleteBranchResource,
  fetchClassSubjects as rlFetchClassSubjects,
} from '../services/resourceLibraryService';



/* Terms, key dates aur activity events sab LIVE API se aate hain
   (/api/termscrud, /api/getkeydatesybranchidandterms,
   /api/activitycalendarcrud waghera — dekho loadCalendar).
   Koi mock/seed data yahan nahi: API kuch na de to screen khali rehti hai. */


const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_META = {
  upcoming:  { bg: 'rgba(30,58,138,.08)',  color: '#1E40AF', label: 'Upcoming',  icon: 'fa-clock' },
  ongoing:   { bg: 'rgba(217,119,6,.08)',  color: '#D97706', label: 'Ongoing',   icon: 'fa-spinner' },
  completed: { bg: 'rgba(22,163,74,.08)',  color: '#16A34A', label: 'Completed', icon: 'fa-circle-check' },
};

const parseEventDate = str => {
  if (!str || str === 'TBD') return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

/* ── Module-level cache (mount ke beech survive karta hai) ──
   Ek dafa Academics load ho jaye to dobara aane par loader NAHI — cached classes
   foran, background refresh. Loader sirf: (a) pehli dfa (login ke baad), ya
   (b) jab session badle (Settings me action → sessionID/changeSessionId change). */
let acadLoadedOnce = false;
let acadLoadedSessionKey = '';
let acadClassesCache = [];
const acadSessionKey = () =>
  `${sessionStorage.getItem('sessionID') || ''}|${sessionStorage.getItem('changeSessionId') || ''}`;

/* ═══════════════════════════════════════════════════════════════════
   MAIN ACADEMICS SHELL
   ═══════════════════════════════════════════════════════════════════ */
export default function Academics({ l1, setL1, l2, setL2, l3, setL3, toast }) {
  /* Logged-in user ki Academics permissions (School Head → sab true). */
  const { can } = usePermissions();
  const acadView = (sub) => can('Academics', sub, 'View');
  const showTextbooks = acadView('Textbooks');
  const showTerms     = acadView('Term Settings');
  const showAcadCal   = acadView('Academic Calendar');
  const showActCal    = acadView('Activity Calendar');
  const showCal       = showAcadCal || showActCal;
  const showSos       = showTextbooks || showTerms || showCal;
  const showLp        = ['Session Settings', 'Term Breakups', 'Create Lesson Plans', 'Submissions'].some(acadView);
  const showRl        = acadView('Resource Library');

  /* Agar active tab ka View nahi to pehle visible tab par snap karo (L1/L2/L3). */
  useEffect(() => {
    const vis = { sos: showSos, lp: showLp, rl: showRl };
    if (vis[l1]) return;
    const first = ['sos', 'lp', 'rl'].find((k) => vis[k]);
    if (first && first !== l1) setL1(first);
  }, [showSos, showLp, showRl, l1, setL1]);
  useEffect(() => {
    if (l1 !== 'sos') return;
    const vis = { tb: showTextbooks, terms: showTerms, cal: showCal };
    if (vis[l2]) return;
    const first = ['tb', 'terms', 'cal'].find((k) => vis[k]);
    if (first && first !== l2) setL2(first);
  }, [l1, showTextbooks, showTerms, showCal, l2, setL2]);
  useEffect(() => {
    if (l1 !== 'sos' || l2 !== 'cal') return;
    const vis = { ac: showAcadCal, act: showActCal };
    if (vis[l3]) return;
    const first = ['ac', 'act'].find((k) => vis[k]);
    if (first && first !== l3) setL3(first);
  }, [l1, l2, showAcadCal, showActCal, l3, setL3]);

  /* Academic-calendar terms are built live from termscrud + key dates (see loadCalendar).
     Start empty so the modal never opens against id-less seed data. */
  const [terms, setTerms] = useState([]);
  /* Khali se shuru. Pehle yahan mock se ek khali placeholder row girti thi
     (mockTermData); asli terms /api/termscrud + key dates se aate hain. */
  const [termData, setTermData] = useState([]);
  const [events, setEvents] = useState([]);
  const reportSubjectsRef = React.useRef(null);
  /* Activity report ka current-view scope: { events: filtered, label: 'July 2026' | ... }.
     Month/Week/Day/Year jo view active ho, report usi period tak scoped download hoti hai. */
  const reportActivityScopeRef = React.useRef(null);

  /* Let module-level POST wrappers surface the "no session" error via toast. */
  useEffect(() => { registerSessionToast(toast); }, [toast]);

  /* Editing (add/update/delete) is only allowed on the user's own login session.
     When they switch to view another session (changeSessionId differs from the
     login SessionID/sessionID), calendar action buttons are disabled. */
  const changeSessionId = sessionStorage.getItem('changeSessionId');
  const loginSessionId  = sessionStorage.getItem('sessionID') || sessionStorage.getItem('SessionID') || '';
  /* Even on the current session, if the Academics module checkbox is OFF in the
     session settings, this module is view-only. Fold it into isOtherSession so
     every existing edit/add/delete guard respects it. */
  const acadModuleReadOnly = useModuleReadOnly('acad');
  const isOtherSession  = (!!changeSessionId && !!loginSessionId && String(changeSessionId) !== String(loginSessionId)) || acadModuleReadOnly;
const [noSessionModal, setNoSessionModal] = useState(false);
/* Loader tabhi jab pehli dfa load ho raha ho YA session badla ho — warna cached
   data foran (dobara Academics par aane par loader nahi). */
const [sessionLoading, setSessionLoading] = useState(() => !acadLoadedOnce || acadLoadedSessionKey !== acadSessionKey());
  const [reportPicker, setReportPicker] = useState({ open: false, name: '', format: 'pdf' });
  const [confirmCfg, setConfirmCfg] = useState(null);
  const [calEditOpen, setCalEditOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [activityModal, setActivityModal] = useState({ open: false, editing: null });
  const [releasesOpen, setReleasesOpen] = useState(false); // Releases from Head Office full-screen panel
  const [activityReload, setActivityReload] = useState(0); // bump → ActivityCalendar apne month-events dobara laaye
  const [classesData, setClassesData] = useState(acadClassesCache);
  const [monthApiEnabled, setMonthApiEnabled] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(true); // assume true until checked

const getClassesData = async () => {
  /* Don't fetch (or show) classes for a branch that has no active academic
     session — there's nothing valid to scope the data to. */
  if (!sessionStorage.getItem('sessionID')) {
    setClassesData([]);
    return;
  }
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

    acadClassesCache = json.data || [];      // cache — remount par foran dikhane ke liye
    setClassesData(acadClassesCache);
  } catch (error) {
    console.error("Error loading classes:", error);
  }
};

const getSessionData = async () => {
  try {
    const branchID = sessionStorage.getItem("branchID");

    const res = await fetch(
      buildUrl(`/api/Setting/get-academic-active-sessions-by-branch/${branchID}`),
      {
        method: "GET",
        headers: {
          Accept: "*/*",
        },
      }
    );

    const json = await res.json();

    if (json?.data && json.data.length > 0) {
      const active = json.data[0];
      sessionStorage.setItem('sessionID', active.ID);
      sessionStorage.setItem('sessionName', active.SessionName);
      notifySessionChange();
    } else {
      /* No active academic session found for this branch — guide the user
         to configure one instead of silently failing or carrying over a
         stale session from a previously opened branch. */
      sessionStorage.removeItem('sessionID');
      sessionStorage.removeItem('sessionName');
      sessionStorage.removeItem('changeSessionId');
     setNoSessionModal(true);
notifySessionChange();
    }
  } catch (error) {
    console.error("Error loading session data:", error);
    toast('Could not load academic session for this branch', 'error');
  }
  // NOTE: setSessionLoading(false) yahan se hata diya — mount effect isay session +
  // classes DONO load hone ke baad off karta hai (warna classes empty aati thi).
};


useEffect(() => {
  (async () => {
    try {
      /* Pehle session-check API (sessionID set hoti hai), PHIR classes. Agar pehle se
         loaded ha aur session wahi ha to sessionLoading already false ha (loader nahi) —
         ye fetch sirf background refresh ha. Warna loader chalta ha. */
      await getSessionData();
      if (l2 === 'tb') await getClassesData();
    } finally {
      acadLoadedOnce = true;
      acadLoadedSessionKey = acadSessionKey();
      setSessionLoading(false); // needFull tha to loader band; warna already false (no-op)
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


const openReport = (name, format = 'pdf', subjectsForReport = null, activityScope = null) => {
  reportSubjectsRef.current = subjectsForReport;
  reportActivityScopeRef.current = activityScope;
  setReportPicker({ open: true, name, format, subjectsForReport });
};

const closeReport = () => setReportPicker(r => ({ ...r, open: false }));  // ← YAHAN HONI CHAHIYE

  const openConfirm = cfg => setConfirmCfg(cfg);
  const closeConfirm = () => setConfirmCfg(null);

  /* Build the academic-calendar TERMS list from the live backend: terms come from
     termscrud and key dates from getkeydatesybranchid, grouped under each term by
     the key-date's `terms` (= term id). Re-run on mount and whenever the Calendar
     tab is opened so it reflects the latest terms & key dates. */
  const loadCalendar = async () => {
    try {
      const [termsRes, keyDates] = await Promise.all([
        termsCrud({ id: 0, branchID: termsBranchID(), term: 'string', sessionYearID: termsSessionYearID(), action: 'get' }),
        getKeyDates(),
      ]);
      const termList = Array.isArray(termsRes) ? termsRes : (termsRes?.data || []);
      setTerms(termList.map(t => ({
        id: t.id,
        label: t.term || 'Unnamed',
        entries: keyDates
          .filter(k => String(k.terms) === String(t.id))
          .map(k => ({ id: k.id, heading: k.head || '', date: k.value || '' })),
      })));
    } catch (e) {
      console.error('Error loading academic calendar:', e);
    }
  };

  /* Load activities from backend, mapped to UI shape. */
  const loadActivities = async () => {
    try {
      const rows = await getActivityCalendar();
      setEvents(rows.map(mapActivity));
    } catch (e) {
      console.error('Error loading activities:', e);
    }
  };


  /* Load once on mount and refresh each time the Calendar tab is opened. */
  useEffect(() => { loadCalendar(); }, []);
  useEffect(() => { if (l2 === 'cal') loadCalendar(); }, [l2]);

  /* Re-run the calendar build whenever a session key changes (same-tab custom
     event) or another tab edits sessionStorage (native 'storage' event). */
  useEffect(() => {
    const reload = () => loadCalendar();
    window.addEventListener(SESSION_CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);
  /* Activity calendar — load on mount, on Activity tab open, and on session change. */
  useEffect(() => {
  if (l3 === 'act') {
    setMonthApiEnabled(false);
    loadActivities();
    
  }
}, [l3]);
  // useEffect(() => { if (l3 === 'act') loadActivities(); }, [l3]);
  useEffect(() => {
    const reload = () => loadActivities();
    window.addEventListener(SESSION_CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

 const hasSession = !!sessionStorage.getItem('sessionID');

/* While the active-session API is still loading, show the same module loader
   used across the app — never the "no session" screen. This stops the false
   "no session" flash on entry (e.g. right after login) while the session-get
   API is in flight. */
if (sessionLoading) {
  return <RouteFallback label="Loading Academics…" sub="Loading the current academic session — please wait." />;
}

if (!hasSession) {
  return (
    <div>
      <style>{ACADEMICS_CSS}</style>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon"><i className="fa-solid fa-book-open-reader"></i></div>
          <div>
            <div className="page-title">Academics</div>
            <div className="page-sub">Manage scheme of studies, textbooks, calendars &amp; lesson plans</div>
          </div>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '420px',
        padding: '40px 20px',
      }}>
        <div style={{
          maxWidth: 420,
          width: '100%',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-md)',
          padding: '40px 32px',
          textAlign: 'center',
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'rgba(217,119,6,.1)', color: '#D97706',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, margin: '0 auto 22px',
            boxShadow: '0 8px 24px rgba(217,119,6,.2)',
          }}>
            <i className="fa-solid fa-calendar-xmark"></i>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10, letterSpacing: '-.02em' }}>
            No Active Session
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-muted)', lineHeight: 1.75 }}>
            Please set the session from Setting first.
          </div>
        </div>
      </div>
    </div>
  );
}

return (
  <div>
    <style>{ACADEMICS_CSS}</style>
    <div className="page-header">
      <div className="page-title-row">
        <div className="page-title-icon"><i className="fa-solid fa-book-open-reader"></i></div>
        <div>
          <div className="page-title">Academics</div>
          <div className="page-sub">Manage scheme of studies, textbooks, calendars &amp; lesson plans</div>
        </div>
      </div>
      <Tooltip text="Play a short tutorial for the Academics module">
        <button
          className="tutorial-btn page-tutorial-btn"
          onClick={() => setTutorialOpen(true)}
        >
          <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
          <span className="tutorial-label">Tutorial</span>
        </button>
      </Tooltip>
    </div>

    {/* ─── RELEASES FROM HEAD OFFICE ─── */}
    <button className="ho-banner" onClick={() => setReleasesOpen(true)}>
      <div className="ho-banner-icon"><i className="fa-solid fa-cloud-arrow-down"></i></div>
      <div className="ho-banner-text">
        <div className="ho-banner-title">Releases from Head Office <i className="fa-solid fa-arrow-right ho-banner-arrow"></i></div>
        <div className="ho-banner-sub">View academic releases shared by {HO_NAME}.</div>
      </div>
      {hoVisibleReleases().length > 0 && <span className="ho-banner-badge"><i className="fa-solid fa-circle" style={{ fontSize: 6 }}></i> {hoVisibleReleases().length} Live</span>}
    </button>

    {/* ─── LEVEL 1 TABS ─── (View permission ke hisaab se) */}
    <div className="l1-tabs">
      {showSos && (
      <button
        className={`l1-tab${l1 === 'sos' ? ' active' : ''}`}
        onClick={() => setL1('sos')}
      >
        <div className="l1-tab-icon"><i className="fa-solid fa-book"></i></div>
        Scheme of Studies
      </button>
      )}
      {showLp && (
      <button
        className={`l1-tab${l1 === 'lp' ? ' active' : ''}`}
        onClick={() => setL1('lp')}
      >
        <div className="l1-tab-icon"><i className="fa-solid fa-chalkboard-user"></i></div>
        Lesson Plans
      </button>
      )}
      {showRl && (
      <button
        className={`l1-tab${l1 === 'rl' ? ' active' : ''}`}
        onClick={() => setL1('rl')}
      >
        <div className="l1-tab-icon"><i className="fa-solid fa-folder-open"></i></div>
        Resource Library
      </button>
      )}
    </div>

    {l1 === 'sos' ? (
      <>
        {/* ─── LEVEL 2 TABS ─── (View permission ke hisaab se) */}
        <div className="l2-tabs" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {showTextbooks && (
          <button
            className={`l2-tab${l2 === "tb" ? " active" : ""}`}
            onClick={() => { setL2("tb"); getClassesData(); }}
          >
            <div className="l2-tab-dot"></div>
            <i className="fa-solid fa-book-bookmark" style={{ fontSize: 13 }}></i>
            Textbooks
          </button>
          )}
          {showTerms && (
          <button
            className={`l2-tab${l2 === 'terms' ? ' active' : ''}`}
            onClick={() => setL2('terms')}
          >
            <div className="l2-tab-dot"></div>
            <i className="fa-solid fa-list-ol" style={{ fontSize: 13 }}></i> Terms Setting
          </button>
          )}
          {showCal && (
          <button
            className={`l2-tab${l2 === 'cal' ? ' active' : ''}`}
            onClick={() => setL2('cal')}
          >
            <div className="l2-tab-dot"></div>
            <i className="fa-solid fa-calendar-days" style={{ fontSize: 13 }}></i> Calendar
          </button>
          )}
        </div>

        {l2 === 'tb' && (
          <TextBooks onReport={openReport} toast={toast} classesData={classesData} />
        )}

        {l2 === 'terms' && (
          <TermSettings
            termData={termData}
            setTermData={setTermData}
            openConfirm={openConfirm}
            toast={toast}
          />
        )}

        {l2 === 'cal' && (
          <>
            {/* ─── LEVEL 3 TABS ─── (View permission ke hisaab se) */}
            <div className="l3-tabs">
              {showAcadCal && (
              <button
                className={`l3-tab${l3 === 'ac' ? ' active' : ''}`}
                onClick={() => setL3('ac')}
              >
                <div className="l3-tab-icon"><i className="fa-solid fa-calendar-check"></i></div>
                <div className="l3-tab-text">
                  <div className="l3-tab-name">Academic Calendar</div>
                  <div className="l3-tab-desc">Key dates &amp; term schedule</div>
                </div>
              </button>
              )}
              {showActCal && (
              <button
                className={`l3-tab${l3 === 'act' ? ' active' : ''}`}
                onClick={() => setL3('act')}
              >
                <div className="l3-tab-icon"><i className="fa-solid fa-calendar-plus"></i></div>
                <div className="l3-tab-text">
                  <div className="l3-tab-name">Activity Calendar</div>
                  <div className="l3-tab-desc">Events &amp; school activities</div>
                </div>
              </button>
              )}
            </div>
            {l3 === 'ac' && (
              <AcademicCalendar
                terms={terms}
                onReport={openReport}
                onEdit={() => setCalEditOpen(true)}
                isOtherSession={isOtherSession}
              />
            )}
            {l3 === 'act' && (
              <ActivityCalendar
                events={events}
                setEvents={setEvents}
                onReport={openReport}
                onAdd={() => setActivityModal({ open: true, editing: null })}
                onEdit={ev => setActivityModal({ open: true, editing: ev })}
                openConfirm={openConfirm}
                toast={toast}
                isOtherSession={isOtherSession}
                reloadKey={activityReload}
              />
            )}
          </>
        )}
      </>
    ) : l1 === 'lp' ? (
      <LessonPlans toast={toast} openConfirm={openConfirm} />
    ) : (
      <ResourceLibrary toast={toast} openConfirm={openConfirm} classesData={classesData} />
    )}

    {/* ─── MODALS ─── */}
    <ReportPicker
      open={reportPicker.open}
      name={reportPicker.name}
      initialFormat={reportPicker.format}
      onClose={closeReport}
      onGenerate={async (style, fmt) => {
        const subsToUse = reportSubjectsRef.current;
        const scope = reportActivityScopeRef.current; // { events, label } | null
        const nameToUse = reportPicker.name;
        closeReport();
        await generateReportWindow(
          nameToUse,
          style,
          fmt,
          /* Activity report scoped ho to sirf us view/period ke events + label bhejo. */
          { events: scope?.events || events, terms, periodLabel: scope?.label || '' },
          classesData,
          subsToUse
        );
      }}
    />

    <CalEditModal
      open={calEditOpen}
      terms={terms}
      onClose={() => setCalEditOpen(false)}
      onSave={async () => { await loadCalendar(); setCalEditOpen(false); toast('Academic calendar saved!', 'success'); }}
      onError={() => toast('Could not save key dates', 'error')}
      toast={toast}
    />

    <ActivityModal
      open={activityModal.open}
      editing={activityModal.editing}
      toast={toast}
      onClose={() => setActivityModal({ open: false, editing: null })}
      onSave={async ev => {
        if (activityModal.editing) {
          setEvents(prev => prev.map(p => p.id === ev.id ? { ...p, ...ev } : p));
          toast(`"${ev.name}" updated`, 'success');
        } else {
          setEvents(prev => [ev, ...prev]);
          toast(`"${ev.name}" added!`, 'success');
        }
        setActivityModal({ open: false, editing: null });
        // Backend se dobara load karo taake edit/add har view (month-API view bhi) mein reflect ho
        // aur persistence confirm ho — sirf local state update se month-events stale reh jaate the.
        await loadActivities();
        setActivityReload(k => k + 1);
      }}
    />

    <ConfirmDialog cfg={confirmCfg} onClose={closeConfirm} />

    <HeadOfficeReleases
      open={releasesOpen}
      onClose={() => setReleasesOpen(false)}
      toast={toast}
      classesData={classesData}
      addActivity={ev => setEvents(prev => [ev, ...prev])}
    />

       <TutorialModal
      open={tutorialOpen}
      moduleKey="academics"
      onClose={() => setTutorialOpen(false)}
      toast={toast}
    />
  </div>
);
}
  {/* ─── MODALS ─── */}
//       <ReportPicker
//         open={reportPicker.open}
//         name={reportPicker.name}
//         initialFormat={reportPicker.format}
//         onClose={closeReport}
//         onGenerate={async (style, fmt) => {
//           const subsToUse = reportSubjectsRef.current;
//           const nameToUse = reportPicker.name;
//           closeReport();
//           await generateReportWindow(
//             nameToUse,
//             style,
//             fmt,
//             { events, terms },
//             classesData,
//             subsToUse
//           );
//         }}
//       />

//       <CalEditModal
//         open={calEditOpen}
//         terms={terms}
//         onClose={() => setCalEditOpen(false)}
//         onSave={async () => { await loadCalendar(); setCalEditOpen(false); toast('Academic calendar saved!', 'success'); }}
//         onError={() => toast('Could not save key dates', 'error')}
//       />

//       <ActivityModal
//         open={activityModal.open}
//         editing={activityModal.editing}
//         onClose={() => setActivityModal({ open: false, editing: null })}
//         onSave={ev => {
//   if (activityModal.editing) {
//     setEvents(prev => prev.map(p => p.id === ev.id ? { ...p, ...ev } : p));
//     toast(`"${ev.name}" updated`, 'success');
//           } else {
//             setEvents(prev => [ev, ...prev]);
//             toast(`"${ev.name}" added!`, 'success');
//           }
//           setActivityModal({ open: false, editing: null });
         
//         }}
//       />

//       <ConfirmDialog cfg={confirmCfg} onClose={closeConfirm} />

//      <TutorialModal
//         open={tutorialOpen}
//         moduleKey="academics"
//         onClose={() => setTutorialOpen(false)}
//         toast={toast}
//       />
//     </div>
//   );
// }

/* ═══════════════════════════════════════════════════════════════════
   REPORT PICKER MODAL
   ═══════════════════════════════════════════════════════════════════ */
function ReportPicker({ open, name, initialFormat, onClose, onGenerate }) {
  const [style, setStyle] = useState('color');
  const [format, setFormat] = useState('pdf');


  useEffect(() => {
    if (open) {
      setStyle('color');
      setFormat(initialFormat || 'pdf');
    }
  }, [open, initialFormat]);

  const downloadLabel = `Download ${style === 'color' ? 'Colorful' : 'Colorless'} ${format === 'pdf' ? 'PDF' : 'Word'}`;

  /* Keyboard support: arrow-key + space/enter to pick a report style.
     Lets the picker work for radio-style options without losing the
     clickable card affordance. */
  const onStyleKey = (e, value) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setStyle(value); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStyle('color'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStyle('bw'); }
  };

  return (
    <div
      className={`report-picker-overlay${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rp-title"
    >
      <div className="report-picker">
        <div className="rp-header">
          <div className="rp-header-left">
            <div className="rp-header-icon"><i className="fa-solid fa-print"></i></div>
            <div>
              <div className="rp-title" id="rp-title">Download Report</div>
              <div className="rp-sub">{name} — Choose style and format</div>
            </div>
          </div>
          <Tooltip text="Close"><button className="rp-close" onClick={onClose} aria-label="Close download dialog"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="rp-body">
          <div className="rp-section-label" id="rp-style-label">Report Style</div>
          <div className="rp-options" role="radiogroup" aria-labelledby="rp-style-label">
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
                <div className="rp-option-desc">Full brand palette, summary cards, colored headers &amp; icons</div>
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
                <div className="rp-option-desc">Low-ink layout — white background, light borders, no colored blocks</div>
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
          <Tooltip text="Cancel and close">
            <button className="rp-btn cancel" onClick={onClose}>Cancel</button>
          </Tooltip>
          <Tooltip text="Generate and download the selected report">
            <button className="rp-btn go" onClick={() => onGenerate(style, format)}>
              <i className="fa-solid fa-download"></i>
              <span>{downloadLabel}</span>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONFIRM DIALOG
   ═══════════════════════════════════════════════════════════════════ */
function ConfirmDialog({ cfg, onClose }) {
  if (!cfg) return null;
  const {
    title, message, hint,
    confirmLabel = 'Confirm', confirmStyle = 'danger',
    icon = 'fa-trash', iconBg = 'rgba(220,38,38,.1)', iconColor = '#DC2626',
    onConfirm,
  } = cfg;
  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="confirm-dialog">
        <div className="confirm-glow" style={confirmStyle === 'danger'
          ? { background: 'linear-gradient(90deg,#EF4444,#DC2626,#EF4444)' }
          : { background: 'linear-gradient(90deg,#1E3A8A,#1E40AF,#1E3A8A)' }} />
        <div className="confirm-hero">
          <div className="confirm-ring">
            <div className="confirm-icon-wrap" style={{ background: iconBg, color: iconColor }}>
              <i className={`fa-solid ${icon}`}></i>
            </div>
          </div>
        </div>
        <div className="confirm-body">
          <div className="confirm-title">{title}</div>
          <div className="confirm-msg" dangerouslySetInnerHTML={{ __html: message }} />
          {hint && (
            <div className="confirm-hint">
              <i className="fa-solid fa-triangle-exclamation"></i>
              <span>{hint}</span>
            </div>
          )}
        </div>
        <div className="confirm-footer">
          <button className="confirm-btn confirm-btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className={`confirm-btn confirm-btn--confirm${confirmStyle === 'primary' ? ' primary-style' : ''}`}
            onClick={() => { onConfirm && onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════
   NO SESSION MODAL
   ═══════════════════════════════════════════════════════════════════ */
function NoSessionModal({ open, onClose, onGoToSettings }) {
  if (!open) return null;
  return (
    <div
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div 
        style={{ 
          maxWidth: 400,
          width: '100%',
          background: '#FFFFFF',
          borderRadius: '24px',
          border: '1px solid #E5E7EB',
          boxShadow: '0 30px 80px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          position: 'relative',
          animation: 'confirmIn .32s cubic-bezier(.34,1.3,.64,1) both'
        }}
      >
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: '3px', 
          background: 'linear-gradient(90deg,#D97706,#B45309,#D97706)'
        }} />
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '32px 28px 10px',
          background: 'linear-gradient(180deg,rgba(217,119,6,.03),transparent)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '18px',
            background: 'rgba(217,119,6,.1)',
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 8px 24px rgba(217,119,6,.2)'
          }}>
            <i className="fa-solid fa-calendar-xmark"></i>
          </div>
        </div>
        
        <div style={{
          padding: '16px 28px 8px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#111827',
            marginBottom: '10px',
            letterSpacing: '-.02em'
          }}>
            No active session found
          </div>
          <div style={{
            fontSize: '13.5px',
            color: '#6B7280',
            lineHeight: 1.75,
            marginBottom: '14px'
          }}>
            This branch has no active academic session.<br />
            Set one up in <strong style={{ color: '#111827', fontWeight: 700 }}>Session Settings</strong> before using Academics.
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '20px 28px 28px'
        }}>
          <button
            onClick={onClose}
            style={{
              minWidth: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '46px',
              borderRadius: '12px',
              border: '1.5px solid #E5E7EB',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 700,
              background: '#F3F4F6',
              color: '#6B7280',
              transition: 'all .2s cubic-bezier(.4,0,.2,1)',
              letterSpacing: '.01em'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#FFFFFF';
              e.currentTarget.style.color = '#111827';
              e.currentTarget.style.borderColor = '#9CA3AF';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#F3F4F6';
              e.currentTarget.style.color = '#6B7280';
              e.currentTarget.style.borderColor = '#E5E7EB';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CAL EDIT MODAL — edit Academic Calendar key-date entries per term
   ═══════════════════════════════════════════════════════════════════ */
function CalEditModal({ open, terms, onClose, onSave, onError, toast }) {
  const [draft, setDraft] = useState([]);
  /* Snapshot of saved key dates by id → lets save() diff into insert/update/delete. */
  const [orig, setOrig] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(terms.map(t => ({ id: t.id, label: t.label, entries: t.entries.map(e => ({ ...e })) })));
    const snap = {};
    terms.forEach(t => t.entries.forEach(e => {
      if (e.id) snap[e.id] = { heading: e.heading, date: e.date, termId: t.id };
    }));
    setOrig(snap);
  }, [open, terms]);

  const updateEntry = (ti, ei, key, value) => {
    setDraft(prev => prev.map((t, idx) =>
      idx !== ti ? t : { ...t, entries: t.entries.map((e, j) => j === ei ? { ...e, [key]: value } : e) }
    ));
  };
  const addEntry = ti => {
    setDraft(prev => prev.map((t, idx) =>
      idx !== ti ? t : { ...t, entries: [...t.entries, { heading: '', date: '' }] }
    ));
  };
  const removeEntry = (ti, ei) => {
    setDraft(prev => prev.map((t, idx) =>
      idx !== ti ? t : { ...t, entries: t.entries.filter((_, j) => j !== ei) }
    ));
  };

  /* Diff the draft against the original snapshot and fire one keydatescrud call
     per change: new rows → insert, edited rows → update, removed rows → delete. */
  const save = async () => {
    /* Session-date guard: har key-date current session ki UTC window ke andar ho —
       bahar ho to toaster (session range ke saath) + save block. */
    for (const term of draft) {
      for (const e of (term.entries || [])) {
        const value = (e.date || '').trim();
        if (!value) continue;
        const chk = validateSessionDateFromStorage(value, e.heading ? `"${e.heading.trim()}" date` : 'key date');
        if (!chk.ok) { (toast || window.alert)(chk.message, 'error'); return; }
      }
    }
    setSaving(true);
    try {
      const ops = [];
      const present = new Set();
      draft.forEach(term => term.entries.forEach(e => {
        if (e.id) present.add(e.id);
        if (term.id == null) return; // skip rows whose term has no backend id
        const head = (e.heading || '').trim();
        const value = (e.date || '').trim();
        if (!head && !value) return;
        if (e.id) {
          const o = orig[e.id];
          if (!o || o.heading !== e.heading || o.date !== e.date) {
            ops.push(keyDatesCrud({ id: e.id, branchID: termsBranchID(), terms: String(term.id), head, value, action: 'update' }));
          }
        } else {
          ops.push(keyDatesCrud({ id: 0, branchID: termsBranchID(), terms: String(term.id), head, value, action: 'insert' }));
        }
      }));
      Object.keys(orig).forEach(idStr => {
        const id = Number(idStr);
        if (!present.has(id)) {
          ops.push(keyDatesCrud({ id, branchID: termsBranchID(), terms: String(orig[idStr].termId), head: '', value: '', action: 'delete' }));
        }
      });
      await Promise.all(ops);
      onSave();
    } catch (e) {
      console.error('Error saving key dates:', e);
      onError && onError();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-md" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <i className="fa-solid fa-calendar-pen" style={{ marginRight: 8 }}></i>
              Update Academic Calendar
            </div>
            <div className="modal-sub">Edit key dates for each term</div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="modal-body">
          <div style={{
            background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)', color: '#fff',
            borderRadius: 'var(--radius-md)', padding: '11px 16px', textAlign: 'center',
            fontSize: 14, fontWeight: 700, marginBottom: 20, letterSpacing: '.01em',
          }}>
            <i className="fa-solid fa-calendar-check" style={{ marginRight: 8 }}></i>Key Dates
          </div>

          {draft.map((term, ti) => (
            <div key={ti} className="cal-modal-section">
              <div className="cal-modal-term">{term.label}</div>
              <div style={{
                background: 'var(--bg-muted)',
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                padding: '8px 10px',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Heading/Event</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Date/Details</div>
                  <div style={{ width: 70 }}></div>
                </div>
              </div>
              <div style={{
                border: '1px solid var(--border-light)', borderTop: 'none',
                borderRadius: '0 0 var(--radius-sm) var(--radius-sm)', padding: '0 10px',
              }}>
                {term.entries.length === 0 ? (
                  <div className="no-data" style={{ padding: '12px 0' }}>No data</div>
                ) : term.entries.map((e, ei) => (
                  <div key={ei} className="cal-entry-row">
                    <input
                      className="cal-entry-input"
                      value={e.heading}
                      placeholder="Heading/Event"
                      onChange={ev => updateEntry(ti, ei, 'heading', ev.target.value)}
                    />
                    <input
                      className="cal-entry-input"
                      value={e.date}
                      placeholder="Date/Details"
                      onChange={ev => updateEntry(ti, ei, 'date', ev.target.value)}
                    />
                    <Tooltip text="Remove this entry">
                      <button className="remove-btn" onClick={() => removeEntry(ti, ei)}>
                        <i className="fa-solid fa-xmark"></i> Remove
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
              <Tooltip text="Add another entry to this term">
                <button className="add-more-btn" onClick={() => addEntry(ti)}>
                  <i className="fa-solid fa-plus"></i> Add More
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <Tooltip text="Discard changes and close">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Save the academic calendar key dates">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> {saving ? 'Saving…' : 'Save'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY MODAL — add / edit a single activity
   ═══════════════════════════════════════════════════════════════════ */
function ActivityModal({ open, editing, onClose, onSave, toast }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [purpose, setPurpose] = useState('');
  const [development, setDevelopment] = useState('');
  const [resource, setResource] = useState('');
   const [saving, setSaving] = useState(false); // for save new activity

  useEffect(() => {
  if (!open) return;

  const toInputDate = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d)) return '';
    return d.toISOString().slice(0, 10);
  };

  setName(editing?.name || '');
  setPurpose(editing?.purpose || '');
  setDevelopment(editing?.development || '');
  setResource(editing?.resource || '');
  setStart(toInputDate(editing?.rawStart || editing?.start));
  setEnd(toInputDate(editing?.rawEnd || editing?.end));
}, [open, editing]);

  const fmt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  const colors = ['#1E40AF', '#16A34A', '#D97706', '#7C3AED', '#1E40AF', '#E11D48'];

  const submit = async () => {
  if (!name.trim()) return;
  if (!start || !end) return;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate > endDate) {
    alert('Start date cannot be after end date.');
    return;
  }

  /* Session-date guard: activity start & end current session ki UTC window ke andar hon —
     bahar ho to toaster (session range ke saath) + block. */
  const startChk = validateSessionDateFromStorage(start, 'start date');
  if (!startChk.ok) { (toast || window.alert)(startChk.message, 'error'); return; }
  const endChk = validateSessionDateFromStorage(end, 'end date');
  if (!endChk.ok) { (toast || window.alert)(endChk.message, 'error'); return; }

  // Update ke liye real backend id chahiye. Fake/oversized id (Date.now() fallback ~1.7e12)
  // backend ke Int32 me fit nahi hota → "One or more validation errors occurred". Aise me
  // list refresh karke real id lena zaroori hai.
  const editId = editing ? Number(editing.id) : 0;
  if (editing && (!Number.isInteger(editId) || editId <= 0 || editId > 2147483647)) {
    (toast || window.alert)('Please refresh the activity list, then edit again.', 'error');
    return;
  }

  setSaving(true);

  try {
    const startIso = startDate.toISOString();
    const endIso = endDate.toISOString();

    const payload = {
      id: editId,
      branchID: Number(sessionStorage.getItem('branchID')) || 0,
      sessionYearID: Number(
        sessionStorage.getItem('changeSessionId') ||
        sessionStorage.getItem('SessionID') ||
        sessionStorage.getItem('sessionID') || 0
      ),
      name: name.trim(),
      activityPurpose: purpose || 'string',
      activityDevelopment: development || 'string',
      resourseMaterial: resource || 'string',
      startAt: startIso,
      endAt: endIso,
      createdDate: new Date().toISOString(),
      action: editing ? 'update' : 'insert',
    };

    assertSessionPayload(payload); // block when no session is selected (toasts via registered callback)

    const res = await fetch(buildUrl('/api/activitycalendarcrud'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        Authorization: `bearer ${sessionStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = (json && (json.message || json.title)) ||
        (json?.errors ? 'One or more validation errors occurred.' : '') ||
        `Save failed: ${res.status}`;
      throw new Error(msg);
    }

    onSave({
      id: editId || json?.id || json?.data?.id || Date.now(),
      name: name.trim(),
      start: fmt(start),
      end: fmt(end),
      rawStart: startIso,
      rawEnd: endIso,
      color: editing?.color || colors[Math.floor(Math.random() * colors.length)],
      status: actComputeStatus(startIso, endIso),
      purpose,
      development,
      resource,
    });
  } catch (e) {
    console.error('Error saving activity:', e);
    (toast || window.alert)(e.message || 'Could not save activity', 'error');
  } finally {
    setSaving(false);
  }
};
  return (
    <div
      className={`modal-overlay${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <i className={`fa-solid ${editing ? 'fa-pen' : 'fa-calendar-plus'}`} style={{ marginRight: 8 }}></i>
              {editing ? 'Edit Activity' : 'Add new activity'}
            </div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Name <span className="req-star">*</span></label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" />
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Start at <span className="req-star">*</span></label>
              <input className="form-input" type="date" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">End at <span className="req-star">*</span></label>
              <input className="form-input" type="date" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Activity purpose</label>
            <textarea className="form-input" style={{ height: 'auto', padding: 12, minHeight: 70, resize: 'vertical' }} value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Describe the purpose of this activity..." />
          </div>
          <div className="form-group">
            <label className="form-label">Activity development</label>
            <textarea className="form-input" style={{ height: 'auto', padding: 12, minHeight: 70, resize: 'vertical' }} value={development} onChange={e => setDevelopment(e.target.value)} placeholder="How will the activity be developed?" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Resource material</label>
            <textarea className="form-input" style={{ height: 'auto', padding: 12, minHeight: 70, resize: 'vertical' }} value={resource} onChange={e => setResource(e.target.value)} placeholder="List any resources or materials needed..." />
          </div>
        </div>
        <div className="modal-footer">
          <Tooltip text="Discard changes and close">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </Tooltip>
          <Tooltip text="Save the activity">
            <button className="btn btn-primary" onClick={submit}>
              <i className="fa-solid fa-check"></i> Save
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REPORT GENERATOR (opens print-ready HTML in a new window)
   ═══════════════════════════════════════════════════════════════════ */
async function generateReportWindow(name, style, format, ctx, classesData, subjectsForReport = null) {
  // ── Fetch report header ──
  let schoolName      = 'School Mentor ERP';
  let schoolAddress   = '';
  let academicSession = '';
  let branchLogoUrl   = null;

  try {
    const branchID = sessionStorage.getItem('branchID') || 1;
    const res = await fetch(
      buildUrl(`/report-header/${branchID}`),
      { method: 'GET', headers: { Accept: '*/*' } }
    );
    const json = await res.json();
    if (json.success && json.data) {
      schoolName      = json.data.branchName      || schoolName;
      schoolAddress   = json.data.address         || '';
      academicSession = json.data.academicSession || '';
      branchLogoUrl   = resolveMediaUrl(json.data.branchLogo) || null;
    }
  } catch (e) {
    console.error('Error fetching report header:', e);
  }

  const isColor = style === 'color';
  /* ── Two coordinated palettes ──
     • Colorful: brand blue header, light-blue table headers, alt-row stripes, status chips.
     • Colorless: white header, dark-gray text, no row fills, status chips become bordered text
       pills. No emoji icons in body headings. This is the dedicated low-ink layout. */
  const headerBg     = isColor ? '#1E3A8A' : '#FFFFFF';
  const headerFg     = isColor ? '#FFFFFF' : '#111111';
  const headerSubFg  = isColor ? 'rgba(255,255,255,.75)' : '#4B5563';
  const headerKick   = isColor ? 'rgba(255,255,255,.55)' : '#6B7280';
  const headerDivCol = isColor ? 'rgba(255,255,255,.2)'  : '#E5E7EB';
  const chipBg       = isColor ? 'rgba(255,255,255,.14)' : 'transparent';
  const chipBorder   = isColor ? 'transparent' : '#D1D5DB';
  const accent       = isColor ? '#1E40AF' : '#374151';
  const textD        = isColor ? '#0F172A' : '#111111';
  const textM        = isColor ? '#64748B' : '#4B5563';
  const border       = isColor ? '#BFDBFE' : '#D1D5DB';
  const tableHeadBg  = isColor ? '#EFF6FF' : '#FFFFFF';
  const tableHeadFg  = textD;
  const rowAltBg     = isColor ? '#F8FAFF' : '#FFFFFF';      // no alternating fill in colorless
  const rowBaseBg    = '#FFFFFF';
  const sectionAccent = isColor ? `border-left:3px solid ${accent};padding-left:10px` : `border-bottom:1px solid ${border};padding:0 0 6px`;
  const styleLabel    = isColor ? 'Colorful' : 'Colorless';
  /* Drop emoji icons in colorless to save ink and avoid font-substitution glyphs. */
  const ico = (emoji) => isColor ? `${emoji} ` : '';

  const textbookSubjects = Array.isArray(subjectsForReport) ? subjectsForReport : null;
  const isTextbookReport = textbookSubjects !== null;
  /* Whole-calendar reports are triggered ONLY by the exact calendar-download buttons
     ('Academic Calendar' / 'Activity Calendar'). Individual activity downloads pass the
     activity's own name (ev.name) — jo bhi ho, wo neeche single-activity branch mein jaye,
     chahe uske naam mein "Activity"/"Academic" word ho. (Pehle .includes() se collide ho raha tha.) */
  const isAcademic = name === 'Academic Calendar';
  const isActivity = name === 'Activity Calendar';
  /* Activity report ka current-view period (Month/Week/Day/Year) — header title me dikhega. */
  const periodLabel = ctx?.periodLabel || '';
  const displayTitle = (isActivity && periodLabel) ? `${name} — ${periodLabel}` : name;

  /* Status pill — colored fill in Colorful; bordered text-only pill in Colorless. */
  const statusPill = (s) => {
    const label = s[0].toUpperCase() + s.slice(1);
    if (isColor) {
      const bg = s === 'completed' ? 'rgba(22,163,74,.1)' : s === 'ongoing' ? 'rgba(217,119,6,.1)' : 'rgba(30,58,138,.1)';
      const fg = s === 'completed' ? '#16A34A'           : s === 'ongoing' ? '#D97706'           : '#1E40AF';
      return `<span style="background:${bg};color:${fg};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${label}</span>`;
    }
    return `<span style="border:1px solid ${border};color:${textD};padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700">${label}</span>`;
  };

  let body = '';
  if (isTextbookReport) {
    body = `<h2 style="font-size:16px;font-weight:700;color:${textD};margin:0 0 16px;border-bottom:${isColor ? '2px' : '1px'} solid ${border};padding-bottom:8px">${ico('📚')}Subjects &amp; Textbooks — ${name}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:${tableHeadBg}">
        <th style="padding:10px 12px;text-align:left;border:1px solid ${border};font-weight:700;color:${tableHeadFg}">#</th>
        <th style="padding:10px 12px;text-align:left;border:1px solid ${border};font-weight:700;color:${tableHeadFg}">Subject</th>
        <th style="padding:10px 12px;text-align:left;border:1px solid ${border};font-weight:700;color:${tableHeadFg}">Textbook</th>
      </tr></thead>
      <tbody>${textbookSubjects.length > 0 ? textbookSubjects.map((s, i) => `
        <tr style="background:${i % 2 === 0 ? rowBaseBg : rowAltBg}">
          <td style="padding:9px 12px;border:1px solid ${border};color:${textM}">${i + 1}</td>
          <td style="padding:9px 12px;border:1px solid ${border};color:${textD};font-weight:600">${s.name}</td>
          <td style="padding:9px 12px;border:1px solid ${border};color:${textM}">${s.book || '—'}</td>
        </tr>`).join('') : `
        <tr>
          <td colspan="3" style="padding:18px 12px;border:1px solid ${border};color:${textM};text-align:center;font-style:italic">No subjects found</td>
        </tr>`}
      </tbody></table>`;
  } else if (isAcademic) {
    body = ctx.terms.map(t => `<div style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;color:${isColor ? accent : textD};${sectionAccent};margin:0 0 10px">${t.label}</h3>
      ${t.entries.length === 0
        ? `<p style="color:${textM};font-size:12px;font-style:italic">No dates added</p>`
        : `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr style="background:${tableHeadBg}">
              <th style="padding:8px 12px;border:1px solid ${border};text-align:left;color:${tableHeadFg}">Heading/Event</th>
              <th style="padding:8px 12px;border:1px solid ${border};text-align:left;color:${tableHeadFg}">Date/Details</th>
            </tr></thead>
            <tbody>${t.entries.map((e, i) => `
              <tr style="background:${i % 2 === 0 ? rowBaseBg : rowAltBg}">
                <td style="padding:8px 12px;border:1px solid ${border};color:${textD};font-weight:600">${e.heading}</td>
                <td style="padding:8px 12px;border:1px solid ${border};color:${textM}">${e.date}</td>
              </tr>`).join('')}
            </tbody></table>`}
    </div>`).join('');
  } else if (isActivity) {
    body = `<h2 style="font-size:16px;font-weight:700;color:${textD};margin:0 0 16px;border-bottom:${isColor ? '2px' : '1px'} solid ${border};padding-bottom:8px">${ico('🗓')}Scheduled Activities</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="background:${tableHeadBg}">
        <th style="padding:9px 12px;border:1px solid ${border};text-align:left;color:${tableHeadFg}">#</th>
        <th style="padding:9px 12px;border:1px solid ${border};text-align:left;color:${tableHeadFg}">Activity</th>
        <th style="padding:9px 12px;border:1px solid ${border};text-align:left;color:${tableHeadFg}">Start</th>
        <th style="padding:9px 12px;border:1px solid ${border};text-align:left;color:${tableHeadFg}">End</th>
        <th style="padding:9px 12px;border:1px solid ${border};text-align:left;color:${tableHeadFg}">Status</th>
      </tr></thead>
      <tbody>${ctx.events.map((ev, i) => `
        <tr style="background:${i % 2 === 0 ? rowBaseBg : rowAltBg}">
          <td style="padding:9px 12px;border:1px solid ${border};color:${textM}">${i + 1}</td>
          <td style="padding:9px 12px;border:1px solid ${border};color:${textD};font-weight:600">${ev.name}</td>
          <td style="padding:9px 12px;border:1px solid ${border};color:${textM}">${ev.start}</td>
          <td style="padding:9px 12px;border:1px solid ${border};color:${textM}">${ev.end}</td>
          <td style="padding:9px 12px;border:1px solid ${border}">${statusPill(ev.status)}</td>
        </tr>`).join('')}
      </tbody></table>`;
  } else {
    const ev = ctx.events.find(e => e.name === name);
    if (ev) {
      body = `<div style="background:${isColor ? '#EFF6FF' : '#FFFFFF'};border:1px solid ${border};border-radius:8px;padding:16px;margin-bottom:20px">
        <div style="font-size:11px;color:${textM};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Activity</div>
        <div style="font-size:18px;font-weight:800;color:${textD}">${ev.name}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
        <tr><td style="padding:10px 12px;border:1px solid ${border};font-weight:700;color:${textD};width:35%">Start Date</td><td style="padding:10px 12px;border:1px solid ${border};color:${textM}">${ev.start}</td></tr>
        <tr style="background:${rowAltBg}"><td style="padding:10px 12px;border:1px solid ${border};font-weight:700;color:${textD}">End Date</td><td style="padding:10px 12px;border:1px solid ${border};color:${textM}">${ev.end}</td></tr>
        <tr><td style="padding:10px 12px;border:1px solid ${border};font-weight:700;color:${textD}">Status</td><td style="padding:10px 12px;border:1px solid ${border};color:${textM}">${ev.status}</td></tr>
      </table>
      ${ev.purpose ? `<h3 style="font-size:13px;font-weight:700;color:${textD};margin:0 0 8px">Purpose</h3><p style="font-size:13px;color:${textM};line-height:1.7;margin:0 0 16px">${ev.purpose}</p>` : ''}
      ${ev.development ? `<h3 style="font-size:13px;font-weight:700;color:${textD};margin:0 0 8px">Development</h3><p style="font-size:13px;color:${textM};line-height:1.7;margin:0 0 16px">${ev.development}</p>` : ''}
      ${ev.resource ? `<h3 style="font-size:13px;font-weight:700;color:${textD};margin:0 0 8px">Resources</h3><p style="font-size:13px;color:${textM};line-height:1.7;margin:0">${ev.resource}</p>` : ''}`;
    }
  }

  /* Logo: monochrome dark-gray glyph in colorless to keep the school identity
     while avoiding gradients & accent fills. */
// ── Logo: real image if available, else fallback SVG ──
  const uid = Date.now();
  const logoSvg = branchLogoUrl
    ? `<img src="${branchLogoUrl}" width="64" height="64"
        style="border-radius:16px;object-fit:cover;display:block;
        ${isColor ? 'box-shadow:0 4px 18px rgba(0,0,0,.35),0 0 0 2px rgba(255,255,255,.15)' : 'border:1.5px solid #E5E7EB'}"
        onerror="this.style.display='none'" />`
    : isColor
      ? `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="lg${uid}" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stop-color="#1a237e"/><stop offset="1" stop-color="#283593"/></linearGradient></defs>
          <rect width="64" height="64" rx="16" fill="url(#lg${uid})"/>
          <path d="M32 18C25.5 18 18 20.2 18 20.2L18 46C18 46 25.5 43.8 32 43.8C38.5 43.8 46 46 46 46L46 20.2C46 20.2 38.5 18 32 18Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
          <path d="M32 18L32 43.8" stroke="rgba(255,255,255,0.5)" stroke-width="1.2"/>
          <path d="M23 17L26 11L32 15L38 11L41 17" stroke="#FCD34D" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <text x="32" y="38" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="900" fill="rgba(255,255,255,0.9)">SM</text>
        </svg>`
      : `<svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="62" height="62" rx="12" fill="#FFFFFF" stroke="#1F2937" stroke-width="1.5"/>
          <path d="M32 18C25.5 18 18 20.2 18 20.2L18 46C18 46 25.5 43.8 32 43.8C38.5 43.8 46 46 46 46L46 20.2C46 20.2 38.5 18 32 18Z" fill="none" stroke="#1F2937" stroke-width="1.3"/>
          <path d="M32 18L32 43.8" stroke="#1F2937" stroke-width="1.3"/>
          <text x="32" y="36" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="800" fill="#1F2937">SM</text>
        </svg>`;
  /* Header markup — Colorful retains the decorative shapes; Colorless renders a
     clean printable header with no large fills. */
  const headerBlock = isColor
    ? `<div style="background:${headerBg};padding:24px 32px 28px;color:${headerFg};position:relative;overflow:hidden">
        <div style="position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
        <div style="position:absolute;bottom:-20px;left:120px;width:80px;height:80px;border-radius:50%;background:rgba(14,165,233,.15)"></div>
        <div style="display:flex;align-items:center;gap:18px;position:relative;z-index:2">
          <div style="width:64px;height:64px;border-radius:16px;overflow:hidden;flex-shrink:0;box-shadow:0 4px 18px rgba(0,0,0,.35),0 0 0 2px rgba(255,255,255,.15)">${logoSvg}</div>
          <div>
            <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:${headerKick};font-weight:700;margin-bottom:3px">School Mentor ERP</div>
            <div style="font-size:20px;font-weight:800;color:${headerFg};letter-spacing:-.02em;line-height:1.2;text-shadow:0 1px 4px rgba(0,0,0,.2)">${schoolName}</div>
          </div>
        </div>
        <div style="height:1px;background:${headerDivCol};margin:18px 0 16px;position:relative;z-index:2"></div>
        <div style="font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px">${displayTitle}</div>
       <div style="font-size:13px;color:${headerSubFg};margin-bottom:16px">${academicSession ? `Academic Year ${academicSession}` : 'Academic Year 2026–2027'} · ${styleLabel} Report</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="background:${chipBg};border:1px solid ${chipBorder};padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div style="background:${chipBg};border:1px solid ${chipBorder};padding:6px 14px;border-radius:20px;font-size:11.5px"><strong>Format:</strong> ${format.toUpperCase()}</div>
        </div>
      </div>`
    : `<div style="background:${headerBg};padding:22px 32px 22px;color:${headerFg};border-bottom:1px solid ${border}">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;flex-shrink:0">${logoSvg}</div>
          <div>
            <div style="font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:${headerKick};font-weight:700;margin-bottom:3px">School Mentor ERP</div>
            <div style="font-size:19px;font-weight:800;color:${headerFg};letter-spacing:-.02em;line-height:1.2">${schoolName}</div>
          </div>
        </div>
        <div style="height:1px;background:${headerDivCol};margin:16px 0 14px"></div>
        <div style="font-size:21px;font-weight:800;letter-spacing:-.02em;margin-bottom:3px;color:${headerFg}">${displayTitle}</div>
        <div style="font-size:12.5px;color:${headerSubFg};margin-bottom:14px">${academicSession ? `Academic Year ${academicSession}` : 'Academic Year 2026–2027'} · ${styleLabel} Report (low-ink)</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div style="background:${chipBg};border:1px solid ${chipBorder};padding:5px 12px;border-radius:20px;font-size:11px;color:${textD}"><strong>Generated:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          <div style="background:${chipBg};border:1px solid ${chipBorder};padding:5px 12px;border-radius:20px;font-size:11px;color:${textD}"><strong>Format:</strong> ${format.toUpperCase()}</div>
        </div>
      </div>`;

  /* Print/Close buttons — kept legible in both styles; Colorless avoids large filled blocks. */
  const printBtnStyle = isColor
    ? `background:${headerBg};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px`
    : `background:#FFFFFF;color:#111;border:1.5px solid #111;padding:11px 26px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px`;
  const closeBtnStyle = `background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer`;
  const toolbarBg     = isColor ? '#F8FAFC' : '#FFFFFF';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${name} — Report</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:${textD};font-size:13px}.page{width:210mm;margin:0 auto}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}@page{size:A4;margin:15mm}}</style>
  </head><body><div class="page">
    ${headerBlock}
    <div style="padding:28px 32px">${body}</div>
    <div style="border-top:1px solid ${border};padding:14px 32px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:${textM}">
      <span>${schoolName}${schoolAddress ? ` · ${schoolAddress}` : ''}</span>
      <span>School Mentor ERP © ${new Date().getFullYear()}</span>
      <span>Page 1 of 1</span>
    </div>
    <div class="no-print" style="text-align:center;padding:22px;background:${toolbarBg};border-top:1px solid #E2E8F0">
      <button onclick="window.print()" style="${printBtnStyle}">${isColor ? '🖨 ' : ''}Print / Save as PDF</button>
      <button onclick="window.close()" style="${closeBtnStyle}">Close</button>
    </div>
  </div></body></html>`;
  deliverReport(name, format, html);
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY CALENDAR PANEL — stats, calendar views, events panel
   ═══════════════════════════════════════════════════════════════════ */
function ActivityCalendar({ events, setEvents, onReport, onAdd, onEdit, openConfirm, toast, isOtherSession, reloadKey }) {
  const { can } = usePermissions();
  const canActCreate   = can('Academics', 'Activity Calendar', 'Create');
  const canActEdit     = can('Academics', 'Activity Calendar', 'Edit');
  const canActDelete   = can('Academics', 'Activity Calendar', 'Delete');
  const canActDownload = can('Academics', 'Activity Calendar', 'Download');
  const today = useMemo(() => new Date(), []);
  const [calYear,  setCalYear]  = useState(today.getFullYear());
const [calMonth, setCalMonth] = useState(today.getMonth()); // current month
  const [view, setView] = useState('Month');
  const [weekOffset, setWeekOffset] = useState(0); // Week view ka anchor (lifted — report scope ke liye)
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [monthApiEnabled, setMonthApiEnabled] = useState(false);
  const [monthEvents, setMonthEvents] = useState([]);
 const displayEvents = monthApiEnabled
  ? [...monthEvents, ...events.filter(ev =>
      !monthEvents.some(me => me.id === ev.id)
    )]
  : events;
  /* List view visible month (calYear/calMonth) tak scoped hona chahiye — warna August mein
     July wali activity bhi dikh jaati hai. Activity ko month mein tab count karo jab uski
     date-range us month se overlap kare (start <= monthEnd && end >= monthStart). */
  const monthScopedEvents = useMemo(() => {
    const mStart = new Date(calYear, calMonth, 1, 0, 0, 0);
    const mEnd   = new Date(calYear, calMonth + 1, 0, 23, 59, 59);
    return displayEvents.filter(ev => {
      const s = new Date(ev.rawStart || ev.start);
      const e = new Date(ev.rawEnd || ev.end || ev.rawStart || ev.start);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return true; // date parse na ho to safety mein dikha do
      return s <= mEnd && e >= mStart;
    });
  }, [displayEvents, calYear, calMonth]);

  /* Whole-activity report ko CURRENT VIEW ke period tak scope karo:
       Month → us month ki, Week → us week ki, Day → aaj ki, Year → us saal ki, List → month ki.
     Activity period me tab aati hai jab uski date-range us range se overlap kare. */
  const getReportScope = () => {
    const evs = events; // poora dataset (backend se) — Year/Week bhi doosre months tak sahi rahe
    const overlaps = (ev, start, end) => {
      const s = new Date(ev.rawStart || ev.start);
      const e = new Date(ev.rawEnd || ev.end || ev.rawStart || ev.start);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return true;
      return s <= end && e >= start;
    };
    const dOnly = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const monthName = new Date(calYear, calMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (view === 'Year') {
      const start = new Date(calYear, 0, 1, 0, 0, 0);
      const end   = new Date(calYear, 11, 31, 23, 59, 59);
      return { events: evs.filter(ev => overlaps(ev, start, end)), label: `Year ${calYear}` };
    }
    if (view === 'Day') {
      const t = new Date();
      const start = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 0, 0, 0);
      const end   = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59);
      return { events: evs.filter(ev => overlaps(ev, start, end)), label: t.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) };
    }
    if (view === 'Week') {
      // WeekView jaisa hi anchor: mahine ki 1 tareekh se weekOffset*7 din aage.
      const start = new Date(calYear, calMonth, 1);
      start.setDate(1 + weekOffset * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 0);
      return { events: evs.filter(ev => overlaps(ev, start, end)), label: `Week: ${dOnly(start)} – ${dOnly(end)}` };
    }
    // Month + List → current month
    const start = new Date(calYear, calMonth, 1, 0, 0, 0);
    const end   = new Date(calYear, calMonth + 1, 0, 23, 59, 59);
    return { events: evs.filter(ev => overlaps(ev, start, end)), label: monthName };
  };
  /* Month/year badalne par Week anchor ko us month ke pehle week par reset karo. */
  useEffect(() => { setWeekOffset(0); }, [calMonth, calYear]);

  /* Jab visible month/year badle, us month ki activities backend se laao. */
 useEffect(() => {
  if (!monthApiEnabled) return;

  (async () => {
    try {
      const rows = await getActivityByMonth(calMonth + 1);
      setMonthEvents(rows.map(mapActivity));
    } catch (e) {
      console.error('Error loading month activities:', e);
    }
  })();
}, [calMonth, calYear, monthApiEnabled, reloadKey]);

  /* 3-dot dropdown — uses fixed positioning so it can never clip behind other cards */
  const [dropdown, setDropdown] = useState({ id: null, x: 0, y: 0 });
  const closeDropdown = () => setDropdown({ id: null, x: 0, y: 0 });

  useEffect(() => {
    if (dropdown.id == null) return;
    const h = () => closeDropdown();
    window.addEventListener('click', h);
    window.addEventListener('scroll', h, true);
    window.addEventListener('resize', h);
    return () => {
      window.removeEventListener('click', h);
      window.removeEventListener('scroll', h, true);
      window.removeEventListener('resize', h);
    };
  }, [dropdown.id]);

  const openMenu = (e, ev) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setDropdown({
      id: dropdown.id === ev.id ? null : ev.id,
      x: r.right - 150,
      y: r.bottom + 4,
    });
  };

  /* Stats */
  const stats = useMemo(() => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1);
    const me = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);
    return {
      total:     events.length,
      upcoming:  events.filter(e => e.status === 'upcoming').length,
      thisMonth: events.filter(e => {
        const s = new Date(e.start), en = new Date(e.end);
        return !isNaN(s) && !isNaN(en) && s <= me && en >= ms;
      }).length,
      completed: events.filter(e => e.status === 'completed').length,
    };
  }, [events]);

  /* Filtered + searched event list */
  const filteredEvents = useMemo(() => {
    const q = search.toLowerCase();
    return events.filter(ev => {
      const mf = filter === 'all' || ev.status === filter;
      const ms = !q || ev.name.toLowerCase().includes(q) || ev.start.toLowerCase().includes(q);
      return mf && ms;
    });
    //for showing activity name on calender
  }, [events, search, filter]);
  const toDayKey = (value) => {
  const d = new Date(value);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

  /* Events on a given day */
 const eventsOnDay = (y, m, d) => {
  console.log('eventsOnDay called:', y, m, d, 'events count:', displayEvents.length);
  return displayEvents.filter(ev => {
    const rawS = ev.rawStart || ev.start;
    const rawE = ev.rawEnd || ev.end || rawS;

    if (!rawS) return false;

    // Extract date parts directly from ISO string (ignore time/timezone)
    const getDateParts = (str) => {
      const match = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return null;
      return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
    };

    const s = getDateParts(rawS);
    const e = getDateParts(rawE || rawS);
    if (!s || !e) return false;

    const sTime = new Date(s.y, s.m, s.d).getTime();
    const eTime = new Date(e.y, e.m, e.d).getTime();
    const cTime = new Date(y, m, d).getTime();

    return cTime >= sTime && cTime <= eTime;
  });
};
  /* Build month grid (42 cells) */
  const monthCells = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const dim  = new Date(calYear, calMonth + 1, 0).getDate();
    const prev = new Date(calYear, calMonth, 0).getDate();
    const cells = [];
    for (let i = firstDay - 1; i >= 0; i--) {
      const y = calMonth === 0 ? calYear - 1 : calYear;
      const m = calMonth === 0 ? 11 : calMonth - 1;
      cells.push({ day: prev - i, other: true, y, m });
    }
    for (let d = 1; d <= dim; d++) cells.push({ day: d, other: false, y: calYear, m: calMonth });
    const rem = 42 - firstDay - dim;
    for (let d = 1; d <= rem; d++) {
      const y = calMonth === 11 ? calYear + 1 : calYear;
      const m = calMonth === 11 ? 0 : calMonth + 1;
      cells.push({ day: d, other: true, y, m });
    }
    return cells;
  }, [calYear, calMonth]);

  const prevMonth = () => {
  setMonthApiEnabled(true);
  if (calMonth === 0) {
    setCalMonth(11);
    setCalYear(y => y - 1);
  } else {
    setCalMonth(m => m - 1);
  }
};

const nextMonth = () => {
  setMonthApiEnabled(true);
  if (calMonth === 11) {
    setCalMonth(0);
    setCalYear(y => y + 1);
  } else {
    setCalMonth(m => m + 1);
  }
};
  const handleDelete = ev => {
  closeDropdown();

  openConfirm({
    title: 'Delete Activity?',
    message: `"<strong>${ev.name}</strong>" will be permanently removed. This cannot be undone.`,
    hint: `${ev.start} — ${ev.end}`,
    confirmLabel: 'Yes, Delete',
    confirmStyle: 'danger',
    icon: 'fa-trash',
    iconBg: 'rgba(220,38,38,.1)',
    iconColor: '#DC2626',
    onConfirm: async () => {
      try {
        // Date ko hamesha valid ISO bhejo — khaali string ('') backend ke DateTime bind ko
        // fail kar deti hai ("One or more validation errors occurred").
        const toIso = (v) => {
          const d = new Date(v);
          return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
        };
        const idNum = Number(ev.id);
        // Fake/oversized id (jaise Date.now() fallback ~1.7e12) backend ke Int32 me fit nahi hota
        // → validation error. Ye tab hota hai jab abhi-add ki hui activity ka real backend id
        // humare paas nahi. Aise me list refresh karke real id lena zaroori hai.
        if (!Number.isInteger(idNum) || idNum <= 0 || idNum > 2147483647) {
          toast('Please refresh the activity list, then delete again.', 'error');
          return;
        }

        const payload = {
          id: idNum,
          branchID: Number(sessionStorage.getItem('branchID')) || 0,
          sessionYearID: Number(
            sessionStorage.getItem('changeSessionId') ||
            sessionStorage.getItem('SessionID') ||
            sessionStorage.getItem('sessionID') || 0
          ),
          name: ev.name || '',
          activityPurpose: ev.purpose || 'string',
          activityDevelopment: ev.development || 'string',
          resourseMaterial: ev.resource || 'string',
          startAt: toIso(ev.rawStart || ev.start),
          endAt: toIso(ev.rawEnd || ev.end || ev.rawStart || ev.start),
          createdDate: new Date().toISOString(),
          action: 'delete',
        };

        const res = await fetch(buildUrl('/api/activitycalendarcrud'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
            Authorization: `bearer ${sessionStorage.getItem('token') || ''}`,
          },
          body: JSON.stringify(payload),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg = apiMessage(json);
          const err = new Error(msg || `Delete failed: ${res.status}`);
          err.serverMessage = msg;
          throw err;
        }

        setEvents(prev => prev.filter(e => e.id !== ev.id));
        setMonthEvents(prev => prev.filter(e => e.id !== ev.id)); // month-API view bhi update ho
        toast(`"${ev.name}" deleted`, 'success');
      } catch (error) {
        console.error('Error deleting activity:', error);
        /* Show the backend's reason (e.g. referenced elsewhere) when present. */
        toast(error.serverMessage || 'Could not delete activity', 'error');
      }
    },
  });
};

  return (
    <>
      {/* ─── Stats ─── */}
      <div className="act-stats-strip">
        <div className="act-stat-card" style={{ '--accent': '#1E40AF' }}>
          <div className="act-stat-icon" style={{ background: 'rgba(30,64,175,.1)', color: '#1E40AF' }}>
            <i className="fa-solid fa-calendar-days"></i>
          </div>
          <div>
            <div className="act-stat-val">{stats.total}</div>
            <div className="act-stat-lbl">Total Activities</div>
          </div>
        </div>
        <div className="act-stat-card" style={{ '--accent': '#16A34A' }}>
          <div className="act-stat-icon" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}>
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <div className="act-stat-val">{stats.upcoming}</div>
            <div className="act-stat-lbl">Upcoming</div>
          </div>
        </div>
        <div className="act-stat-card" style={{ '--accent': '#D97706' }}>
          <div className="act-stat-icon" style={{ background: 'rgba(217,119,6,.1)', color: '#D97706' }}>
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <div className="act-stat-val">{stats.thisMonth}</div>
            <div className="act-stat-lbl">This Month</div>
          </div>
        </div>
        <div className="act-stat-card" style={{ '--accent': '#7C3AED' }}>
          <div className="act-stat-icon" style={{ background: 'rgba(124,58,237,.1)', color: '#7C3AED' }}>
            <i className="fa-solid fa-flag"></i>
          </div>
          <div>
            <div className="act-stat-val">{stats.completed}</div>
            <div className="act-stat-lbl">Completed</div>
          </div>
        </div>
      </div>

      {/* ─── Main layout ─── */}
      <div className="activity-layout-v2">
        {/* LEFT: Calendar card */}
        <div className="act-cal-card">
          <div className="act-cal-header">
            <div className="act-cal-header-left">
              <div className="act-cal-nav">
                <Tooltip text="Previous month">
                  <button className="act-nav-btn" onClick={prevMonth} aria-label="Previous month"><i className="fa-solid fa-chevron-left"></i></button>
                </Tooltip>
                <div className="act-cal-month-wrap">
                  <div className="act-cal-month">{MONTHS_FULL[calMonth]} {calYear}</div>
                  <div className="act-cal-month-sub">Academic Year 2026–27</div>
                </div>
                <Tooltip text="Next month">
                  <button className="act-nav-btn" onClick={nextMonth} aria-label="Next month"><i className="fa-solid fa-chevron-right"></i></button>
                </Tooltip>
              </div>
            </div>
            <div className="act-cal-header-right">
              <div className="act-view-pills">
                {['Month','Week','Day','List','Year'].map(v => (
                  <Tooltip key={v} text={`Switch to ${v} view`}>
                    <button
                      className={`act-view-pill${view === v ? ' active' : ''}`}
                      onClick={() => setView(v)}
                    >
                      {v}
                    </button>
                  </Tooltip>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {canActDownload && (<>
                <Tooltip text={`Download ${view} activities as PDF`}>
                  <button
                    className="act-icon-btn act-icon-btn--pdf"
                    onClick={() => onReport('Activity Calendar', 'pdf', null, getReportScope())}
                  >
                    <i className="fa-solid fa-file-pdf"></i>
                  </button>
                </Tooltip>
                <Tooltip text={`Download ${view} activities as Word`}>
                  <button
                    className="act-icon-btn act-icon-btn--word"
                    onClick={() => onReport('Activity Calendar', 'word', null, getReportScope())}
                  >
                    <i className="fa-brands fa-microsoft"></i>
                  </button>
                </Tooltip>
                </>)}
              </div>
            </div>
          </div>

          {view === 'Month' ? (
            <>
              <div className="act-dow-row">
                {DAYS_SHORT.map(d => <div key={d} className="act-dow">{d}</div>)}
              </div>
              <div className="act-days-grid">
                {monthCells.map((c, i) => {
                  const evs = c.other ? [] : eventsOnDay(c.y, c.m, c.day);
                  const isToday = !c.other
                    && c.y === today.getFullYear()
                    && c.m === today.getMonth()
                    && c.day === today.getDate();
                  const hasEvs = evs.length > 0;
                  const MAX = 1;
                  const extra = evs.length - MAX;
                  const cellBg = hasEvs && !c.other ? `${evs[0].color}11` : undefined;
                  return (
                    <div
                      key={i}
                      className={`act-day-full${c.other ? ' other-month' : ''}${isToday ? ' today' : ''}${hasEvs && !c.other ? ' has-acts' : ''}`}
                      style={{ background: cellBg }}
                      onClick={() => toast(`${MONTHS_FULL[c.m]} ${c.day}, ${c.y}`, 'info')}
                    >
                      <div className={`act-day-num${isToday ? ' today-num' : ''}`}>{c.day}</div>
                      <div className="cal-day-events">
                        {evs.slice(0, MAX).map((ev, j) => (
                          <div
                            key={j}
                            className="cal-event-chip"
                            style={{ background: ev.color + '28', borderLeft: `2.5px solid ${ev.color}`, color: ev.color }}
                            title={`${ev.name}: ${ev.start} — ${ev.end}`}
                            onClick={e => { e.stopPropagation(); toast(ev.name, 'info'); }}
                          >
                            {ev.name || 'Activity'}
                          </div>
                        ))}
                        {extra > 0 && <div className="cal-event-more-chip">+{extra} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="act-legend">
                <div className="act-legend-item"><div className="act-legend-dot" style={{ background: '#1E40AF' }}></div>Scheduled</div>
                <div className="act-legend-item"><div className="act-legend-dot" style={{ background: '#16A34A' }}></div>Completed</div>
                <div className="act-legend-item"><div className="act-legend-dot" style={{ background: '#D97706' }}></div>Ongoing</div>
                <div className="act-legend-item"><div className="act-legend-dot today-dot"></div>Today</div>
              </div>
            </>
          ) : view === 'Week' ? (
  <WeekView events={displayEvents} calYear={calYear} calMonth={calMonth} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
) : view === 'Day' ? (
  <DayView events={displayEvents} />
) : view === 'List' ? (
  <ListView events={monthScopedEvents} onReport={onReport} onEdit={onEdit} isOtherSession={isOtherSession} />
) : (
  <YearView
    events={displayEvents}
    calYear={calYear}
    setCalYear={setCalYear}
    setCalMonth={setCalMonth}
    setView={setView}
  />
)}
        </div>

        {/* RIGHT: Events panel */}
        <div className="act-events-panel">
          <div className="act-events-header">
            <div>
              <div className="act-events-title">Activities</div>
              <div className="act-events-sub">{events.length} activities scheduled</div>
            </div>
            <Tooltip text={!canActCreate ? 'You do not have permission to add activities' : (isOtherSession ? 'Editing is only allowed for the current session' : 'Schedule a new activity on the calendar')}>
              <button className="act-add-btn" onClick={onAdd}
                disabled={isOtherSession || !canActCreate}
                style={(isOtherSession || !canActCreate) ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
                <i className="fa-solid fa-plus"></i> Add Activity
              </button>
            </Tooltip>
          </div>
          <div className="act-search-row">
            <div className="act-search-box">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Search activities..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Tooltip text="Cycle activity filter (All → Upcoming → Ongoing → Completed)">
              <button
                className={`act-filter-btn${filter !== 'all' ? ' on' : ''}`}
                onClick={() => {
                  const FILTERS = ['all', 'upcoming', 'ongoing', 'completed'];
                  setFilter(FILTERS[(FILTERS.indexOf(filter) + 1) % FILTERS.length]);
                }}
              >
                <i className="fa-solid fa-sliders"></i>
                <span>{filter[0].toUpperCase() + filter.slice(1)}</span>
              </button>
            </Tooltip>
          </div>
          <div className="act-events-list">
            {filteredEvents.length === 0 ? (
              <div className="act-empty">
                <div className="act-empty-icon"><i className="fa-solid fa-calendar-xmark"></i></div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>No activities found</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Try adjusting the filter or search</div>
              </div>
            ) : filteredEvents.map(ev => {
              const st = STATUS_META[ev.status] || STATUS_META.upcoming;
              return (
                <div key={ev.id} className="act-event-item">
                  <div className="act-event-strip" style={{ background: ev.color }}></div>
                  <div className="act-event-body">
                    <div className="act-event-name">{ev.name}</div>
                    <div className="act-event-dates">
                      <i className="fa-solid fa-calendar"></i>{ev.start} — {ev.end}
                    </div>
                    <div className="act-event-badge" style={{ background: st.bg, color: st.color }}>
                      <i className={`fa-solid ${st.icon}`} style={{ fontSize: 9 }}></i> {st.label}
                    </div>
                  </div>
                  <Tooltip text="More actions (edit, report, delete)">
                    <button
                      className="act-event-more"
                      onClick={e => openMenu(e, ev)}
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dropdown menu — position:fixed via top-level overlay so it never hides behind other cards */}
      {dropdown.id != null && (() => {
        const ev = events.find(e => e.id === dropdown.id);
        if (!ev) return null;
        return (
          <div
            className="dropdown-menu fixed"
            style={{ position: 'fixed', top: dropdown.y, left: dropdown.x, zIndex: 9000 }}
            onClick={e => e.stopPropagation()}
          >
            {canActEdit && (
            <button className="dropdown-item" onClick={() => { onEdit(ev); closeDropdown(); }}
              disabled={isOtherSession}
              style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
              <i className="fa-solid fa-pen"></i> Edit
            </button>
            )}
            {canActDownload && (<>
            <button className="dropdown-item" onClick={() => { onReport(ev.name, 'pdf'); closeDropdown(); }}>
              <i className="fa-solid fa-file-pdf"></i> PDF Report
            </button>
            <button className="dropdown-item" onClick={() => { onReport(ev.name, 'word'); closeDropdown(); }}>
              <i className="fa-brands fa-microsoft"></i> Word Report
            </button>
            </>)}
            {canActDelete && (
            <button className="dropdown-item delete" onClick={() => handleDelete(ev)}
              disabled={isOtherSession}
              style={isOtherSession ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
              <i className="fa-solid fa-trash"></i> Delete
            </button>
            )}
          </div>
        );
      })()}
    </>
  );
}

/* ─── Activity-calendar non-month views ─── */
function WeekView({ events, calYear, calMonth, weekOffset = 0, setWeekOffset = () => {} }) {
  const today = new Date();

  // Start from first day of the selected month
 const firstOfMonth = new Date(calYear, calMonth, 1);
const startOfWeek = new Date(firstOfMonth);
// Only go back to Sunday if it keeps us in same month,
// otherwise start from the 1st
const dayOfWeek = firstOfMonth.getDay();
if (dayOfWeek === 0) {
  // Already Sunday, start from 1st
  startOfWeek.setDate(1 + (weekOffset * 7));
} else {
  // Start week from the 1st, not the Sunday before
  startOfWeek.setDate(1 + (weekOffset * 7));
}


  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          style={{
            width: 30, height: 30, borderRadius: 8,
            border: '1.5px solid var(--border-light)',
            background: 'var(--bg-muted)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        ><i className="fa-solid fa-chevron-left" style={{ fontSize: 10 }}></i></button>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.6px', textTransform: 'uppercase' }}>
          Week of {MONTHS_FULL[startOfWeek.getMonth()]} {startOfWeek.getDate()}, {startOfWeek.getFullYear()}
        </div>

        <button
          onClick={() => setWeekOffset(w => w + 1)}
          style={{
            width: 30, height: 30, borderRadius: 8,
            border: '1.5px solid var(--border-light)',
            background: 'var(--bg-muted)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        ><i className="fa-solid fa-chevron-right" style={{ fontSize: 10 }}></i></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8 }}>
        {Array.from({ length: 7 }).map((_, d) => {
          const day = new Date(startOfWeek);
          day.setDate(startOfWeek.getDate() + d);
          const isToday = day.toDateString() === today.toDateString();
          const isCurrentMonth = day.getMonth() === calMonth && day.getFullYear() === calYear;

          const dayEvs = events.filter(ev => {
            const rawS = ev.rawStart || ev.start;
            const rawE = ev.rawEnd || ev.end || rawS;
            if (!rawS) return false;
            const getDateParts = (str) => {
              const match = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (!match) return null;
              return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
            };
            const s = getDateParts(rawS);
            const e = getDateParts(rawE);
            if (!s || !e) return false;
            const sTime = new Date(s.y, s.m, s.d).getTime();
            const eTime = new Date(e.y, e.m, e.d).getTime();
            const cTime = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
            return cTime >= sTime && cTime <= eTime;
          });

          return (
            <div key={d} style={{
              border: `1.5px solid ${isToday ? 'var(--brand-primary)' : 'var(--border-light)'}`,
              borderRadius: 12, overflow: 'hidden',
              background: isToday ? 'rgba(30,58,138,.04)' : isCurrentMonth ? 'var(--bg-card)' : 'var(--bg-muted)',
              opacity: isCurrentMonth ? 1 : 0.5,
            }}>
              <div style={{
                padding: '7px 8px', textAlign: 'center',
                background: isToday ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)' : 'var(--bg-muted)',
                borderBottom: `1px solid ${isToday ? 'transparent' : 'var(--border-light)'}`,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: isToday ? 'rgba(255,255,255,.8)' : 'var(--text-muted)' }}>
                  {DAYS_SHORT[d]}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? '#fff' : 'var(--text-primary)', lineHeight: 1.2, marginTop: 2 }}>
                  {day.getDate()}
                </div>
              </div>
              <div style={{ padding: 6, minHeight: 80 }}>
                {dayEvs.length === 0
                  ? <div style={{ fontSize: 9, color: 'var(--border-med)', textAlign: 'center', paddingTop: 12 }}>—</div>
                  : dayEvs.map((ev, j) => (
                    <div key={j} title={ev.name} style={{
                      background: ev.color + '18', borderLeft: `3px solid ${ev.color}`, borderRadius: 5,
                      padding: '3px 6px', marginBottom: 4, fontSize: 10.5, fontWeight: 600,
                      color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{ev.name}</div>
                  ))
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function DayView({ events }) {
  const today = new Date();
  const todayLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const todayEvs = events.filter(ev => {
    const s = new Date(ev.start), e = new Date(ev.end);
    if (isNaN(s) || isNaN(e)) return false;
    const t = new Date(today);
    s.setHours(0); e.setHours(23, 59); t.setHours(12);
    return t >= s && t <= e;
  });
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  return (
    <div style={{ padding: '14px 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}></div>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{todayLabel}</div>
      </div>
      {todayEvs.length > 0 ? (
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {todayEvs.map(ev => (
            <div key={ev.id} style={{
              background: ev.color + '10', border: `1.5px solid ${ev.color}40`, borderRadius: 12,
              padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: ev.color, flexShrink: 0 }}></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ev.start} — {ev.end}</div>
              </div>
              <span style={{
                background: STATUS_META[ev.status]?.bg, color: STATUS_META[ev.status]?.color,
                padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
              }}>{ev.status}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
          <i className="fa-solid fa-calendar-check" style={{ fontSize: 28, color: 'var(--border-light)', display: 'block', marginBottom: 8 }}></i>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No activities today</div>
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        Schedule
      </div>
      <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {hours.map((h, i) => {
          const label = h === 12 ? '12:00 PM' : h < 12 ? `${h}:00 AM` : `${h - 12}:00 PM`;
          return (
            <div key={h} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-light)', minHeight: 40,
            }}>
              <div style={{
                padding: 10, fontSize: 10.5, color: 'var(--text-muted)', fontWeight: 600,
                borderRight: '1px solid var(--border-light)', display: 'flex', alignItems: 'center',
              }}>{label}</div>
              <div style={{ padding: '4px 8px' }}></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ events, onReport, onEdit, isOtherSession }) {
  const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
  if (sorted.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-calendar-xmark" style={{ fontSize: 28, opacity: .3, display: 'block', marginBottom: 10 }}></i>
        No activities
      </div>
    );
  }
  return (
    <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map(ev => {
        const st = STATUS_META[ev.status] || STATUS_META.upcoming;
        return (
          <div key={ev.id} style={{
            background: 'var(--bg-card)', border: '1.5px solid var(--border-light)',
            borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11, background: ev.color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
            }}>
              <i className="fa-solid fa-calendar-star" style={{ color: ev.color }}></i>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="fa-solid fa-calendar" style={{ fontSize: 9 }}></i>
                <span>{ev.start} — {ev.end}</span>
              </div>
              <div style={{ marginTop: 5 }}>
                <span style={{
                  background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 99,
                  fontSize: 10.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  <i className={`fa-solid ${st.icon}`} style={{ fontSize: 9 }}></i>{st.label}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Tooltip text={`Download PDF report for ${ev.name}`}>
                <button
                  onClick={() => onReport(ev.name, 'pdf')}
                  style={{
                    width: 26, height: 26, borderRadius: 7,
                    border: '1px solid rgba(220,38,38,.2)', background: 'rgba(220,38,38,.06)',
                    color: '#DC2626', cursor: 'pointer', fontSize: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                ><i className="fa-solid fa-file-pdf"></i></button>
              </Tooltip>
              <Tooltip text={isOtherSession ? 'Editing is only allowed for the current session' : `Edit ${ev.name}`}>
                <button
                  onClick={() => onEdit(ev)}
                  disabled={isOtherSession}
                  style={{
                    width: 26, height: 26, borderRadius: 7,
                    border: '1px solid var(--border-light)', background: 'var(--bg-muted)',
                    color: 'var(--text-muted)', cursor: isOtherSession ? 'not-allowed' : 'pointer', fontSize: 10,
                    opacity: isOtherSession ? .45 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                ><i className="fa-solid fa-pen"></i></button>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function YearView({ events, calYear, setCalYear, setCalMonth, setView }) {
  const today = new Date();
  const eventsInMonth = mi => events.filter(ev => {
    const s = new Date(ev.start), e = new Date(ev.end);
    if (isNaN(s) || isNaN(e)) return false;
    const ms = new Date(calYear, mi, 1), me = new Date(calYear, mi + 1, 0, 23, 59);
    return s <= me && e >= ms;
  });

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-.02em' }}>
          <i className="fa-solid fa-calendar-days" style={{ color: 'var(--brand-primary)', marginRight: 8, fontSize: 18 }}></i>
          {calYear}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip text="Previous year">
            <button
              onClick={() => setCalYear(y => y - 1)}
              style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid var(--border-light)', background: 'var(--bg-muted)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            ><i className="fa-solid fa-chevron-left"></i></button>
          </Tooltip>
          <Tooltip text="Next year">
            <button
              onClick={() => setCalYear(y => y + 1)}
              style={{ width: 30, height: 30, borderRadius: 8, border: '1.5px solid var(--border-light)', background: 'var(--bg-muted)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            ><i className="fa-solid fa-chevron-right"></i></button>
          </Tooltip>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {MONTHS_FULL.map((mon, mi) => {
          const evs = eventsInMonth(mi);
          const isNow = mi === today.getMonth() && calYear === today.getFullYear();
          const topColor = evs.length > 0 ? evs[0].color : null;
          const firstDay = new Date(calYear, mi, 1).getDay();
          const dim = new Date(calYear, mi + 1, 0).getDate();
          const todayDay = isNow ? today.getDate() : -1;
          const cells = [];
          for (let pad = 0; pad < firstDay; pad++) cells.push(null);
          for (let d = 1; d <= dim; d++) {
            const dt = new Date(calYear, mi, d, 12);
            const matchingEv = evs.find(ev => {
              const s = new Date(ev.start), e = new Date(ev.end);
              s.setHours(0); e.setHours(23);
              return dt >= s && dt <= e;
            });
            cells.push({ d, hasE: !!matchingEv, evColor: matchingEv?.color, isT: d === todayDay });
          }
          return (
            <div
              key={mi}
              onClick={() => { setCalMonth(mi); setView('Month'); }}
              style={{
                border: `1.5px solid ${isNow ? 'var(--brand-primary)' : evs.length ? topColor + '50' : 'var(--border-light)'}`,
                borderRadius: 12, overflow: 'hidden',
                background: evs.length ? topColor + '06' : 'var(--bg-card)',
                cursor: 'pointer', transition: 'all .2s ease',
              }}
            >
              <div style={{
                padding: '8px 10px',
                background: isNow ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)'
                  : evs.length ? topColor + '20' : 'var(--bg-muted)',
                borderBottom: `1px solid ${isNow ? 'transparent' : evs.length ? topColor + '30' : 'var(--border-light)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: isNow ? '#fff' : evs.length ? topColor : 'var(--text-primary)' }}>{mon}</div>
                {evs.length > 0 && (
                  <div style={{
                    background: isNow ? 'rgba(255,255,255,.2)' : topColor + '22',
                    color: isNow ? '#fff' : topColor,
                    padding: '1px 6px', borderRadius: 99, fontSize: 9, fontWeight: 800,
                  }}>{evs.length}</div>
                )}
              </div>
              <div style={{ padding: 6, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
                {cells.map((c, k) => c == null ? <div key={k}></div> : (
                  <div key={k} style={{
                    width: 18, height: 18, borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8.5, fontWeight: c.isT ? 800 : 500,
                    background: c.isT ? 'linear-gradient(135deg,#1E3A8A,#1E40AF)'
                      : c.hasE ? c.evColor + '20' : 'transparent',
                    color: c.isT ? '#fff' : c.hasE ? c.evColor : 'var(--text-secondary)',
                  }}>{c.d}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ACADEMIC CALENDAR PANEL — term sections with key-date cards
   ═══════════════════════════════════════════════════════════════════ */
function AcademicCalendar({ terms, onReport, onEdit, isOtherSession }) {
  const { can } = usePermissions();
  const canAcEdit     = can('Academics', 'Academic Calendar', 'Edit');
  const canAcDownload = can('Academics', 'Academic Calendar', 'Download');
  return (
    <div className="section-card">
      <div className="cal-header">
        <div>
          <div className="cal-header-title">
            <i className="fa-solid fa-calendar-check" style={{ color: 'var(--brand-primary)', marginRight: 8 }}></i>
            Key Dates
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Academic year important dates by term
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
          {canAcDownload && (<>
          <Tooltip text="Download the academic calendar as PDF">
            <button className="export-btn pdf" onClick={() => onReport('Academic Calendar', 'pdf')}>
              <i className="fa-solid fa-file-pdf"></i> PDF
            </button>
          </Tooltip>
          <Tooltip text="Download the academic calendar as Word">
            <button className="export-btn word" onClick={() => onReport('Academic Calendar', 'word')}>
              <i className="fa-brands fa-microsoft"></i> Word
            </button>
          </Tooltip>
          </>)}
          <Tooltip text={!canAcEdit ? 'You do not have permission to edit the academic calendar' : (isOtherSession ? 'Editing is only allowed for the current session' : 'Edit the academic calendar key dates')}>
            <button className="cal-edit-btn" onClick={onEdit}
              disabled={isOtherSession || !canAcEdit}
              style={(isOtherSession || !canAcEdit) ? { opacity: .45, cursor: 'not-allowed' } : undefined}>
              <i className="fa-solid fa-pen"></i> Edit
            </button>
          </Tooltip>
        </div>
      </div>

      <div>
        {terms.map((term, i) => (
          <div key={i} className="term-section">
            <div className="term-label"><i className="fa-solid fa-bookmark"></i>{term.label}</div>
            {term.entries.length === 0 ? (
              <div className="no-data" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, fontStyle: 'italic' }}>
                No dates added
              </div>
            ) : (
              <div className="key-dates-grid">
                {term.entries.map((e, ei) => (
                  <div key={ei} className="key-date-card">
                    <div className="kd-icon"><i className="fa-solid fa-calendar-day"></i></div>
                    <div>
                      <div className="kd-heading">{e.heading}</div>
                      <div className="kd-date">{e.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TERM SETTINGS PANEL — stat strip + Session/Terms sub-tabs
   ═══════════════════════════════════════════════════════════════════ */
/* ─── Terms CRUD backend (POST /api/termscrud, action: get|insert|update|delete) ───
   Reads branch/session/token from sessionStorage so calls stay in sync with the
   logged-in user. The endpoint stores only the term name + session year. */
export const termsBranchID      = () => Number(sessionStorage.getItem('branchID')) || 0;
/* Prefer the user-switched session (changeSessionId); fall back to the session
   set at login (SessionID / sessionID). Sent as sessionYearID on term calls. */
export const termsSessionYearID = () =>
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

export async function termsCrud(payload) {
  assertSessionPayload(payload); // block session-scoped term posts when no session is selected
  const res = await fetch(buildUrl('/api/termscrud'), {
    method: 'POST',
    headers: termsAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    /* Surface the backend's message (e.g. "Term cannot be deleted as it is
       referenced in the Exam.") so callers can show it in a toast. */
    const msg = apiMessage(json);
    const err = new Error(msg || `termscrud ${payload.action} failed: ${res.status}`);
    err.serverMessage = msg;
    throw err;
  }
  return json;
}

/* ─── Key Dates backend (Academic Calendar) ───
   GET  /api/getkeydatesybranchid  → [{ id, branchID, terms, head, value }]  (terms = term id)
   POST /api/keydatescrud          → { id, branchID, terms, head, value, action: insert|update|delete } */
async function getKeyDates() {
  const res = await fetch(
    buildUrl(`/api/getkeydatesybranchid?branchID=${termsBranchID()}&pageNo=1`),
    { method: 'GET', headers: termsAuthHeaders() },
  );
  const json = await res.json().catch(() => ({}));
  return json?.data || [];
}

async function keyDatesCrud(payload) {
  const res = await fetch(buildUrl('/api/keydatescrud'), {
    method: 'POST',
    headers: termsAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`keydatescrud ${payload.action} failed: ${res.status}`);
  return res.json().catch(() => ({}));
}

/* ─── Activity Calendar backend */
   
async function getActivityCalendar() {
  const res = await fetch(
    buildUrl(`/api/getactivitycalendarbyid?BranchID=${termsBranchID()}&SessionYearID=${termsSessionYearID()}&pageNo=1`),
    {
      method: 'GET',
      headers: termsAuthHeaders(),
    }
  );

  const json = await res.json().catch(() => ({}));
  console.log('getActivityCalendar response:', json);

  if (!res.ok) {
    throw new Error(`getactivitycalendarbyid failed: ${res.status}`);
  }

  return Array.isArray(json?.data) ? json.data : [];
}
/* API activity → UI event shape */
const ACT_COLORS = ['#1E40AF', '#16A34A', '#D97706', '#7C3AED', '#1E40AF', '#E11D48'];

const actFmtDate = str => {
  const d = new Date(str);
  return isNaN(d) ? (str || 'TBD')
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const actComputeStatus = (startAt, endAt) => {
  const now = new Date();
  const s = new Date(startAt), e = new Date(endAt);
  if (!isNaN(e) && e < now) return 'completed';
  if (!isNaN(s) && s <= now && (isNaN(e) || e >= now)) return 'ongoing';
  return 'upcoming';
};

const mapActivity = (a, i) => {
  const rawStart =
    a.startAt ||
    a.startDate ||
    a.start ||
    a.fromDate ||
    a.activityDate ||
    a.date ||
    '';

  const rawEnd =
    a.endAt ||
    a.endDate ||
    a.end ||
    a.toDate ||
    a.activityDate ||
    a.date ||
    rawStart;
    console.log('Mapping activity:', a, '→ rawStart:', rawStart, 'rawEnd:', rawEnd);

  return {
    id: a.id ?? a.ID ?? a.Id ?? a.activityID ?? a.activityId ?? a.activityCalendarID ?? a.activityCalendarId ?? (Date.now() + i),
    name: a.name || a.activityName || a.title || 'Activity',
    start: actFmtDate(rawStart),
    end: actFmtDate(rawEnd),
    rawStart,
    rawEnd,
    color: ACT_COLORS[i % ACT_COLORS.length],
    status: actComputeStatus(rawStart, rawEnd),
    purpose: a.activityPurpose || '',
    development: a.activityDevelopment || '',
    resource: a.resourseMaterial || '',
  };
};
//  Used to load activities for the visible calendar month. */
async function getActivityByMonth(month) {
  const res = await fetch(
    buildUrl(`/api/getactivitycalendarbymonth?BranchID=${termsBranchID()}&month=${month}&SessionYearID=${termsSessionYearID()}&pageNo=1`),
    {
      method: 'GET',
      headers: termsAuthHeaders(),
    }
  );

  const json = await res.json().catch(() => ({}));
  console.log('getActivityByMonth response:', json);

  if (!res.ok) {
    throw new Error(`getactivitycalendarbymonth failed: ${res.status}`);
  }

  return Array.isArray(json?.data) ? json.data : [];
}

function TermSettings({ termData, setTermData, openConfirm, toast }) {
  const [sub, setSub] = useState('term');

  const [sessions,  setSessions]  = useState([]);
  const [sessionId, setSessionId] = useState(() => termsSessionYearID());
  const [start,  setStart]  = useState('2026-01-01');
  const [end,    setEnd]    = useState('2026-12-31');
  const [system, setSystem] = useState('Annual System');
  const [medium, setMedium] = useState('English');

  /* Terms are only editable for the login session (SessionID/sessionID). If the user
     switched to a different session (changeSessionId), terms become read-only:
     Save/Delete are disabled and clicking them toasts "Method not allowed". */
  const loginSessionId = sessionStorage.getItem('SessionID') || sessionStorage.getItem('sessionID') || '';
  /* Academics module checkbox OFF in the current session → view-only. */
  const acadModuleReadOnly = useModuleReadOnly('acad');
  const isOtherSession = (!!sessionId && !!loginSessionId && String(sessionId) !== String(loginSessionId)) || acadModuleReadOnly;

   /* Editing is only allowed when "today" (UTC) falls within the selected
     session's start/end window (inclusive). Outside that window the
     session is read-only — edit/delete/update controls are hidden. */
  const isWithinSessionWindow = useMemo(() => {
    if (!start || !end) return false;
    const todayUtc = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    const startUtc = new Date(start + 'T00:00:00Z');
    const endUtc   = new Date(end   + 'T00:00:00Z');
    return todayUtc >= startUtc && todayUtc <= endUtc;
  }, [start, end]);

  const { can: canTs } = usePermissions();
  const canTermsEdit   = canTs('Academics', 'Term Settings', 'Edit');
  const canTermsCreate = canTs('Academics', 'Term Settings', 'Create');
  const canTermsDelete = canTs('Academics', 'Term Settings', 'Delete');
  const canEditTerms = !isOtherSession && isWithinSessionWindow;

  /* Load the session (academic-year) dropdown. Default-selects the session whose
     id matches sessionStorage.sessionID — the active session for the logged-in user. */
  useEffect(() => {
    (async () => {
      try {
        const branchID = termsBranchID();
        const res = await fetch(
          buildUrl(`/api/Setting/get-academic-sessions-by-branch/${branchID}`),
          { method: 'GET', headers: termsAuthHeaders() }
        );
        const json = await res.json();
        const list = json?.data || [];
        /* Normalize to the shape the rest of this component expects:
           SessionID/SessionName, plus the raw start/end dates for the
           read-only date fields and the edit-window check below. */
        const mapped = list.map(s => ({
          SessionID: s.ID ?? s.id,
          SessionName: s.SessionName,
          StartDate: s.StartDate,
          EndDate: s.EndDate,
          Status: s.Status,
        }));
        setSessions(mapped);

        const stored = termsSessionYearID();
        if (stored) {
          setSessionId(String(stored));
        } else {
          /* Default-select the branch's current/active session. */
          const active = mapped.find(s => s.Status === 'Current') || mapped[0];
          if (active) {
            setSessionId(String(active.SessionID));
            sessionStorage.setItem('sessionID', active.SessionID);
            sessionStorage.setItem('sessionName', active.SessionName);
          }
        }
      } catch (e) {
        console.error('Error loading sessions:', e);
      }
    })();
  }, []);

  /* Load the session start/end dates for the current branch. */
  // useEffect(() => { loadSessionDates(); }, []);

  /* Start/end dates now come straight from the selected session record
     (set in the sessions-loading effect / changeSession) instead of a
     separate summary endpoint. */
  useEffect(() => {
    const sel = sessions.find(s => String(s.SessionID) === String(sessionId));
    if (sel) {
      if (sel.StartDate) setStart(sel.StartDate.slice(0, 10));
      if (sel.EndDate)   setEnd(sel.EndDate.slice(0, 10));
    }
  }, [sessions, sessionId]);

  /* Switch the active session: persist it and reload the terms scoped to it. */
 const changeSession = id => {
    setSessionId(id);
    /* Store the user-switched session under changeSessionId (takes priority in
       termsSessionYearID) and broadcast so all loaders re-run. Also mirror the
       name so labels reading sessionName update. */
    sessionStorage.setItem('changeSessionId', id);
    const sel = sessions.find(s => String(s.SessionID) === String(id));
    if (sel?.SessionName) sessionStorage.setItem('sessionName', sel.SessionName);
    if (sel?.StartDate) setStart(sel.StartDate.slice(0, 10));
    if (sel?.EndDate)   setEnd(sel.EndDate.slice(0, 10));
    notifySessionChange();
  };

  /* Load terms from the backend on mount, replacing any seed/mock data. */
  useEffect(() => { loadTerms(); }, []);

  /* Re-run the term/session calls whenever a session key changes (same-tab event)
     or another tab edits sessionStorage. */
  /* Re-run the term calls whenever a session key changes (same-tab event)
     or another tab edits sessionStorage. Start/end dates auto-update via
     the sessions/sessionId effect above. */
  useEffect(() => {
    const reload = () => { loadTerms(); };
    window.addEventListener(SESSION_CHANGE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(SESSION_CHANGE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

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
    setTermData(list.map(t => ({
      id: t.id,
      name: t.term || '',
      start: t.startDate ? t.startDate.slice(0, 10) : '',
      end: t.endDate ? t.endDate.slice(0, 10) : '',
    })));
  } catch (e) {
    console.error('Error loading terms:', e);
    toast('Could not load terms', 'error');
  }
};

  const updateRow = (id, key, val) =>
    setTermData(termData.map(t => t.id === id ? { ...t, [key]: val } : t));

 const saveTerm = async id => {
  if (!canEditTerms) { toast('Editing is only allowed within the session\'s date range', 'error'); return; }
  const t = termData.find(x => x.id === id);
  if (!t) return;
  if (!t.name || !t.name.trim()) { toast('Term name cannot be empty', 'error'); return; }
  if (!t.start || !t.end) { toast('Start and end date are required', 'error'); return; }
  if (new Date(t.start) > new Date(t.end)) { toast('Start date cannot be after end date', 'error'); return; }
  try {
    await termsCrud({
      id: t.isNew ? 0 : t.id,
      branchID: termsBranchID(),
      term: t.name.trim(),
      sessionYearID: termsSessionYearID(),
      action: t.isNew ? 'insert' : 'update',
      startDate: t.start,
      endDate: t.end,
    });
    toast(`"${t.name.trim()}" saved successfully`, 'success');
    loadTerms();
  } catch (e) {
    console.error('Error saving term:', e);
    if (!e.isSessionError) toast('Could not save term', 'error');
  }
};
const deleteTerm = id => {
    if (!canEditTerms) { toast('Editing is only allowed within the session\'s date range', 'error'); return; }
    const t = termData.find(x => x.id === id);
    if (!t) return;
    /* Unsaved rows aren't on the server yet — just drop them locally. */
    if (t.isNew) {
      setTermData(termData.filter(x => x.id !== id));
      return;
    }
    openConfirm({
      title: 'Delete Term?',
      message: `Term "<strong>${t.name || 'this term'}</strong>" will be permanently removed. Linked calendar entries will be affected.`,
      hint: 'Academic Calendar and Examination records linked to this term may be impacted.',
      confirmLabel: 'Yes, Delete',
      confirmStyle: 'danger',
      icon: 'fa-trash',
      iconBg: 'rgba(220,38,38,.1)',
      iconColor: '#DC2626',
      onConfirm: async () => {
        try {
          await termsCrud({ action: 'delete', id, branchID: 0, term: '', sessionYearID: '' });
          toast('Term deleted', 'success');
          loadTerms();
        } catch (e) {
          console.error('Error deleting term:', e);
          /* Show the backend's reason (e.g. referenced in the Exam) when present. */
          toast(e.serverMessage || 'Could not delete term', 'error');
        }
      },
    });
  };

  /* "Add new term" stays disabled while there is an unsaved new term row —
     the user must save (✓) or delete (✗) it before adding another. */
  const canAddTerm = !termData.some(t => t.isNew);

  const addTerm = () => {
    if (!canAddTerm) return;
    setTermData([...termData, { id: Date.now(), name: '', start: '', end: '', isNew: true }]);
  };

  const sessionStartDisplay = useMemo(() => {
    const d = new Date(start);
    return isNaN(d) ? 'Jan 1' : `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  }, [start]);
  const sessionEndDisplay = useMemo(() => {
    const d = new Date(end);
    return isNaN(d) ? 'Dec 31' : `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
  }, [end]);
  const academicYearLabel = useMemo(() => {
    const sel = sessions.find(s => String(s.SessionID) === String(sessionId));
    return sel ? sel.SessionName.split(/[-–]/)[0] : '2026';
  }, [sessions, sessionId]);

  return (
    <>
      {/* Stat strip */}
      <div className="ts-stat-strip">
        <div className="ts-stat">
          <div className="ts-stat-icon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E40AF' }}>
            <i className="fa-solid fa-layer-group"></i>
          </div>
          <div>
            <div className="ts-stat-val">{termData.length}</div>
            <div className="ts-stat-lbl">Total Terms</div>
          </div>
          <div className="ts-stat-bar" style={{ background: 'linear-gradient(90deg,#1E40AF,#1E3A8A)' }}></div>
        </div>
        <div className="ts-stat">
          <div className="ts-stat-icon" style={{ background: 'rgba(22,163,74,.1)', color: '#16A34A' }}>
            <i className="fa-solid fa-calendar-check"></i>
          </div>
          <div>
            <div className="ts-stat-val">{academicYearLabel}</div>
            <div className="ts-stat-lbl">Academic Year</div>
          </div>
          <div className="ts-stat-bar" style={{ background: 'linear-gradient(90deg,#16A34A,#15803D)' }}></div>
        </div>
        <div className="ts-stat">
          <div className="ts-stat-icon" style={{ background: 'rgba(217,119,6,.1)', color: '#D97706' }}>
            <i className="fa-solid fa-calendar-day"></i>
          </div>
          <div>
            <div className="ts-stat-val">{sessionStartDisplay}</div>
            <div className="ts-stat-lbl">Session Start</div>
          </div>
          <div className="ts-stat-bar" style={{ background: 'linear-gradient(90deg,#D97706,#B45309)' }}></div>
        </div>
        <div className="ts-stat">
          <div className="ts-stat-icon" style={{ background: 'rgba(220,38,38,.08)', color: '#DC2626' }}>
            <i className="fa-solid fa-calendar-xmark"></i>
          </div>
          <div>
            <div className="ts-stat-val">{sessionEndDisplay}</div>
            <div className="ts-stat-lbl">Session End</div>
          </div>
          <div className="ts-stat-bar" style={{ background: 'linear-gradient(90deg,#DC2626,#B91C1C)' }}></div>
        </div>
      </div>

      {/* Main card */}
      <div className="section-card" style={{ overflow: 'visible' }}>
        <div className="ts-card-header">
          <div className="ts-card-header-left">
            <div className="ts-header-icon"><i className="fa-solid fa-sliders"></i></div>
            <div>
              <div className="ts-card-title">Academic Structure</div>
              <div className="ts-card-sub">Configure session &amp; terms — drives all calendars, exams and fee records</div>
            </div>
          </div>
          <div className="ts-subtab-row">
            <button className={`ts-subtab${sub === 'session' ? ' active' : ''}`} onClick={() => setSub('session')}>
              <i className="fa-solid fa-gear"></i><span>Session</span>
            </button>
            <button className={`ts-subtab${sub === 'term' ? ' active' : ''}`} onClick={() => setSub('term')}>
              <i className="fa-solid fa-list-ol"></i><span>Terms</span>
            </button>
          </div>
        </div>

        {sub === 'session' ? (
          <div className="ts-section-body">
            <div className="ts-info-strip">
              <i className="fa-solid fa-circle-info" style={{ flexShrink: 0, marginTop: 2 }}></i>
              <span>Session settings define the overall academic year. All term dates must fall within this session period.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18, marginTop: 20 }}>
              <div className="ts-field-group" style={{ gridColumn: '1 / -1' }}>
                <label className="ts-label">Academic Year <span style={{ color: 'var(--error)' }}>*</span></label>
                <div className="ts-input-wrap" style={{ maxWidth: 280 }}>
                  <i className="fa-solid fa-graduation-cap ts-input-icon"></i>
                  <select
                    className="ts-input ts-select"
                    value={sessionId || ''}
                    onChange={e => changeSession(e.target.value)}
                  >
                    <option value="" disabled>Select session</option>
                    {sessions.map(s => (
                      <option key={s.SessionID} value={s.SessionID}>{s.SessionName}</option>
                    ))}
                  </select>
                </div>
                <div className="ts-hint"><i className="fa-solid fa-info-circle"></i> Switch the active academic session</div>
              </div>
              <div className="ts-field-group">
                <label className="ts-label">Session Start Date</label>
                <Tooltip text="To edit this date, go to Settings › Academic Sessions.">
                  <div className="ts-input-wrap">
                    <i className="fa-solid fa-calendar-day ts-input-icon"></i>
                    <input className="ts-input" type="date" value={start} readOnly disabled style={{ opacity: .7, cursor: 'not-allowed' }} />
                  </div>
                </Tooltip>
                <div className="ts-hint"><i className="fa-solid fa-info-circle"></i> First day of the academic session</div>
              </div>
              <div className="ts-field-group">
                <label className="ts-label">Session End Date</label>
                <Tooltip text="To edit this date, go to Settings › Academic Sessions.">
                  <div className="ts-input-wrap">
                    <i className="fa-solid fa-calendar-check ts-input-icon"></i>
                    <input className="ts-input" type="date" value={end} readOnly disabled style={{ opacity: .7, cursor: 'not-allowed' }} />
                  </div>
                </Tooltip>
                <div className="ts-hint"><i className="fa-solid fa-info-circle"></i> Last day of the academic session</div>
              </div>
              {/*
              <div className="ts-field-group">
                <label className="ts-label">School System</label>
                <div className="ts-input-wrap">
                  <i className="fa-solid fa-school ts-input-icon"></i>
                  <select className="ts-input ts-select" value={system} onChange={e => setSystem(e.target.value)}>
                    <option>Annual System</option>
                    <option>Semester System</option>
                    <option>Trimester System</option>
                    <option>Quarter System</option>
                  </select>
                </div>
              </div>
              <div className="ts-field-group">
                <label className="ts-label">Medium of Instruction</label>
                <div className="ts-input-wrap">
                  <i className="fa-solid fa-language ts-input-icon"></i>
                  <select className="ts-input ts-select" value={medium} onChange={e => setMedium(e.target.value)}>
                    <option>English</option>
                    <option>Urdu</option>
                    <option>Bilingual</option>
                  </select>
                </div>
              </div>
              */}
              </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-light)' }}>
              <Tooltip text="Save session settings">
                <button className="ts-btn-primary" onClick={() => toast('Session settings saved successfully!', 'success')}>
                  <i className="fa-solid fa-check"></i> Save Session
                </button>
              </Tooltip>
              {/*
              <Tooltip text="Reset to defaults">
                <button className="ts-btn-ghost" onClick={() => toast('Reset to defaults', 'info')}>
                  <i className="fa-solid fa-rotate-left"></i> Reset
                </button>
              </Tooltip>
              */}
            </div>
          </div>
        ) : (
          <div className="ts-section-body">
            <div className="ts-info-strip warn">
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#D97706', flexShrink: 0, marginTop: 2 }}></i>
              <span>Terms defined here drive <strong>Academic Calendar</strong>, <strong>Examinations</strong> and <strong>Fee Records</strong>. Deleting a term affects all linked data.</span>
            </div>

            <div className="ts-table" style={{ marginTop: 16 }}>
              <div className="ts-table-head">
                <div className="ts-th" style={{ width: 52 }}>#</div>
                <div className="ts-th" style={{ flex: 1 }}>Term Name</div>
                <div className="ts-th" style={{ width: 155 }}>Start Date</div>
                <div className="ts-th" style={{ width: 155 }}>End Date</div>
                <div className="ts-th" style={{ width: 96, textAlign: 'center' }}>Actions</div>
              </div>
              {termData.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: 'linear-gradient(135deg,rgba(30,58,138,.08),rgba(30,64,175,.05))',
                    color: 'var(--brand-primary)', fontSize: 26,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
                  }}>
                    <i className="fa-solid fa-list-ol"></i>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>No terms yet</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Click "Add new term" below to get started.</div>
                </div>
              ) : termData.map((term, i) => {
                const isNew = !term.name;
                return (
                  <div key={term.id} className="ts-row">
                    <div className="ts-num">
                      <div className="ts-num-badge">{i + 1}</div>
                    </div>
                    <div className="ts-cell flex1">
                      <input
                        className={`ts-term-input${isNew ? ' new' : ''}`}
                        value={term.name}
                        placeholder="Enter term name"
                        onChange={e => updateRow(term.id, 'name', e.target.value)}
                      />
                    </div>
                    <div className="ts-cell w160">
                      <input
                        className="ts-term-input"
                        type="date"
                        value={term.start}
                        onChange={e => updateRow(term.id, 'start', e.target.value)}
                      />
                    </div>
                    <div className="ts-cell w160">
                      <input
                        className="ts-term-input"
                        type="date"
                        value={term.end}
                        onChange={e => updateRow(term.id, 'end', e.target.value)}
                      />
                    </div>
                    <div className="ts-cell w100">
                      <div className="ts-actions">
                        {canEditTerms && (canTermsEdit || canTermsDelete) ? (
                          <>
                            {canTermsEdit && (
                            <Tooltip text="Save term changes">
                              <button
                                className="ts-act-btn save"
                                onClick={() => saveTerm(term.id)}
                              >
                                <i className="fa-solid fa-check"></i>
                              </button>
                            </Tooltip>
                            )}
                            {canTermsDelete && (
                            <Tooltip text="Delete term">
                              <button
                                className="ts-act-btn del"
                                onClick={() => deleteTerm(term.id)}
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </Tooltip>
                            )}
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            View only
                          </span>
                        )}
                       
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

           {canEditTerms && canTermsCreate && (
              <Tooltip text={canAddTerm ? 'Add another academic term' : 'Save or delete the current term first'}>
                <button className="ts-add-row-btn" onClick={addTerm} disabled={!canAddTerm}
                  style={!canAddTerm ? { opacity: .5, cursor: 'not-allowed' } : undefined}>
                  <div className="ts-add-icon"><i className="fa-solid fa-plus"></i></div>
                  <span>Add new term</span>
                  <span className="ts-add-hint">{canAddTerm ? 'Click to add another academic term' : 'Save or delete the current term first'}</span>
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TEXT BOOKS PANEL — class rows with expand/collapse
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   RESOURCE LIBRARY — per-school academic file library (worksheets, summer
   packs, question papers, others).

   Ab LIVE hai: /api/manage-resource-library par, branchID ki base par
   (dekhein src/erp/services/resourceLibraryService.js). Pehle ye
   localStorage me baitha tha aur PDF data-URL ki shakal me rehti thi —
   ab file asal me server par jati hai aur uska URL row ke sath aata hai.

   Wahi table chain portal bhi use karta hai (Academics ▸ Resource Library),
   farq sirf scope ka hai: wahan rows networkID se bandhi hoti hain, yahan
   branchID se. Server 0 ko null rakh deta hai, is liye dono aapas me nahi
   milte — is school ki list me sirf isi branch ki rows aati hain.

   Class/subject live API se aate hain (wahi source jo Textbooks use karta
   hai), aur ab subject ka asli subjectID bhi sath jata hai — API par
   ClassID/SubjectID/SectionID par foreign keys lagti hain.
   ═══════════════════════════════════════════════════════════════════ */
const RL_CATEGORIES = [
  { key: 'worksheet', label: 'Worksheets',      icon: 'fa-file-lines',           color: '#1E40AF' },
  { key: 'summer',    label: 'Summer Packs',    icon: 'fa-umbrella-beach',       color: '#D97706' },
  { key: 'qpaper',    label: 'Question Papers', icon: 'fa-file-circle-question', color: '#7C3AED' },
  { key: 'other',     label: 'Others',          icon: 'fa-folder',               color: '#16A34A' },
];
const rlCat = k => RL_CATEGORIES.find(c => c.key === k) || RL_CATEGORIES[3];
const rlFmtDate = d => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

function ResourceLibrary({ toast, openConfirm, classesData = [] }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [fClass, setFClass] = useState('all');
  const [fSubject, setFSubject] = useState('all');
  const [fCat, setFCat] = useState('all');
  const [modal, setModal] = useState(null); // { mode:'add' } | { mode:'edit', resource }

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      setList(await fetchBranchResources());
      setLoadErr('');
    } catch (e) {
      setLoadErr(e?.message || 'Could not load resources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const counts = useMemo(() => {
    const c = { total: list.length };
    RL_CATEGORIES.forEach(cat => { c[cat.key] = list.filter(r => r.category === cat.key).length; });
    return c;
  }, [list]);

  /* Filter ka subject dropdown saved resources ke subjects se banta hai
     (live subject-fetch sirf modal me hoti hai jab class chunte hain). */
  const subjectsInUse = useMemo(
    () => Array.from(new Set(list.map(r => r.subjectName).filter(Boolean))).sort(),
    [list],
  );

  const filtered = useMemo(() => list.filter(r => {
    const term = q.trim().toLowerCase();
    if (term && !(r.title || '').toLowerCase().includes(term)) return false;
    if (fClass !== 'all' && String(r.classId) !== String(fClass)) return false;
    if (fSubject !== 'all' && r.subjectName !== fSubject) return false;
    if (fCat !== 'all' && r.category !== fCat) return false;
    return true;
  }), [list, q, fClass, fSubject, fCat]);

  const anyFilter = q.trim() || fClass !== 'all' || fSubject !== 'all' || fCat !== 'all';
  const reset = () => { setQ(''); setFClass('all'); setFSubject('all'); setFCat('all'); };

  const save = async payload => {
    const isEdit = modal?.mode === 'edit';
    setBusy(true);
    try {
      await saveBranchResource({ ...payload, id: isEdit ? modal.resource.id : 0 });
      setModal(null);
      toast(isEdit ? 'Resource updated' : 'Resource added', 'success');
      await reload();
    } catch (e) {
      toast(e?.message || 'Could not save the resource', 'error');
    } finally {
      setBusy(false);
    }
  };

  const viewFile = r => { if (r.fileUrl) window.open(r.fileUrl, '_blank', 'noopener'); else toast('No file attached to preview', 'info'); };
  const downloadFile = r => {
    if (!r.fileUrl) { toast('No file attached to download', 'info'); return; }
    const a = document.createElement('a');
    a.href = r.fileUrl; a.download = r.fileName || 'resource.pdf';
    a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  };
  const removeRes = r => openConfirm({
    title: 'Delete Resource?',
    message: `"<strong>${r.title}</strong>" will be permanently removed. This cannot be undone.`,
    hint: `${r.className} · ${r.subjectName}`,
    confirmLabel: 'Yes, Delete', confirmStyle: 'danger',
    icon: 'fa-trash', iconBg: 'rgba(220,38,38,.1)', iconColor: '#DC2626',
    onConfirm: async () => {
      setBusy(true);
      try {
        await deleteBranchResource(r);
        toast('Resource deleted', 'success');
        await reload();
      } catch (e) {
        toast(e?.message || 'Could not delete the resource', 'error');
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <>
      {/* Header row */}
      <div className="rl-head">
        <div>
          <div className="rl-head-title"><i className="fa-solid fa-folder-open"></i> Resource Library</div>
          <div className="rl-head-sub">Upload class-wise and subject-wise academic resources for your school.</div>
        </div>
        <Tooltip text="Upload a new resource">
          <button className="btn btn-primary" disabled={loading || busy} onClick={() => setModal({ mode: 'add' })}>
            <i className="fa-solid fa-plus"></i> Add Resource
          </button>
        </Tooltip>
      </div>

      <div className="rl-stats">
        <div className="rl-stat" style={{ '--accent': '#1E3A8A' }}>
          <div className="rl-stat-icon" style={{ background: 'rgba(30,58,138,.1)', color: '#1E3A8A' }}><i className="fa-solid fa-folder-open"></i></div>
          <div><div className="rl-stat-val">{counts.total}</div><div className="rl-stat-lbl">Total Resources</div></div>
        </div>
        {RL_CATEGORIES.map(cat => (
          <div className="rl-stat" key={cat.key} style={{ '--accent': cat.color }}>
            <div className="rl-stat-icon" style={{ background: cat.color + '1a', color: cat.color }}><i className={`fa-solid ${cat.icon}`}></i></div>
            <div><div className="rl-stat-val">{counts[cat.key]}</div><div className="rl-stat-lbl">{cat.label}</div></div>
          </div>
        ))}
      </div>

      <div className="section-card rl-filter-card">
        <div className="rl-filters">
          <div className="rl-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input className="form-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by resource title…" />
          </div>
          <select className="form-input rl-fsel" value={fClass} onChange={e => setFClass(e.target.value)}>
            <option value="all">All Classes</option>
            {classesData.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="form-input rl-fsel" value={fSubject} onChange={e => setFSubject(e.target.value)}>
            <option value="all">All Subjects</option>
            {subjectsInUse.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="form-input rl-fsel" value={fCat} onChange={e => setFCat(e.target.value)}>
            <option value="all">All Categories</option>
            {RL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <Tooltip text="Clear all filters">
            <button className="btn btn-secondary rl-reset" onClick={reset} disabled={!anyFilter}>
              <i className="fa-solid fa-rotate-left"></i> Reset
            </button>
          </Tooltip>
        </div>
      </div>

      {loading ? (
        <div className="section-card rl-empty">
          <div className="rl-empty-icon"><i className="fa-solid fa-spinner fa-spin"></i></div>
          <div className="rl-empty-title">Loading resources…</div>
        </div>
      ) : loadErr ? (
        <div className="section-card rl-empty">
          <div className="rl-empty-icon"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <div className="rl-empty-title">{loadErr}</div>
          <div className="rl-empty-sub" style={{ marginTop: 12 }}>
            <button className="btn btn-secondary" onClick={reload}><i className="fa-solid fa-rotate-right"></i> Try again</button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="section-card rl-empty">
          <div className="rl-empty-icon"><i className="fa-solid fa-folder-open"></i></div>
          <div className="rl-empty-title">No resources found</div>
          <div className="rl-empty-sub">{anyFilter ? 'Try adjusting your search or filters.' : 'Click “Add Resource” to upload your first academic resource.'}</div>
        </div>
      ) : (
        <div className="rl-grid">
          {filtered.map(r => {
            const cat = rlCat(r.category);
            return (
              <div className="rl-card" key={r.id}>
                <div className="rl-card-top">
                  <div className="rl-card-icon" style={{ background: cat.color + '1a', color: cat.color }}><i className={`fa-solid ${cat.icon}`}></i></div>
                  <div className="rl-card-headings">
                    <div className="rl-card-title">{r.title}</div>
                    <div className="rl-card-meta">
                      <span><i className="fa-solid fa-chalkboard"></i> {r.className || '—'}</span>
                      <span><i className="fa-solid fa-book"></i> {r.subjectName || '—'}</span>
                    </div>
                  </div>
                  <span className="rl-badge" style={{ background: cat.color + '14', color: cat.color }}>{cat.label}</span>
                </div>
                {r.description && <div className="rl-card-desc">{r.description}</div>}
                <div className="rl-card-file">
                  <span className="rl-card-fname"><i className="fa-solid fa-file-pdf"></i> {r.fileName || 'No file attached'}</span>
                  {r.uploadedAt && <span className="rl-card-date"><i className="fa-regular fa-calendar"></i> {rlFmtDate(r.uploadedAt)}</span>}
                </div>
                <div className="rl-card-actions">
                  <Tooltip text="View file"><button className="rl-act" onClick={() => viewFile(r)}><i className="fa-solid fa-eye"></i> View</button></Tooltip>
                  <Tooltip text="Download file"><button className="rl-act" onClick={() => downloadFile(r)}><i className="fa-solid fa-download"></i> Download</button></Tooltip>
                  <Tooltip text="Edit resource"><button className="rl-act" disabled={busy} onClick={() => setModal({ mode: 'edit', resource: r })}><i className="fa-solid fa-pen"></i> Edit</button></Tooltip>
                  <Tooltip text="Delete resource"><button className="rl-act rl-act-danger" disabled={busy} onClick={() => removeRes(r)}><i className="fa-solid fa-trash"></i> Delete</button></Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ResourceModal
        open={!!modal}
        mode={modal?.mode}
        resource={modal?.resource}
        classesData={classesData}
        busy={busy}
        onClose={() => { if (!busy) setModal(null); }}
        onSave={save}
      />
    </>
  );
}

function ResourceModal({ open, mode, resource, classesData = [], busy, onClose, onSave }) {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [category, setCategory] = useState('worksheet');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileName, setFileName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [subjLoading, setSubjLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    const r = mode === 'edit' ? resource : null;
    setClassId(r ? String(r.classId || '') : '');
    setSubjectId(r ? String(r.subjectId || '') : '');
    setCategory(r?.category || 'worksheet');
    setTitle(r?.title || '');
    setDescription(r?.description || '');
    setFileName(r?.fileName || '');
    setFilePath(r?.filePath || '');
    setPdfFile(null);
    setSubjects([]);
    setErr('');
  }, [open, mode, resource]);

  /* Class chunte hi us class ke subjects (pehli section se) laao — naam ke
     sath subjectID bhi, kyunke API par SubjectID ki FK lagti hai. Edit par
     mojooda subject rehne dete hain agar wo isi class me ho. */
  useEffect(() => {
    if (!open || !classId) { setSubjects([]); return undefined; }
    const cls = classesData.find(c => String(c.id) === String(classId));
    const sectionId = cls?.sections?.[0]?.sectionID;
    let alive = true;
    setSubjLoading(true);
    rlFetchClassSubjects(classId, sectionId)
      .then(subs => {
        if (!alive) return;
        setSubjects(subs);
        setSubjectId(cur => (subs.some(s => String(s.id) === String(cur)) ? cur : ''));
      })
      .finally(() => { if (alive) setSubjLoading(false); });
    return () => { alive = false; };
  }, [open, classId, classesData]);

  const onFile = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { setErr('Please upload a PDF file.'); return; }
    setErr(''); setFileName(f.name); setPdfFile(f);
  };

  const submit = () => {
    if (!classId) { setErr('Please select a class.'); return; }
    if (!subjectId) { setErr('Please select a subject.'); return; }
    if (!title.trim()) { setErr('Please enter a resource title.'); return; }
    const cls = classesData.find(x => String(x.id) === String(classId));
    const sec = cls?.sections?.[0];
    const sub = subjects.find(s => String(s.id) === String(subjectId));
    onSave({
      classId: Number(classId),
      subjectId: Number(subjectId),
      /* Network ke bar-aks school ki rows section ke sath jati hain — modal
         me section ka apna picker nahi, class ki pehli section wahi hai
         jahan se subjects bhi aate hain. */
      sectionId: Number(sec?.sectionID) || 0,
      className: cls?.name || '',
      subjectName: sub?.name || '',
      sectionName: sec?.sectionName || '',
      category,
      title: title.trim(),
      description: description.trim(),
      pdfFile,
      /* Nayi file na chuni ho to purana path wapas — warna edit par PDF gum
         ho jati hai. */
      filePath: pdfFile ? '' : filePath,
    });
  };

  if (!open) return null;
  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal modal-md" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <i className={`fa-solid ${mode === 'edit' ? 'fa-pen' : 'fa-folder-plus'}`} style={{ marginRight: 8 }}></i>
              {mode === 'edit' ? 'Edit Resource' : 'Add Resource'}
            </div>
            <div className="modal-sub">Class-wise &amp; subject-wise academic resource for your school</div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="modal-body">
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Class <span className="req-star">*</span></label>
              <select className="form-input" value={classId} onChange={e => { setClassId(e.target.value); setSubjectId(''); }}>
                <option value="">Select class</option>
                {classesData.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Subject <span className="req-star">*</span></label>
              <select className="form-input" value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!classId || subjLoading}>
                <option value="">
                  {!classId ? 'Select class first' : (subjLoading ? 'Loading subjects…' : (subjects.length ? 'Select subject' : 'No subjects in this class'))}
                </option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Category <span className="req-star">*</span></label>
            <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
              {RL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Resource Title <span className="req-star">*</span></label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. English Grammar Worksheet — Nouns" />
          </div>
          <div className="form-group">
            <label className="form-label">Resource Description</label>
            <textarea className="form-input" style={{ height: 'auto', padding: 12, minHeight: 70, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description of this resource…" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Upload PDF</label>
            <label className="rl-upload">
              <input type="file" accept="application/pdf" onChange={onFile} hidden />
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span>{fileName ? fileName : 'Choose a PDF file to upload'}</span>
            </label>
            {fileName && <div className="rl-upload-note"><i className="fa-solid fa-circle-check"></i> {pdfFile ? 'Ready to upload' : 'Existing file kept'} — {fileName}</div>}
          </div>
          {err && <div className="rl-err"><i className="fa-solid fa-circle-exclamation"></i> {err}</div>}
        </div>
        <div className="modal-footer">
          <Tooltip text="Discard and close"><button className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button></Tooltip>
          <Tooltip text="Save this resource">
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i> {busy ? 'Saving…' : 'Save Resource'}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function TextBooks({ onReport, toast, classesData }) {
  const { can: canTb } = usePermissions();
  const canTbDownload = canTb('Academics', 'Textbooks', 'Download');
  const [openId, setOpenId] = useState(null);
  const [subjectsData, setSubjectsData] = useState({});
  const [loadingSubjects, setLoadingSubjects] = useState({});

  const fetchSubjects = async (gradeId, sectionId) => {
    const key = `${gradeId}_${sectionId}`;
    if (subjectsData[key]) return subjectsData[key];

    try {
      setLoadingSubjects(prev => ({ ...prev, [key]: true }));

      const res = await fetch(
        buildUrl(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`),
        { method: 'GET', headers: { Accept: '*/*' } }
      );

      const json = await res.json();

      if (json.success && json.data) {
        const formattedSubjects = json.data.map(subject => ({
          name: subject.subjectName,
          book: subject.book_Title || null,
          color: getSubjectColor(subject.subjectName),
          icon: getSubjectIcon(subject.subjectName),
        }));
        setSubjectsData(prev => ({ ...prev, [key]: formattedSubjects }));
        return formattedSubjects;
      } else {
        setSubjectsData(prev => ({ ...prev, [key]: [] }));
        return [];
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
      setSubjectsData(prev => ({ ...prev, [key]: [] }));
      return [];
    } finally {
      setLoadingSubjects(prev => ({ ...prev, [key]: false }));
    }
  };

  const getSubjectColor = (subjectName) => {
    const colors = {
      'Math': 'subj-rose',
      'Science': 'subj-green',
      'English': 'subj-purple',
      'Urdu': 'subj-teal',
      'Islamiat': 'subj-amber',
      'Computer': 'subj-blue',
      'Biology': 'subj-green',
      'Chemistry': 'subj-amber',
      'Physics': 'subj-blue',
      'Social Studies': 'subj-amber'
    };
    return colors[subjectName] || 'subj-blue';
  };

  const getSubjectIcon = (subjectName) => {
    const icons = {
      'Math': 'fa-square-root-variable',
      'Science': 'fa-flask',
      'English': 'fa-book',
      'Urdu': 'fa-language',
      'Islamiat': 'fa-mosque',
      'Computer': 'fa-laptop-code',
      'Biology': 'fa-dna',
      'Chemistry': 'fa-atom',
      'Physics': 'fa-bolt',
      'Social Studies': 'fa-globe'
    };
    return icons[subjectName] || 'fa-graduation-cap';
  };

  const flattenedData = [];
  classesData.forEach((cls) => {
    if (cls.sections && cls.sections.length > 0) {
      cls.sections.forEach((section) => {
        flattenedData.push({
          gradeId: cls.id,
          gradeName: cls.name,
          sectionId: section.sectionID,
          sectionName: section.sectionName,
          completeSubjectsDetailCount: section.completeSubjectsDetailCount,
          totalSubjectsCount: section.totalSubjectsCount
        });
      });
    } else {
      flattenedData.push({
        gradeId: cls.id,
        gradeName: cls.name,
        sectionId: null,
        sectionName: null,
        completeSubjectsDetailCount: 0,
        totalSubjectsCount: 0
      });
    }
  });

  return (
    <div className="section-card">
      <div className="table-head">
        <div className="th">S. No.</div>
        <div className="th">Class</div>
        <div className="th">Section</div>
        <div className="th">Report</div>
        <div className="th" style={{ textAlign: 'right' }}>Details</div>
      </div>

      {flattenedData.map((item, i) => {
        const uniqueId = `${item.gradeId}_${item.sectionId || 'nosection'}`;
        const isOpen = openId === uniqueId;
        const subjectsKey = `${item.gradeId}_${item.sectionId}`;
        const subjects = subjectsData[subjectsKey] || [];
        const isLoading = loadingSubjects[subjectsKey];

        if (isOpen && item.sectionId && !subjectsData[subjectsKey] && !loadingSubjects[subjectsKey]) {
          fetchSubjects(item.gradeId, item.sectionId);
        }

        return (
          <div key={uniqueId} className="class-row-wrap">
            <div
              className={`class-row${isOpen ? ' open' : ''}`}
              onClick={() => setOpenId(isOpen ? null : uniqueId)}
            >
              <div className="td sno">
                <span className="sno-hash">#</span> {i + 1}
              </div>
              <div className="td cls-name">
                <div className="cls-icon"><i className="fa-solid fa-code"></i></div>
                {item.gradeName}
              </div>
              <div className="td">
                {item.sectionName ? (
                  <span className="section-pill" style={{ background: 'rgba(30,58,138,.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>
                    {item.sectionName}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No sections
                  </span>
                )}
              </div>

              <div className="td inline-export" onClick={e => e.stopPropagation()}>
                {canTbDownload && (<>
                <Tooltip text={`Download textbook list for ${item.gradeName} - Section ${item.sectionName} as PDF`}>
                  <button className="export-btn pdf" onClick={async (e) => {
                    e.stopPropagation();
                    const key = `${item.gradeId}_${item.sectionId}`;
                    const subs = subjectsData[key] && subjectsData[key].length > 0
                      ? subjectsData[key]
                      : await fetchSubjects(item.gradeId, item.sectionId);
                    onReport(`${item.gradeName} - Section ${item.sectionName}`, 'pdf', subs || []);
                  }}>
                    <i className="fa-solid fa-file-pdf"></i> PDF
                  </button>
                </Tooltip>
                <Tooltip text={`Download textbook list for ${item.gradeName} - Section ${item.sectionName} as Word`}>
                  <button className="export-btn word" onClick={async (e) => {
                    e.stopPropagation();
                    const key = `${item.gradeId}_${item.sectionId}`;
                    const subs = subjectsData[key] && subjectsData[key].length > 0
                      ? subjectsData[key]
                      : await fetchSubjects(item.gradeId, item.sectionId);
                    onReport(`${item.gradeName} - Section ${item.sectionName}`, 'word', subs || []);
                  }}>
                    <i className="fa-brands fa-microsoft"></i> Word
                  </button>
                </Tooltip>
                </>)}
              </div>

              <div className="td" style={{ justifyContent: 'flex-end', paddingLeft: 0 }}>
                <Tooltip text={isOpen ? 'Hide textbook details' : 'Show textbook details'}>
                  <button className={`expand-btn${isOpen ? ' open' : ''}`} aria-label={isOpen ? 'Hide textbook details' : 'Show textbook details'}>
                    <i className="fa-solid fa-chevron-down"></i>
                  </button>
                </Tooltip>
              </div>
            </div>

            <div className={`class-detail${isOpen ? ' open' : ''}`}>
              <div className="detail-inner">
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-spinner fa-spin"></i> Loading subjects...
                  </div>
                ) : subjects.length > 0 ? (
                  <div className="subject-grid">
                    {subjects.map((s, j) => (
                      <div
                        key={j}
                        className="subject-card"
                        onClick={e => { e.stopPropagation(); toast(`${s.name} — ${s.book || 'No textbook'}`, 'info'); }}
                      >
                        <div className={`subj-icon ${s.color}`}>
                          <i className={`fa-solid ${s.icon}`}></i>
                        </div>
                        <div>
                          <div className="subj-name">{s.name}</div>
                          <div className="subj-book">
                            {s.book || <span style={{ opacity: .5, fontStyle: 'italic' }}>No textbook</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <i className="fa-regular fa-folder-open" style={{ fontSize: '40px', marginBottom: '10px', display: 'block' }}></i>
                    <p>No subjects found for {item.gradeName} - Section {item.sectionName}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════
   ACADEMICS CSS — extracted from the HTML prototype
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   RELEASES FROM HEAD OFFICE — school side. View live academic releases
   shared by the Head Office and manually save selected content into the
   school's own local ERP (Activity Calendar / Lesson Plans / Notebook
   Plans / Resource Library) with class/subject/category mapping.
   Mock/local implementation (no backend yet); duplicate-safe via a saved
   tracker in localStorage. Class/subject dropdowns use the SAME live
   source as the ERP Resource Library (classesData + rlFetchClassSubjects).
   ═══════════════════════════════════════════════════════════════════ */
const HO_NAME = 'Mentor School Head Office';
/* Sentinel used inside HO_RELEASES.selectedSchoolIds to mean "this branch".
   hoVisibleReleases() treats it as always matching the current school so the
   demo sub-release stays visible regardless of the live branchID. */
const HO_THIS_SCHOOL = 'THIS_SCHOOL';
const hoBranchId = () => sessionStorage.getItem('branchID') || '0';

/* Demo releases shared by Head Office. Visibility is filtered below so the
   school only ever sees ACTIVE master releases + ACTIVE subs assigned to it. */
const HO_RELEASES = [
  {
    id: 'MR-2026-001', no: 1, title: 'Release 1', type: 'MASTER_RELEASE',
    releasedBy: HO_NAME, releasedOn: '2026-06-26', validUntil: '2026-07-26', status: 'ACTIVE',
    appliesToAllSchools: true, selectedSchoolIds: [],
    activities: [
      { id: 'a1', title: 'Annual Science Fair', from: '2026-07-05', to: '2026-07-06', purpose: 'Showcase student science projects.', development: 'Form committees, assign mentors, prepare stalls.', resource: 'Charts, lab equipment, prize kits', status: 'upcoming' },
      { id: 'a2', title: 'Independence Day Assembly', from: '2026-08-14', to: '2026-08-14', purpose: 'Celebrate national day with students.', development: 'Tableau, speeches, flag hoisting.', resource: 'Sound system, flags, stage', status: 'upcoming' },
      { id: 'a3', title: 'Parent–Teacher Meeting', from: '2026-07-20', to: '2026-07-20', purpose: 'Share term progress with parents.', development: 'Schedule slots, prepare report cards.', resource: 'Report cards, meeting hall', status: 'upcoming' },
    ],
    lessonPlans: [
      { id: 'lp1', unitTitle: 'Unit 1 — Nouns & Verbs', lessonTitle: 'Identifying Nouns', hoClass: 'class 1A', hoSubject: 'English', lessonCount: 6, mode: 'Manual' },
      { id: 'lp2', unitTitle: 'Unit 2 — Numbers 1–100', lessonTitle: 'Counting & Place Value', hoClass: 'II-Pre', hoSubject: 'Math', lessonCount: 8, mode: 'AI' },
      { id: 'lp3', unitTitle: 'Unit 1 — Living Things', lessonTitle: 'Plants Around Us', hoClass: 'III-Pre', hoSubject: 'Science', lessonCount: 6, mode: 'Manual' },
    ],
    notebookPlans: [
      { id: 'nb1', unitTitle: 'Unit 1 — Handwriting', questionType: 'Word Sentences', itemCount: 12, hoClass: 'class 1A', hoSubject: 'English' },
      { id: 'nb2', unitTitle: 'Unit 2 — Addition Practice', questionType: 'Fill in the Blanks', itemCount: 15, hoClass: 'II-Pre', hoSubject: 'Math' },
    ],
    resources: [
      { id: 'r1', title: 'English Nouns Worksheet', category: 'worksheet', fileName: 'english-nouns.pdf', description: 'Practice worksheet on common & proper nouns.', hoClass: 'class 1A', hoSubject: 'English' },
      { id: 'r2', title: 'Maths Place-Value Sheet', category: 'worksheet', fileName: 'maths-place-value.pdf', description: 'Place value up to hundreds.', hoClass: 'II-Pre', hoSubject: 'Math' },
      { id: 'r3', title: 'Science Question Paper — Term 1', category: 'qpaper', fileName: 'science-term1-qp.pdf', description: 'Term 1 sample question paper.', hoClass: 'III-Pre', hoSubject: 'Science' },
    ],
  },
  {
    id: 'MR-2026-002', no: 2, title: 'Release 2', type: 'MASTER_RELEASE',
    releasedBy: HO_NAME, releasedOn: '2026-06-20', validUntil: '2026-08-20', status: 'ACTIVE',
    appliesToAllSchools: true, selectedSchoolIds: [],
    activities: [
      { id: 'a4', title: 'Sports Gala', from: '2026-09-10', to: '2026-09-12', purpose: 'Promote physical fitness & teamwork.', development: 'House teams, track events, medals.', resource: 'Ground, medals, refreshments', status: 'upcoming' },
    ],
    lessonPlans: [
      { id: 'lp4', unitTitle: 'Unit 3 — Reading Comprehension', lessonTitle: 'Short Stories', hoClass: 'I', hoSubject: 'English', lessonCount: 5, mode: 'Manual' },
    ],
    notebookPlans: [
      { id: 'nb3', unitTitle: 'Unit 1 — Urdu Imla', questionType: 'Two Words', itemCount: 10, hoClass: 'III-Pre', hoSubject: 'Urdu' },
    ],
    resources: [
      { id: 'r4', title: 'Summer Pack — Urdu', category: 'summer', fileName: 'urdu-summer.pdf', description: 'Holiday assignment booklet for Urdu.', hoClass: 'III-Pre', hoSubject: 'Urdu' },
      { id: 'r5', title: 'Reference Notes — Physics', category: 'other', fileName: 'physics-notes.pdf', description: 'Quick revision notes.', hoClass: '11', hoSubject: 'Physics' },
    ],
  },
  {
    id: 'SR-2026-001', no: 3, title: 'Release 3', type: 'SUB_RELEASE',
    releasedBy: HO_NAME, releasedOn: '2026-06-24', validUntil: '2026-07-24', status: 'ACTIVE',
    appliesToAllSchools: false, selectedSchoolIds: [HO_THIS_SCHOOL, 'SCHOOL-004'],
    activities: [
      { id: 'a5', title: 'Remedial Class Drive (Selected Schools)', from: '2026-07-01', to: '2026-07-15', purpose: 'Extra support for weak students.', development: 'Identify students, extra periods.', resource: 'Worksheets, evaluation sheets', status: 'ongoing' },
    ],
    lessonPlans: [
      { id: 'lp5', unitTitle: 'Unit 2 — Chemistry Basics', lessonTitle: 'States of Matter', hoClass: '11', hoSubject: 'Chemistry', lessonCount: 4, mode: 'AI' },
    ],
    notebookPlans: [],
    resources: [
      { id: 'r6', title: 'Missed Question Paper — Chemistry', category: 'qpaper', fileName: 'chemistry-missed-qp.pdf', description: 'Additional question paper for selected schools.', hoClass: '11', hoSubject: 'Chemistry' },
    ],
  },
  /* Filtered out (demonstrate visibility logic): sub for OTHER schools + an expired master. */
  {
    id: 'SR-2026-002', no: 99, title: 'Sub Release (Other Schools)', type: 'SUB_RELEASE',
    releasedBy: HO_NAME, releasedOn: '2026-06-22', validUntil: '2026-07-30', status: 'ACTIVE',
    appliesToAllSchools: false, selectedSchoolIds: ['SCHOOL-002', 'SCHOOL-003'],
    activities: [], lessonPlans: [], notebookPlans: [], resources: [],
  },
  {
    id: 'MR-2025-009', no: 98, title: 'Expired Release', type: 'MASTER_RELEASE',
    releasedBy: HO_NAME, releasedOn: '2025-12-01', validUntil: '2025-12-31', status: 'ACTIVE',
    appliesToAllSchools: true, selectedSchoolIds: [],
    activities: [], lessonPlans: [], notebookPlans: [], resources: [],
  },
];

const hoDaysRemaining = validUntil => { try { const ms = new Date(`${validUntil}T23:59:59`) - new Date(); return Math.ceil(ms / 86400000); } catch { return null; } };
const hoIsLive = r => r.status === 'ACTIVE' && hoDaysRemaining(r.validUntil) >= 0;
/* Only ACTIVE master releases + ACTIVE subs assigned to THIS school, not expired/revoked/draft. */
const hoVisibleReleases = () => HO_RELEASES.filter(r => hoIsLive(r) && (r.appliesToAllSchools || (r.selectedSchoolIds || []).includes(HO_THIS_SCHOOL)));
const hoSummary = r => ({
  activities: r.activities.length,
  lessons: r.lessonPlans.reduce((n, lp) => n + (lp.lessonCount || 1), 0),
  notebooks: r.notebookPlans.length,
  resources: r.resources.length,
});

/* Saved-items tracker — duplicate prevention + Saved badges (localStorage). */
const HO_SAVED_KEY = 'sm_ho_saved_items';
const hoLoadSaved = () => { try { const d = JSON.parse(localStorage.getItem(HO_SAVED_KEY)); if (Array.isArray(d)) return d; } catch { /* empty */ } return []; };
const hoSaveSaved = list => { try { localStorage.setItem(HO_SAVED_KEY, JSON.stringify(list)); } catch { /* ignore */ } };
/* Local imported stores (the school's own copy) — mock/local, no backend.
   Lesson/Notebook plans have no live ERP store yet, so they stay localStorage.
   Resources mirror the Resource Library row shape under a branch-scoped key. */
const HO_LP_KEY = 'sm_local_lesson_plans';
const HO_NB_KEY = 'sm_local_notebook_plans';
const hoResKey = () => `sm_resource_library_${hoBranchId()}`;
const hoLoadList = key => { try { const d = JSON.parse(localStorage.getItem(key)); if (Array.isArray(d)) return d; } catch { /* empty */ } return []; };
const hoPushList = (key, rec) => { const l = hoLoadList(key); l.unshift(rec); try { localStorage.setItem(key, JSON.stringify(l)); } catch { /* ignore */ } };

function HeadOfficeReleases({ open, onClose, toast, classesData = [], addActivity }) {
  const [saved, setSaved] = useState(hoLoadSaved);
  const [detail, setDetail] = useState(null); // release object
  const releases = useMemo(() => hoVisibleReleases(), []);

  const isSaved = (relId, itemId) => saved.some(s => s.headOfficeReleaseId === relId && s.headOfficeItemId === itemId);
  const record = rec => { const next = [...saved, rec]; setSaved(next); hoSaveSaved(next); };

  const saveActivity = (rel, act) => {
    if (isSaved(rel.id, act.id)) return;
    addActivity({
      id: `ho-${rel.id}-${act.id}`,
      name: act.title,
      start: act.from ? new Date(act.from).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD',
      end: act.to ? new Date(act.to).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD',
      color: '#1E40AF', status: act.status || 'upcoming',
      purpose: act.purpose, development: act.development, resource: act.resource,
    });
    record({ headOfficeReleaseId: rel.id, headOfficeItemId: act.id, itemType: 'ACTIVITY', savedToSchoolId: hoBranchId(), savedAt: new Date().toISOString(), savedBy: 'School', localTargetModule: 'ACTIVITY_CALENDAR', localClassId: null, localSubjectId: null, localCategory: null });
    toast('Activity saved to your Activity Calendar', 'success');
  };

  const saveLessonPlan = (rel, lp, classId, subjectName) => {
    if (isSaved(rel.id, lp.id)) return;
    const cls = classesData.find(c => String(c.id) === String(classId));
    hoPushList(HO_LP_KEY, { id: `ho-${rel.id}-${lp.id}`, classId: Number(classId), className: cls ? cls.name : '', subjectName, unitTitle: lp.unitTitle, lessonTitle: lp.lessonTitle, lessonCount: lp.lessonCount, mode: lp.mode, source: 'HEAD_OFFICE', hoReleaseId: rel.id, hoItemId: lp.id, savedAt: new Date().toISOString() });
    record({ headOfficeReleaseId: rel.id, headOfficeItemId: lp.id, itemType: 'LESSON_PLAN', savedToSchoolId: hoBranchId(), savedAt: new Date().toISOString(), savedBy: 'School', localTargetModule: 'LESSON_PLANS', localClassId: classId, localSubjectId: subjectName, localCategory: null });
    toast('Lesson plan saved to your portal.', 'success');
  };

  const saveNotebookPlan = (rel, nb, classId, subjectName) => {
    if (isSaved(rel.id, nb.id)) return;
    const cls = classesData.find(c => String(c.id) === String(classId));
    hoPushList(HO_NB_KEY, { id: `ho-${rel.id}-${nb.id}`, classId: Number(classId), className: cls ? cls.name : '', subjectName, unitTitle: nb.unitTitle, questionType: nb.questionType, itemCount: nb.itemCount, source: 'HEAD_OFFICE', hoReleaseId: rel.id, hoItemId: nb.id, savedAt: new Date().toISOString() });
    record({ headOfficeReleaseId: rel.id, headOfficeItemId: nb.id, itemType: 'NOTEBOOK_PLAN', savedToSchoolId: hoBranchId(), savedAt: new Date().toISOString(), savedBy: 'School', localTargetModule: 'NOTEBOOK_PLANS', localClassId: classId, localSubjectId: subjectName, localCategory: null });
    toast('Notebook plan saved to your portal.', 'success');
  };

  const saveResource = (rel, res, classId, subjectName, category) => {
    if (isSaved(rel.id, res.id)) return;
    const cls = classesData.find(c => String(c.id) === String(classId));
    const now = new Date().toISOString();
    const key = hoResKey();
    const list = hoLoadList(key);
    const nextId = list.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
    list.unshift({ id: nextId, branchId: hoBranchId(), classId: Number(classId), className: cls ? cls.name : '', subjectName, category, title: res.title, description: res.description || '', fileName: res.fileName || '', fileUrl: res.fileUrl || '', fileType: 'application/pdf', uploadedBy: 'Head Office Import', uploadedAt: now, createdAt: now, updatedAt: now, source: 'HEAD_OFFICE' });
    try { localStorage.setItem(key, JSON.stringify(list)); } catch { /* ignore */ }
    record({ headOfficeReleaseId: rel.id, headOfficeItemId: res.id, itemType: 'RESOURCE', savedToSchoolId: hoBranchId(), savedAt: new Date().toISOString(), savedBy: 'School', localTargetModule: 'RESOURCE_LIBRARY', localClassId: classId, localSubjectId: subjectName, localCategory: category });
    toast('Resource saved to your Resource Library', 'success');
  };

  if (!open) return null;
  return (
    <div className="ho-screen">
      <div className="ho-screen-head">
        <div className="ho-screen-head-left">
          <div className="ho-screen-icon"><i className="fa-solid fa-cloud-arrow-down"></i></div>
          <div>
            <div className="ho-screen-title">Releases from Head Office</div>
            <div className="ho-screen-sub">Academic content shared by {HO_NAME} for your school.</div>
          </div>
        </div>
        <Tooltip text="Close"><button className="ho-screen-close" onClick={onClose} aria-label="Close releases"><i className="fa-solid fa-xmark"></i></button></Tooltip>
      </div>

      <div className="ho-screen-body">
        {releases.length === 0 ? (
          <div className="section-card rl-empty">
            <div className="rl-empty-icon"><i className="fa-solid fa-inbox"></i></div>
            <div className="rl-empty-title">No live releases from Head Office</div>
            <div className="rl-empty-sub">There are currently no academic releases available from {HO_NAME}.</div>
          </div>
        ) : (
          <div className="ho-rel-grid">
            {releases.map(r => {
              const s = hoSummary(r);
              const days = hoDaysRemaining(r.validUntil);
              const isSub = r.type === 'SUB_RELEASE';
              return (
                <div className={`ho-rel-card ${isSub ? 'sub' : 'master'}`} key={r.id}>
                  <div className="ho-rel-card-top">
                    <div>
                      <div className="ho-rel-card-name">{r.title}</div>
                      <span className={`ho-type-badge ${isSub ? 'sub' : 'master'}`}><i className={`fa-solid ${isSub ? 'fa-code-branch' : 'fa-globe'}`}></i> {isSub ? 'Sub Release' : 'Master Release'}</span>
                    </div>
                    <span className="ho-live-badge"><i className="fa-solid fa-circle" style={{ fontSize: 6 }}></i> Live</span>
                  </div>
                  <div className="ho-rel-by"><i className="fa-solid fa-building-columns"></i> Released by {r.releasedBy}</div>
                  <div className="ho-rel-dates">
                    <div><span>Released on</span><strong>{rlFmtDate(r.releasedOn)}</strong></div>
                    <div><span>Valid until</span><strong>{rlFmtDate(r.validUntil)}</strong></div>
                    <div><span>Days left</span><strong className="ho-days">{days} {days === 1 ? 'day' : 'days'}</strong></div>
                  </div>
                  <div className="ho-rel-inc">Includes</div>
                  <div className="ho-rel-chips">
                    <span><i className="fa-solid fa-calendar-week"></i> {s.activities} Activities</span>
                    <span><i className="fa-solid fa-list-ul"></i> {s.lessons} Lesson Plans</span>
                    <span><i className="fa-solid fa-book-open"></i> {s.notebooks} Notebook Plans</span>
                    <span><i className="fa-solid fa-folder-open"></i> {s.resources} Resource Files</span>
                  </div>
                  <button className="btn btn-primary ho-rel-view" onClick={() => setDetail(r)}><i className="fa-solid fa-eye"></i> View Details</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detail && (
        <ReleaseDetailsModal
          release={detail}
          classesData={classesData}
          onClose={() => setDetail(null)}
          isSaved={isSaved}
          onSaveActivity={saveActivity}
          onSaveLessonPlan={saveLessonPlan}
          onSaveNotebookPlan={saveNotebookPlan}
          onSaveResource={saveResource}
          toast={toast}
        />
      )}
    </div>
  );
}

function ReleaseDetailsModal({ release: r, classesData = [], onClose, isSaved, onSaveActivity, onSaveLessonPlan, onSaveNotebookPlan, onSaveResource, toast }) {
  const [tab, setTab] = useState('activities');
  const [mapping, setMapping] = useState(null); // { kind, item }
  const [preview, setPreview] = useState(null); // { kind, item }
  const s = hoSummary(r);

  const SavedBadge = () => <span className="ho-saved-badge"><i className="fa-solid fa-circle-check"></i> Saved</span>;

  const saveAllActivities = () => {
    const pending = r.activities.filter(a => !isSaved(r.id, a.id));
    if (!pending.length) { toast('All activities already saved', 'info'); return; }
    pending.forEach(a => onSaveActivity(r, a));
  };

  const TABS = [
    { key: 'activities', label: 'Activities', icon: 'fa-calendar-week', n: s.activities },
    { key: 'lessons', label: 'Lesson Plans', icon: 'fa-list-ul', n: r.lessonPlans.length },
    { key: 'notebooks', label: 'Notebook Plans', icon: 'fa-book-open', n: r.notebookPlans.length },
    { key: 'resources', label: 'Resource Library', icon: 'fa-folder-open', n: s.resources },
  ];

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal ho-detail-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-box-open" style={{ marginRight: 8 }}></i> Release Details — {r.title}</div>
            <div className="modal-sub">Review content shared by {HO_NAME} and save it to your school portal.</div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="modal-body">
          {/* summary cards */}
          <div className="ho-sum-grid">
            <div className="ho-sum" style={{ '--accent': '#1E40AF' }}><i className="fa-solid fa-calendar-week"></i><div><div className="ho-sum-v">{s.activities}</div><div className="ho-sum-l">Activities</div></div></div>
            <div className="ho-sum" style={{ '--accent': '#16A34A' }}><i className="fa-solid fa-list-ul"></i><div><div className="ho-sum-v">{s.lessons}</div><div className="ho-sum-l">Lesson Plans</div></div></div>
            <div className="ho-sum" style={{ '--accent': '#7C3AED' }}><i className="fa-solid fa-book-open"></i><div><div className="ho-sum-v">{s.notebooks}</div><div className="ho-sum-l">Notebook Plans</div></div></div>
            <div className="ho-sum" style={{ '--accent': '#D97706' }}><i className="fa-solid fa-folder-open"></i><div><div className="ho-sum-v">{s.resources}</div><div className="ho-sum-l">Resource Files</div></div></div>
          </div>

          {/* section tabs */}
          <div className="ho-sec-tabs">
            {TABS.map(t => (
              <button key={t.key} className={`ho-sec-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                <i className={`fa-solid ${t.icon}`}></i> {t.label} <span className="ho-sec-n">{t.n}</span>
              </button>
            ))}
          </div>

          {/* ── Activities ── */}
          {tab === 'activities' && (
            <div className="ho-sec">
              {r.activities.length === 0 ? <div className="ho-none">No activities in this release.</div> : (
                <>
                  <div className="ho-sec-bar">
                    <span>{r.activities.length} activities — general, no class/subject needed.</span>
                    <button className="btn btn-secondary ho-saveall" onClick={saveAllActivities}><i className="fa-solid fa-layer-group"></i> Save All Activities</button>
                  </div>
                  {r.activities.map(a => {
                    const done = isSaved(r.id, a.id);
                    return (
                      <div className="ho-item" key={a.id}>
                        <div className="ho-item-main">
                          <div className="ho-item-title">{a.title}</div>
                          <div className="ho-item-meta">
                            <span><i className="fa-regular fa-calendar"></i> {rlFmtDate(a.from)} → {rlFmtDate(a.to)}</span>
                            {a.status && <span className="ho-item-tag">{a.status}</span>}
                          </div>
                          {a.purpose && <div className="ho-item-line"><b>Purpose:</b> {a.purpose}</div>}
                          {a.development && <div className="ho-item-line"><b>Development:</b> {a.development}</div>}
                          {a.resource && <div className="ho-item-line"><b>Resources:</b> {a.resource}</div>}
                        </div>
                        <div className="ho-item-actions">
                          {done ? <SavedBadge /> : <button className="btn btn-primary ho-save-btn" onClick={() => onSaveActivity(r, a)}><i className="fa-solid fa-calendar-plus"></i> Save to Activity Calendar</button>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Lesson Plans ── */}
          {tab === 'lessons' && (
            <div className="ho-sec">
              {r.lessonPlans.length === 0 ? <div className="ho-none">No lesson plans in this release.</div> : r.lessonPlans.map(lp => {
                const done = isSaved(r.id, lp.id);
                return (
                  <div className="ho-item" key={lp.id}>
                    <div className="ho-item-main">
                      <div className="ho-item-title">{lp.unitTitle}</div>
                      <div className="ho-item-sub">{lp.lessonTitle}</div>
                      <div className="ho-item-meta">
                        <span><i className="fa-solid fa-chalkboard"></i> {lp.hoClass}</span>
                        <span><i className="fa-solid fa-book"></i> {lp.hoSubject}</span>
                        <span><i className="fa-solid fa-list-ol"></i> {lp.lessonCount} lessons</span>
                        {lp.mode && <span className="ho-item-tag">{lp.mode}</span>}
                      </div>
                    </div>
                    <div className="ho-item-actions">
                      <button className="rl-act" onClick={() => setPreview({ kind: 'lesson', item: lp })}><i className="fa-solid fa-eye"></i> View Preview</button>
                      {done ? <SavedBadge /> : <button className="btn btn-primary ho-save-btn" onClick={() => setMapping({ kind: 'lesson', item: lp })}><i className="fa-solid fa-download"></i> Save to Portal</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Notebook Plans ── */}
          {tab === 'notebooks' && (
            <div className="ho-sec">
              {r.notebookPlans.length === 0 ? <div className="ho-none">No notebook plans in this release.</div> : r.notebookPlans.map(nb => {
                const done = isSaved(r.id, nb.id);
                return (
                  <div className="ho-item" key={nb.id}>
                    <div className="ho-item-main">
                      <div className="ho-item-title">{nb.unitTitle}</div>
                      <div className="ho-item-meta">
                        <span className="ho-item-tag">{nb.questionType}</span>
                        <span><i className="fa-solid fa-list-ol"></i> {nb.itemCount} questions</span>
                        <span><i className="fa-solid fa-chalkboard"></i> {nb.hoClass}</span>
                        <span><i className="fa-solid fa-book"></i> {nb.hoSubject}</span>
                      </div>
                    </div>
                    <div className="ho-item-actions">
                      <button className="rl-act" onClick={() => setPreview({ kind: 'notebook', item: nb })}><i className="fa-solid fa-eye"></i> View Preview</button>
                      {done ? <SavedBadge /> : <button className="btn btn-primary ho-save-btn" onClick={() => setMapping({ kind: 'notebook', item: nb })}><i className="fa-solid fa-download"></i> Save to Portal</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Resource Library ── */}
          {tab === 'resources' && (
            <div className="ho-sec">
              {r.resources.length === 0 ? <div className="ho-none">No resources in this release.</div> : r.resources.map(res => {
                const done = isSaved(r.id, res.id);
                const cat = rlCat(res.category);
                return (
                  <div className="ho-item" key={res.id}>
                    <div className="ho-item-main">
                      <div className="ho-item-title">{res.title} <span className="rl-badge" style={{ background: cat.color + '14', color: cat.color }}>{cat.label}</span></div>
                      {res.description && <div className="ho-item-sub">{res.description}</div>}
                      <div className="ho-item-meta">
                        <span><i className="fa-solid fa-file-pdf"></i> {res.fileName}</span>
                        <span><i className="fa-solid fa-chalkboard"></i> {res.hoClass}</span>
                        <span><i className="fa-solid fa-book"></i> {res.hoSubject}</span>
                      </div>
                    </div>
                    <div className="ho-item-actions">
                      <button className="rl-act" onClick={() => setPreview({ kind: 'resource', item: res })}><i className="fa-solid fa-eye"></i> View</button>
                      <button className="rl-act" onClick={() => res.fileUrl ? window.open(res.fileUrl, '_blank') : toast('Demo file — no PDF attached', 'info')}><i className="fa-solid fa-download"></i> Download</button>
                      {done ? <SavedBadge /> : <button className="btn btn-primary ho-save-btn" onClick={() => setMapping({ kind: 'resource', item: res })}><i className="fa-solid fa-download"></i> Save to Portal</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Tooltip text="Close"><button className="btn btn-secondary" onClick={onClose}>Close</button></Tooltip>
        </div>
      </div>

      {mapping && (
        <SaveMappingModal
          kind={mapping.kind}
          item={mapping.item}
          classesData={classesData}
          onClose={() => setMapping(null)}
          onSave={(classId, subjectName, category) => {
            if (mapping.kind === 'lesson') onSaveLessonPlan(r, mapping.item, classId, subjectName);
            else if (mapping.kind === 'notebook') onSaveNotebookPlan(r, mapping.item, classId, subjectName);
            else onSaveResource(r, mapping.item, classId, subjectName, category);
            setMapping(null);
          }}
        />
      )}

      {preview && <PreviewModal kind={preview.kind} item={preview.item} onClose={() => setPreview(null)} />}
    </div>
  );
}

function SaveMappingModal({ kind, item, classesData = [], onClose, onSave }) {
  const isResource = kind === 'resource';
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [subjLoading, setSubjLoading] = useState(false);
  const [category, setCategory] = useState(isResource ? (item.category || 'worksheet') : '');
  const [err, setErr] = useState('');

  /* Class chunte hi us class ke subjects (pehli section se) live laao — wahi
     source jo ERP Resource Library modal use karta hai (rlFetchClassSubjects). */
  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(''); return undefined; }
    const cls = classesData.find(c => String(c.id) === String(classId));
    const sectionId = cls?.sections?.[0]?.sectionID;
    let alive = true;
    setSubjLoading(true);
    rlFetchClassSubjects(classId, sectionId)
      .then(subs => {
        if (!alive) return;
        setSubjects(subs);
        setSubjectId(cur => (subs.some(x => String(x.id) === String(cur)) ? cur : ''));
      })
      .finally(() => { if (alive) setSubjLoading(false); });
    return () => { alive = false; };
  }, [classId, classesData]);

  const title = kind === 'lesson' ? 'Save Lesson Plan to Portal' : kind === 'notebook' ? 'Save Notebook Plan to Portal' : 'Save Resource to Portal';
  const btn = kind === 'lesson' ? 'Save Lesson Plan' : kind === 'notebook' ? 'Save Notebook Plan' : 'Save Resource';

  const submit = () => {
    if (!classId) { setErr('Please select a class.'); return; }
    if (!subjectId) { setErr('Please select a subject.'); return; }
    if (isResource && !category) { setErr('Please select a category.'); return; }
    const sub = subjects.find(x => String(x.id) === String(subjectId));
    onSave(classId, sub ? sub.name : '', category);
  };

  return (
    <div className="modal-overlay open" style={{ zIndex: 10050 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-download" style={{ marginRight: 8 }}></i> {title}</div>
            <div className="modal-sub">Choose where this should be saved in your school portal.</div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="modal-body">
          <div className="ho-map-from"><i className="fa-solid fa-building-columns"></i> Head Office: <strong>{item.hoClass || '—'}</strong> · <strong>{item.hoSubject || '—'}</strong></div>
          <div className="form-group">
            <label className="form-label">Select Class <span className="req-star">*</span></label>
            <select className="form-input" value={classId} onChange={e => { setClassId(e.target.value); setSubjectId(''); }}>
              <option value="">Select class</option>
              {classesData.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Select Subject <span className="req-star">*</span></label>
            <select className="form-input" value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!classId || subjLoading}>
              <option value="">{!classId ? 'Select class first' : (subjLoading ? 'Loading subjects…' : (subjects.length ? 'Select subject' : 'No subjects in this class'))}</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {isResource && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Select Category <span className="req-star">*</span></label>
              <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                {RL_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          )}
          {err && <div className="rl-err"><i className="fa-solid fa-circle-exclamation"></i> {err}</div>}
        </div>
        <div className="modal-footer">
          <Tooltip text="Cancel"><button className="btn btn-secondary" onClick={onClose}>Cancel</button></Tooltip>
          <Tooltip text="Save to your portal"><button className="btn btn-primary" onClick={submit}><i className="fa-solid fa-floppy-disk"></i> {btn}</button></Tooltip>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ kind, item, onClose }) {
  return (
    <div className="modal-overlay open" style={{ zIndex: 10050 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="fa-solid fa-eye" style={{ marginRight: 8 }}></i> Preview</div>
            <div className="modal-sub">Read-only preview from {HO_NAME}</div>
          </div>
          <Tooltip text="Close"><button className="modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
        </div>
        <div className="modal-body">
          {kind === 'lesson' && (
            <div className="ho-prev">
              <div className="ho-prev-row"><span>Unit</span><strong>{item.unitTitle}</strong></div>
              <div className="ho-prev-row"><span>Lesson</span><strong>{item.lessonTitle}</strong></div>
              <div className="ho-prev-row"><span>Class</span><strong>{item.hoClass}</strong></div>
              <div className="ho-prev-row"><span>Subject</span><strong>{item.hoSubject}</strong></div>
              <div className="ho-prev-row"><span>Lessons</span><strong>{item.lessonCount}</strong></div>
              <div className="ho-prev-row"><span>Mode</span><strong>{item.mode}</strong></div>
            </div>
          )}
          {kind === 'notebook' && (
            <div className="ho-prev">
              <div className="ho-prev-row"><span>Unit</span><strong>{item.unitTitle}</strong></div>
              <div className="ho-prev-row"><span>Question Type</span><strong>{item.questionType}</strong></div>
              <div className="ho-prev-row"><span>Questions</span><strong>{item.itemCount}</strong></div>
              <div className="ho-prev-row"><span>Class</span><strong>{item.hoClass}</strong></div>
              <div className="ho-prev-row"><span>Subject</span><strong>{item.hoSubject}</strong></div>
            </div>
          )}
          {kind === 'resource' && (
            <div className="ho-prev">
              <div className="ho-prev-row"><span>Title</span><strong>{item.title}</strong></div>
              <div className="ho-prev-row"><span>Category</span><strong>{rlCat(item.category).label}</strong></div>
              <div className="ho-prev-row"><span>File</span><strong>{item.fileName}</strong></div>
              <div className="ho-prev-row"><span>Class</span><strong>{item.hoClass}</strong></div>
              <div className="ho-prev-row"><span>Subject</span><strong>{item.hoSubject}</strong></div>
              {item.description && <div className="ho-prev-desc">{item.description}</div>}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Tooltip text="Close"><button className="btn btn-secondary" onClick={onClose}>Close</button></Tooltip>
        </div>
      </div>
    </div>
  );
}


const ACADEMICS_CSS = `
/* ── Page header tutorial button (uses existing .tutorial-btn from App.js CSS) ── */
.page-tutorial-btn { flex-shrink: 0; }

/* ── L1 TABS ── */
/* Teenon tabs (Scheme of Studies · Lesson Plans · Resource Library) aik hi
   row me, barabar chaurai ke. grid-template-columns fix nahi kiya jata: har
   tab View permission ke hisaab se dikhta hai (showSos/showLp/showRl), is
   liye 1, 2 ya 3 — jitne bhi render hon, auto-flow unhe khud barabar baant
   deta hai. Pehle yahan do columns fix the, is liye teesra tab (Resource
   Library) toot kar dusri line par chala jata tha.
   NOTE: ye poora CSS aik template literal ke andar hai — yahan comments me
   backtick mat likhna, wo literal ko wahin khatam kar deta hai. */
.l1-tabs {
  display:grid; grid-auto-flow:column; grid-auto-columns:1fr;
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg);
  padding:5px; margin-bottom:20px;
  box-shadow:var(--shadow-sm); gap:4px;
}
.l1-tab {
  padding:11px 18px; text-align:center; cursor:pointer;
  font-size:13px; font-weight:600; transition:var(--tr);
  background:transparent; color:var(--text-muted);
  border:none; font-family:var(--font-body);
  border-radius:var(--radius-md);
  display:flex; align-items:center; justify-content:center; gap:7px;
  position:relative; overflow:hidden;
}
.l1-tab:hover:not(.active) {
  background:var(--bg-muted); color:var(--text-primary);
}
.l1-tab.active {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color:#fff;
  box-shadow:0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}
.l1-tab-icon {
  width:22px; height:22px; border-radius:6px;
  display:flex; align-items:center; justify-content:center;
  font-size:11px; transition:all .25s ease; flex-shrink:0;
}
.l1-tab.active .l1-tab-icon { background:rgba(255,255,255,.18); color:#fff; }
.l1-tab:hover:not(.active) .l1-tab-icon { background:rgba(30,58,138,.08); color:var(--brand-primary); }
.l1-tab:not(.active):not(:hover) .l1-tab-icon { background:rgba(0,0,0,.05); color:var(--text-muted); }

/* ── L2 TABS ── */
.l2-tabs {
  display:flex; background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg);
  overflow:hidden; margin-bottom:20px;
  box-shadow:var(--shadow-sm);
}
.l2-tab {
  flex:1; padding:12px 18px; text-align:center; cursor:pointer;
  font-size:13px; font-weight:600; transition:all .2s ease;
  background:transparent; color:var(--text-muted);
  border:none; font-family:var(--font-body);
  display:flex; align-items:center; justify-content:center; gap:8px;
  position:relative;
}
.l2-tab::after {
  content:''; position:absolute; bottom:0; left:12%; right:12%; height:3px;
  border-radius:3px 3px 0 0; background:var(--brand-primary);
  transform:scaleX(0); transition:transform .25s cubic-bezier(.4,0,.2,1);
}
.l2-tab:not(:last-child) { border-right:1.5px solid var(--border-light); }
.l2-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
.l2-tab.active {
  color:var(--brand-primary); font-weight:700;
  background:linear-gradient(180deg,transparent,rgba(30,58,138,.04));
}
.l2-tab.active::after { transform:scaleX(1); }
.l2-tab-dot {
  width:7px; height:7px; border-radius:50%;
  background:var(--brand-primary); opacity:0;
  transition:opacity .2s ease; flex-shrink:0;
}
.l2-tab.active .l2-tab-dot { opacity:1; animation:pulse-dot 2s infinite; }
@keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }

/* ── L3 TABS ── */
.l3-tabs { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
.l3-tab {
  padding:12px 18px; cursor:pointer;
  font-size:13px; font-weight:600; transition:all .22s cubic-bezier(.4,0,.2,1);
  background:var(--bg-card); color:var(--text-muted);
  border:1.5px solid var(--border-light); font-family:var(--font-body);
  border-radius:var(--radius-lg);
  display:flex; align-items:center; gap:12px;
  box-shadow:var(--shadow-xs); text-align:left;
}
.l3-tab:hover:not(.active) {
  border-color:var(--border-med); background:var(--bg-muted);
  color:var(--text-primary);
}
.l3-tab.active {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  border-color:transparent; color:#fff;
  box-shadow:0 6px 20px rgba(30,58,138,.4), inset 0 1px 0 rgba(255,255,255,.2);
}
.l3-tab-icon {
  width:36px; height:36px; border-radius:10px;
  display:flex; align-items:center; justify-content:center;
  font-size:15px; flex-shrink:0; transition:all .22s ease;
}
.l3-tab.active .l3-tab-icon { background:rgba(255,255,255,.18); color:#fff; }
.l3-tab:hover:not(.active) .l3-tab-icon { background:rgba(30,58,138,.08); color:var(--brand-primary); }
.l3-tab:not(.active):not(:hover) .l3-tab-icon { background:var(--bg-muted); color:var(--text-muted); }
.l3-tab-text { text-align:left; }
.l3-tab-name { font-size:13px; font-weight:700; line-height:1.2; }
.l3-tab-desc { font-size:10.5px; margin-top:2px; opacity:.7; line-height:1.2; }
.l3-tab.active .l3-tab-desc { opacity:.75; }

/* ── Section card ── */
.section-card {
  background:var(--bg-card); border-radius:var(--radius-lg);
  border:1px solid var(--border-light); box-shadow:var(--shadow-sm);
  overflow:hidden; animation:fadeSlide .25s ease both;
}
@keyframes fadeSlide { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }

/* ── Classes table (Text Books) ── */
.table-head {
  display:grid; 
  grid-template-columns: 80px 1.2fr 1fr 220px 80px;
  background:var(--bg-muted); border-bottom:1px solid var(--border-light);
  padding:0 20px;
}
.th {
  padding:11px 10px; font-size:10.5px; font-weight:700;
  color:var(--text-muted); letter-spacing:.6px; text-transform:uppercase;
}
.class-row-wrap { border-bottom:1px solid var(--border-light); }
.class-row-wrap:last-child { border-bottom:none; }
.class-row {
  display:grid;
  grid-template-columns: 80px 1.2fr 1fr 220px 80px;
  padding:0 20px; cursor:pointer; align-items:center;
  transition:var(--tr); min-height:60px;
}
.class-row:hover { background:rgba(30,58,138,.04); }
.class-row.open  { background:var(--bg-muted); }
.td { padding:12px 10px; font-size:13px; color:var(--text-secondary); display:flex; align-items:center; }
.td.sno { color:var(--text-muted); font-weight:600; gap:4px; }
.sno-hash { color:var(--brand-primary); font-size:10px; opacity:.5; }
.td.cls-name { font-weight:700; color:var(--text-primary); gap:8px; }
.cls-icon { width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,#DBEAFE,#BFDBFE);color:#1E40AF;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0; }
.expand-btn {
  width:30px;height:30px;border-radius:8px;
  border:1.5px solid var(--border-light);
  background:var(--bg-card);color:var(--text-muted);
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;font-size:11px;transition:var(--tr);margin-left:auto;
}
.expand-btn:hover { border-color:var(--brand-primary);color:var(--brand-primary); }
.expand-btn.open { transform:rotate(180deg);border-color:var(--brand-primary);color:var(--brand-primary);background:rgba(30,58,138,.05); }

.class-detail {
  background:linear-gradient(135deg,rgba(30,58,138,.02),rgba(30,58,138,.04));
  border-top:1px solid var(--border-light);
  max-height:0; overflow:hidden;
  transition:max-height .4s cubic-bezier(.4,0,.2,1), padding .3s ease;
}
.class-detail.open { max-height:600px; overflow:visible; }
.detail-inner { padding:16px 20px 20px; }

.inline-export { display:flex; gap:6px; align-items:center; }
.export-btn {
  display:flex;align-items:center;gap:5px;
  padding:6px 11px; border-radius:var(--radius-full);
  font-family:var(--font-body);font-size:11px;font-weight:700;
  cursor:pointer; border:none; transition:var(--tr); white-space:nowrap;
}
.export-btn.pdf  { background:linear-gradient(135deg,#EF4444,#DC2626);color:#fff;box-shadow:0 2px 8px rgba(239,68,68,.3); }
.export-btn.word { background:linear-gradient(135deg,#2563EB,#1E40AF);color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.3); }
.export-btn:hover { transform:translateY(-1px); filter:brightness(1.08); }
.export-btn:active { transform:scale(.96); }

.subject-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; }
.subject-card {
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-md); padding:12px 14px;
  display:flex; align-items:center; gap:11px;
  transition:var(--tr); cursor:pointer;
}
.subject-card:hover { border-color:var(--border-med); box-shadow:var(--shadow-sm); transform:translateY(-1px); }
.subj-icon { width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0; }
.subj-name { font-size:13px;font-weight:700;color:var(--text-primary); }
.subj-book { font-size:11px;color:var(--text-muted);margin-top:2px; }
.subj-blue   { background:rgba(30,58,138,.08);color:#1E40AF; }
.subj-teal   { background:rgba(37,99,235,.1);color:#1E40AF; }
.subj-green  { background:rgba(22,163,74,.1);color:#16A34A; }
.subj-amber  { background:rgba(245,158,11,.1);color:#D97706; }
.subj-purple { background:rgba(124,58,237,.1);color:#7C3AED; }
.subj-rose   { background:rgba(244,63,94,.1);color:#E11D48; }

[data-theme="dark"] .class-row:hover { background:rgba(59,130,246,.06); }
[data-theme="dark"] .class-row.open  { background:var(--bg-muted); }
[data-theme="dark"] .class-row-wrap  { border-color:var(--border-light); }
[data-theme="dark"] .cls-icon        { background:rgba(59,130,246,.15); color:#3B82F6; }
[data-theme="dark"] .td.cls-name     { color:#E2E8F8; }
[data-theme="dark"] .expand-btn      { border-color:var(--border-light); background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .expand-btn:hover { border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .class-detail    { background:linear-gradient(135deg,rgba(14,22,40,.6),rgba(19,31,56,.4)); border-color:var(--border-light); }
[data-theme="dark"] .subject-card    { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .subject-card:hover { border-color:var(--border-med); }
[data-theme="dark"] .subj-name       { color:#E2E8F8; }
[data-theme="dark"] .subj-book       { color:var(--text-muted); }
[data-theme="dark"] .table-head      { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .th              { color:var(--text-muted); }

/* ── Term Settings ── */
.ts-stat-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
.ts-stat {
  background:var(--bg-card); border-radius:var(--radius-lg);
  border:1px solid var(--border-light); padding:16px 18px;
  display:flex; align-items:center; gap:13px;
  box-shadow:var(--shadow-sm); position:relative; overflow:hidden;
  transition:var(--tr);
}
.ts-stat:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); }
.ts-stat-bar { position:absolute; left:0; top:0; bottom:0; width:4px; border-radius:0 3px 3px 0; }
.ts-stat-icon {
  width:40px; height:40px; border-radius:11px;
  display:flex; align-items:center; justify-content:center;
  font-size:17px; flex-shrink:0;
}
.ts-stat-val { font-size:22px; font-weight:800; color:var(--text-primary); letter-spacing:-.02em; line-height:1; }
.ts-stat-lbl { font-size:11px; color:var(--text-muted); margin-top:3px; }

.ts-card-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:20px 24px 18px; border-bottom:1px solid var(--border-light);
  background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);
  flex-wrap:wrap; gap:14px;
}
.ts-card-header-left { display:flex; align-items:center; gap:14px; }
.ts-header-icon {
  width:44px; height:44px; border-radius:13px; flex-shrink:0;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-size:18px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 6px 18px rgba(30,58,138,.3);
}
.ts-card-title { font-size:16px; font-weight:800; color:var(--text-primary); letter-spacing:-.01em; }
.ts-card-sub   { font-size:11.5px; color:var(--text-muted); margin-top:2px; max-width:400px; }

.ts-subtab-row {
  display:flex; gap:4px;
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  border-radius:var(--radius-full); padding:4px;
}
.ts-subtab {
  display:flex; align-items:center; gap:7px;
  padding:8px 16px; border-radius:var(--radius-full);
  border:none; background:transparent;
  font-family:var(--font-body); font-size:12.5px; font-weight:600;
  color:var(--text-muted); cursor:pointer; transition:var(--tr);
  white-space:nowrap;
}
.ts-subtab:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
.ts-subtab.active {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; box-shadow:0 3px 10px rgba(30,58,138,.3);
}
.ts-subtab i { font-size:11px; }

.ts-section-body { padding:22px 24px 28px; }
.ts-info-strip {
  display:flex; align-items:flex-start; gap:10px;
  padding:12px 14px; border-radius:var(--radius-md);
  background:rgba(30,58,138,.05); border:1px solid rgba(30,58,138,.15);
  font-size:12.5px; color:#334155; line-height:1.7;
  font-weight:500; word-break:break-word; overflow-wrap:break-word;
}
.ts-info-strip strong { color:var(--brand-primary); font-weight:700; }
.ts-info-strip.warn {
  background:rgba(217,119,6,.06); border-color:rgba(217,119,6,.2); color:#78350F;
}
.ts-info-strip.warn strong { color:#92400E; }
.ts-info-strip i { font-size:13px; flex-shrink:0; margin-top:3px; }

.ts-field-group { display:flex; flex-direction:column; gap:6px; }
.ts-label { font-size:12px; font-weight:700; color:var(--text-secondary); letter-spacing:.2px; }
.ts-input-wrap { position:relative; }
.ts-input-icon {
  position:absolute; left:13px; top:50%; transform:translateY(-50%);
  color:var(--text-muted); font-size:12px; pointer-events:none;
}
.ts-input {
  width:100%; height:44px;
  border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  padding:0 14px 0 38px;
  font-family:var(--font-body); font-size:13px; color:var(--text-primary);
  background:var(--input-bg); outline:none; transition:var(--tr);
}
.ts-input:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.09); }
.ts-select { cursor:pointer; appearance:none; }
.ts-hint { font-size:10.5px; color:var(--text-muted); display:flex; align-items:center; gap:5px; }
.ts-hint i { font-size:10px; color:var(--info); }

.ts-btn-primary {
  display:inline-flex; align-items:center; gap:8px;
  padding:0 22px; height:42px; border-radius:var(--radius-md);
  border:none; cursor:pointer; font-family:var(--font-body);
  font-size:13px; font-weight:700; transition:var(--tr);
  background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  color:#fff; box-shadow:0 4px 14px rgba(30,58,138,.28);
}
.ts-btn-primary:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(30,58,138,.38); }
.ts-btn-ghost {
  display:inline-flex; align-items:center; gap:8px;
  padding:0 18px; height:42px; border-radius:var(--radius-md);
  border:1.5px solid var(--border-light); cursor:pointer;
  font-family:var(--font-body); font-size:13px; font-weight:600;
  background:transparent; color:var(--text-muted); transition:var(--tr);
}
.ts-btn-ghost:hover { background:var(--bg-muted); color:var(--text-primary); }

.ts-table { border:1.5px solid var(--border-light); border-radius:var(--radius-lg); overflow:hidden; }
.ts-table-head {
  display:flex; align-items:center;
  background:var(--bg-muted); padding:0 18px;
  border-bottom:1px solid var(--border-light);
}
.ts-th {
  padding:12px 10px; font-size:10px; font-weight:800;
  color:var(--text-muted); letter-spacing:1px; text-transform:uppercase;
  flex-shrink:0;
}
.ts-row {
  display:flex; align-items:center; flex-wrap:nowrap;
  padding:12px 18px; border-bottom:1px solid var(--border-light);
  background:var(--bg-card); transition:background .15s ease; gap:10px;
  min-width:0;
}
.ts-row:last-child { border-bottom:none; }
.ts-row:hover { background:rgba(30,58,138,.018); }
.ts-num { width:52px; flex-shrink:0; display:flex; align-items:center; }
.ts-num-badge {
  width:34px; height:34px; border-radius:10px;
  background:linear-gradient(135deg,#EFF6FF,#DBEAFE);
  color:var(--brand-primary); font-size:13px; font-weight:800;
  display:flex; align-items:center; justify-content:center;
  border:1px solid #BFDBFE;
}
.ts-cell { padding:0 5px; flex-shrink:0; min-width:0; }
.ts-cell.flex1 { flex:1; padding:0 5px; min-width:0; }
.ts-cell.w160  { width:155px; flex-shrink:0; }
.ts-cell.w100  { width:96px; flex-shrink:0; }

.ts-term-input {
  width:100%; height:40px;
  border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  padding:0 12px; font-family:var(--font-body); font-size:13.5px;
  color:var(--text-primary); background:var(--input-bg);
  outline:none; transition:var(--tr); min-width:0;
}
.ts-term-input:hover { border-color:var(--border-med); }
.ts-term-input:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.08); }
.ts-term-input[type="date"] { cursor:pointer; font-size:13px; padding:0 10px; }
.ts-term-input.new { border-color:rgba(30,58,138,.3); background:rgba(30,58,138,.03); }

.ts-actions { display:flex; gap:7px; align-items:center; flex-shrink:0; justify-content:center; }
.ts-act-btn {
  width:34px; height:34px; border-radius:50%; border:none;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:14px; transition:var(--tr); flex-shrink:0;
  position:relative;
}
.ts-act-btn.save {
  background:rgba(22,163,74,.1); color:#16A34A;
  border:2px solid rgba(22,163,74,.25);
}
.ts-act-btn.save:hover { background:#16A34A; color:#fff; transform:scale(1.1); box-shadow:0 3px 10px rgba(22,163,74,.35); }
.ts-act-btn.del {
  background:rgba(220,38,38,.08); color:#DC2626;
  border:2px solid rgba(220,38,38,.25);
}
.ts-act-btn.del:hover { background:#DC2626; color:#fff; transform:scale(1.1); box-shadow:0 3px 10px rgba(220,38,38,.3); }

.ts-add-row-btn {
  display:flex; align-items:center; gap:14px;
  width:100%; margin-top:14px; padding:16px 20px;
  border:2px dashed var(--border-med); border-radius:var(--radius-lg);
  background:transparent; cursor:pointer; transition:var(--tr);
  font-family:var(--font-body);
}
.ts-add-row-btn:hover { border-color:var(--brand-primary); background:rgba(30,58,138,.03); border-style:solid; }
.ts-add-icon {
  width:36px; height:36px; border-radius:10px; flex-shrink:0;
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-size:14px;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 3px 10px rgba(30,58,138,.3);
  transition:transform .2s ease;
}
.ts-add-row-btn:hover .ts-add-icon { transform:rotate(90deg); }
.ts-add-row-btn > span:first-of-type { font-size:14px; font-weight:700; color:var(--brand-primary); }
.ts-add-hint { font-size:11px; color:var(--text-muted); margin-left:auto; font-style:italic; }

[data-theme="dark"] .ts-stat { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ts-stat-val { color:#E2E8F8; }
[data-theme="dark"] .ts-card-header { background:linear-gradient(135deg,rgba(59,130,246,.04),transparent); border-color:var(--border-light); }
[data-theme="dark"] .ts-card-title { color:#E2E8F8; }
[data-theme="dark"] .ts-card-sub { color:var(--text-muted); }
[data-theme="dark"] .ts-subtab-row { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .ts-subtab { color:var(--text-muted); }
[data-theme="dark"] .ts-subtab:hover:not(.active) { background:var(--bg-card); color:#E2E8F8; }
[data-theme="dark"] .ts-info-strip { background:rgba(59,130,246,.08); border-color:rgba(59,130,246,.2); color:#93C5FD; }
[data-theme="dark"] .ts-info-strip strong { color:#60A5FA; }
[data-theme="dark"] .ts-input { background:var(--input-bg); border-color:var(--border-light); color:#E2E8F8; }
[data-theme="dark"] .ts-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.12); }
[data-theme="dark"] .ts-table { border-color:var(--border-light); }
[data-theme="dark"] .ts-table-head { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .ts-th { color:#4A6080; }
[data-theme="dark"] .ts-row { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .ts-row:hover { background:rgba(59,130,246,.05); }
[data-theme="dark"] .ts-num-badge { background:rgba(59,130,246,.15); color:#3B82F6; border-color:transparent; }
[data-theme="dark"] .ts-term-input { background:var(--input-bg); border-color:var(--border-light); color:#E2E8F8; }
[data-theme="dark"] .ts-add-row-btn { border-color:var(--border-med); color:#3B82F6; }
[data-theme="dark"] .ts-add-row-btn:hover { background:rgba(59,130,246,.1); border-color:#3B82F6; }
[data-theme="dark"] .ts-label { color:#93C5FD; }
[data-theme="dark"] .ts-btn-ghost { border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .ts-btn-ghost:hover { background:var(--bg-muted); color:#E2E8F8; }

/* ── Academic Calendar ── */
.cal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px 14px; border-bottom:1px solid var(--border-light); gap:12px; flex-wrap:nowrap; }
.cal-header-title { font-size:15px; font-weight:800; color:var(--text-primary); }
.cal-edit-btn {
  display:flex; align-items:center; gap:6px;
  padding:7px 14px; border-radius:var(--radius-md);
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  color:var(--text-secondary); font-family:var(--font-body);
  font-size:12px; font-weight:600; cursor:pointer; transition:var(--tr);
}
.cal-edit-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }

.term-section { padding:0 20px 20px; }
.term-label {
  display:flex; align-items:center; gap:10px;
  font-size:11px; font-weight:700; letter-spacing:.8px;
  text-transform:uppercase; color:var(--text-muted);
  padding:18px 0 10px; position:relative;
}
.term-label::after { content:''; flex:1; height:1px; background:var(--border-light); }
.term-label i { color:var(--brand-primary); font-size:12px; }
.key-dates-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; }
.key-date-card {
  background:var(--bg-muted); border:1.5px solid var(--border-light);
  border-radius:var(--radius-md); padding:12px 14px;
  display:flex; align-items:flex-start; gap:10px;
  transition:var(--tr); cursor:pointer;
}
.key-date-card:hover { border-color:var(--border-med); box-shadow:var(--shadow-sm); }
.kd-icon { width:30px; height:30px; border-radius:8px; background:rgba(30,58,138,.08); color:var(--brand-primary); display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; }
.kd-heading { font-size:12.5px; font-weight:700; color:var(--text-primary); }
.kd-date { font-size:11px; color:var(--text-muted); margin-top:2px; }
.no-data { text-align:center; padding:14px; font-size:12px; color:var(--text-muted); opacity:.6; }

/* Cal edit modal */
.cal-modal-section { margin-bottom:24px; }
.cal-modal-term {
  font-size:11px; font-weight:700; letter-spacing:.8px; text-transform:uppercase;
  color:var(--text-muted); text-align:center;
  display:flex; align-items:center; gap:10px; margin-bottom:12px;
}
.cal-modal-term::before, .cal-modal-term::after { content:''; flex:1; height:1px; background:var(--border-light); }
.cal-entry-row { display:grid; grid-template-columns:1fr 1fr auto; gap:8px; padding:8px 0; border-bottom:1px solid var(--border-light); align-items:center; }
.cal-entry-row:last-of-type { border-bottom:none; }
.cal-entry-input {
  height:38px; border:1.5px solid var(--border-light); border-radius:var(--radius-sm);
  padding:0 10px; font-family:var(--font-body); font-size:12.5px;
  color:var(--text-primary); background:var(--input-bg); outline:none;
  transition:var(--tr); width:100%;
}
.cal-entry-input:focus { border-color:var(--brand-primary); box-shadow:0 0 0 3px rgba(30,58,138,.09); }
.remove-btn {
  display:flex; align-items:center; gap:4px;
  padding:5px 10px; border-radius:var(--radius-sm);
  border:1.5px solid rgba(220,38,38,.25); background:rgba(220,38,38,.06);
  color:var(--error); font-family:var(--font-body);
  font-size:11.5px; font-weight:700; cursor:pointer;
  transition:var(--tr); white-space:nowrap;
}
.remove-btn:hover { background:rgba(220,38,38,.12); border-color:var(--error); }
.add-more-btn {
  display:flex; align-items:center; gap:6px;
  padding:6px 12px; border-radius:var(--radius-md);
  border:1.5px dashed var(--border-med); background:transparent;
  color:var(--brand-primary); font-family:var(--font-body);
  font-size:12px; font-weight:700; cursor:pointer; transition:var(--tr); margin-top:10px;
}
.add-more-btn:hover { background:var(--brand-light); border-color:var(--brand-primary); }

[data-theme="dark"] .cal-header { border-color:var(--border-light); }
[data-theme="dark"] .cal-header-title { color:#E2E8F8; }
[data-theme="dark"] .cal-edit-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .cal-edit-btn:hover { border-color:#3B82F6; color:#3B82F6; background:rgba(59,130,246,.1); }
[data-theme="dark"] .term-label { color:#4A6080; }
[data-theme="dark"] .term-label::after { background:var(--border-light); }
[data-theme="dark"] .key-date-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .key-date-card:hover { border-color:var(--border-med); }
[data-theme="dark"] .kd-icon { background:rgba(59,130,246,.15); color:#3B82F6; }
[data-theme="dark"] .kd-heading { color:#E2E8F8; }
[data-theme="dark"] .cal-entry-input { background:var(--input-bg); border-color:var(--border-light); color:#E2E8F8; }
[data-theme="dark"] .cal-entry-input:focus { border-color:#3B82F6; }
[data-theme="dark"] .cal-modal-term { color:#4A6080; }
[data-theme="dark"] .cal-modal-term::before, [data-theme="dark"] .cal-modal-term::after { background:var(--border-light); }
[data-theme="dark"] .add-more-btn { border-color:var(--border-med); color:#3B82F6; }
[data-theme="dark"] .add-more-btn:hover { background:rgba(59,130,246,.1); border-color:#3B82F6; }
[data-theme="dark"] .remove-btn { border-color:rgba(239,68,68,.25); background:rgba(239,68,68,.1); color:#F87171; }
[data-theme="dark"] .no-data { color:var(--text-muted); }

/* ── Activity Calendar ── */
.act-stats-strip { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:18px; }
.act-stat-card {
  background:var(--bg-card); border-radius:var(--radius-lg);
  border:1px solid var(--border-light); padding:14px 16px;
  display:flex; align-items:center; gap:12px;
  box-shadow:var(--shadow-sm); transition:var(--tr);
  position:relative; overflow:hidden;
}
.act-stat-card::before {
  content:''; position:absolute; left:0; top:0; bottom:0; width:3px;
  background:var(--accent,var(--brand-primary)); border-radius:0 2px 2px 0;
}
.act-stat-card:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); }
.act-stat-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.act-stat-val { font-size:22px; font-weight:800; color:var(--text-primary); line-height:1; letter-spacing:-.02em; }
.act-stat-lbl { font-size:11px; color:var(--text-muted); margin-top:3px; }

.activity-layout-v2 { display:grid; grid-template-columns:1fr 340px; gap:16px; align-items:start; }

.act-cal-card { background:var(--bg-card); border-radius:var(--radius-xl); border:1px solid var(--border-light); box-shadow:var(--shadow-sm); overflow:hidden; }
.act-cal-header {
  display:flex; align-items:center; justify-content:space-between;
  padding:18px 20px 14px; border-bottom:1px solid var(--border-light);
  background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);
  gap:12px; flex-wrap:wrap;
}
.act-cal-header-left { display:flex; align-items:center; }
.act-cal-header-right { display:flex; align-items:center; gap:10px; }
.act-cal-nav { display:flex; align-items:center; gap:8px; }
.act-nav-btn {
  width:32px; height:32px; border-radius:9px;
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  color:var(--text-muted); display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:11px; transition:var(--tr);
}
.act-nav-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.act-cal-month-wrap { text-align:center; min-width:130px; }
.act-cal-month { font-size:17px; font-weight:800; color:var(--text-primary); letter-spacing:-.02em; }
.act-cal-month-sub { font-size:10px; color:var(--text-muted); margin-top:1px; }

.act-view-pills {
  display:flex; gap:2px; background:var(--bg-muted);
  border:1px solid var(--border-light); border-radius:var(--radius-full); padding:3px;
}
.act-view-pill {
  padding:5px 12px; border-radius:var(--radius-full);
  border:none; background:transparent;
  font-family:var(--font-body); font-size:11.5px; font-weight:600;
  color:var(--text-muted); cursor:pointer; transition:var(--tr);
}
.act-view-pill:hover:not(.active) { color:var(--text-primary); }
.act-view-pill.active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; box-shadow:0 2px 8px rgba(30,58,138,.3); }

.act-icon-btn {
  width:32px; height:32px; border-radius:9px;
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  color:var(--text-muted); display:flex; align-items:center; justify-content:center;
  cursor:pointer; font-size:13px; transition:var(--tr);
}
.act-icon-btn:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }
.act-icon-btn--pdf  { background:rgba(220,38,38,.07); border-color:rgba(220,38,38,.25); color:#DC2626; }
.act-icon-btn--pdf:hover { background:rgba(220,38,38,.14); border-color:#DC2626; color:#DC2626; }
.act-icon-btn--word { background:rgba(30,64,175,.07); border-color:rgba(30,64,175,.25); color:#1E40AF; }
.act-icon-btn--word:hover { background:rgba(30,64,175,.14); border-color:#1E40AF; color:#1E40AF; }

.act-dow-row { display:grid; grid-template-columns:repeat(7,1fr); padding:10px 10px 6px; gap:2px; }
.act-dow { text-align:center; font-size:10px; font-weight:800; color:var(--text-muted); letter-spacing:.8px; text-transform:uppercase; padding:6px 0; }
.act-days-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; padding:0 10px 10px; }

.act-day-full {
  min-height:88px; border-radius:8px; cursor:pointer;
  padding:6px 5px 4px; transition:var(--tr);
  border:1.5px solid transparent;
  display:flex; flex-direction:column; gap:3px; position:relative;
}
.act-day-full:hover:not(.other-month) { background:var(--bg-muted); border-color:var(--border-light); }
.act-day-full.other-month { opacity:.35; cursor:default; }
.act-day-full.today { background:rgba(30,58,138,.04); border-color:var(--brand-primary); }
.act-day-num {
  font-size:12.5px; font-weight:600; color:var(--text-secondary);
  width:26px; height:26px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0; transition:var(--tr); align-self:flex-start;
}
.act-day-full.other-month .act-day-num { color:var(--text-muted); }
.act-day-num.today-num {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-weight:800; box-shadow:0 3px 10px rgba(30,58,138,.4);
}
.cal-day-events { display:flex; flex-direction:column; gap:2px; flex:1; margin-top:4px; }
.cal-event-chip {
  font-size:10px; font-weight:700;
  padding:2px 5px; border-radius:3px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  cursor:pointer; transition:var(--tr); line-height:1.4;
}
.cal-event-chip:hover { filter:brightness(.92); }
.cal-event-more-chip {
  font-size:9.5px; font-weight:700;
  color:var(--text-muted); background:var(--bg-muted);
  padding:1px 5px; border-radius:3px; border:none;
}
.act-day-full.has-acts { border-color:rgba(30,58,138,.12); }
.act-day-full.has-acts:hover { border-color:var(--border-med); filter:brightness(.97); }

.act-legend {
  display:flex; align-items:center; gap:16px; justify-content:center;
  padding:10px 16px 16px; border-top:1px solid var(--border-light); flex-wrap:wrap;
}
.act-legend-item { display:flex; align-items:center; gap:5px; font-size:10.5px; color:var(--text-muted); font-weight:600; }
.act-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.today-dot { background:linear-gradient(135deg,#1E3A8A,#1E40AF); box-shadow:0 1px 4px rgba(30,58,138,.4); }

.act-events-panel {
  background:var(--bg-card); border-radius:var(--radius-xl);
  border:1px solid var(--border-light); box-shadow:var(--shadow-sm);
  display:flex; flex-direction:column; max-height:600px; overflow:hidden;
}
.act-events-header {
  padding:16px 16px 12px; border-bottom:1px solid var(--border-light);
  display:flex; align-items:flex-start; justify-content:space-between;
  gap:10px; flex-shrink:0;
  background:linear-gradient(135deg,rgba(30,58,138,.03),transparent);
}
.act-events-title { font-size:14px; font-weight:800; color:var(--text-primary); }
.act-events-sub { font-size:11px; color:var(--text-muted); margin-top:2px; }
.act-add-btn {
  display:flex; align-items:center; gap:6px;
  padding:8px 14px; border-radius:var(--radius-full);
  border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff; font-family:var(--font-body); font-size:12px; font-weight:700;
  cursor:pointer; box-shadow:0 3px 10px rgba(30,58,138,.3);
  transition:var(--tr); white-space:nowrap; flex-shrink:0;
}
.act-add-btn:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(30,58,138,.4); }

.act-search-row { display:flex; gap:8px; padding:12px 14px 8px; flex-shrink:0; border-bottom:1px solid var(--border-light); }
.act-search-box {
  flex:1; display:flex; align-items:center; gap:7px;
  border:1.5px solid var(--border-light); border-radius:var(--radius-full);
  padding:0 12px; height:34px; background:var(--bg-muted); transition:var(--tr);
}
.act-search-box:focus-within { border-color:var(--brand-primary); background:var(--input-bg); box-shadow:0 0 0 3px rgba(30,58,138,.09); }
.act-search-box i { color:var(--text-muted); font-size:11px; flex-shrink:0; }
.act-search-box input {
  border:none; background:transparent; outline:none;
  font-family:var(--font-body); font-size:12.5px;
  color:var(--text-primary); width:100%;
}
.act-search-box input::placeholder { color:var(--text-muted); }
.act-filter-btn {
  display:flex; align-items:center; gap:5px;
  padding:0 12px; height:34px; border-radius:var(--radius-full);
  border:1.5px solid var(--border-light); background:var(--bg-muted);
  color:var(--text-muted); font-family:var(--font-body);
  font-size:11.5px; font-weight:700; cursor:pointer;
  transition:var(--tr); white-space:nowrap;
}
.act-filter-btn:hover, .act-filter-btn.on { border-color:var(--brand-primary); color:var(--brand-primary); background:var(--brand-light); }

.act-events-list { flex:1; overflow-y:auto; }
.act-event-item {
  padding:12px 14px; display:flex; align-items:flex-start; gap:10px;
  transition:var(--tr); position:relative; cursor:pointer;
  border-bottom:1px solid var(--border-light);
  animation:fadeSlide .2s ease both;
}
.act-event-item:last-child { border-bottom:none; }
.act-event-item:hover { background:var(--bg-muted); }
.act-event-strip { width:4px; border-radius:2px; flex-shrink:0; align-self:stretch; min-height:40px; }
.act-event-body { flex:1; min-width:0; }
.act-event-name { font-size:13px; font-weight:700; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.act-event-dates { font-size:11px; color:var(--text-muted); margin-top:3px; display:flex; align-items:center; gap:5px; }
.act-event-dates i { font-size:9px; color:var(--border-med); }
.act-event-badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:var(--radius-full); font-size:10px; font-weight:700; margin-top:5px; }
.act-event-more {
  width:26px; height:26px; border-radius:7px;
  border:none; background:transparent; color:var(--text-muted);
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:11px; transition:var(--tr); flex-shrink:0;
}
.act-event-more:hover { background:var(--bg-muted); color:var(--text-primary); }
.act-empty { display:flex; flex-direction:column; align-items:center; padding:40px 20px; text-align:center; }
.act-empty-icon {
  width:60px; height:60px; border-radius:16px;
  background:linear-gradient(135deg,rgba(30,58,138,.08),rgba(14,165,233,.08));
  display:flex; align-items:center; justify-content:center;
  font-size:24px; color:var(--brand-primary); margin-bottom:12px;
}

/* Dropdown */
.dropdown-menu {
  background:var(--bg-card); border:1px solid var(--border-light);
  border-radius:var(--radius-md); box-shadow:var(--shadow-lg);
  min-width:160px; overflow:hidden;
  animation:fadeSlide .15s ease both;
}
.dropdown-menu.fixed { position:fixed; z-index:9000; }
.dropdown-item {
  display:flex; align-items:center; gap:9px; padding:9px 14px;
  font-family:var(--font-body); font-size:12.5px; font-weight:600;
  color:var(--text-primary); cursor:pointer; border:none; background:transparent;
  width:100%; text-align:left; transition:var(--tr);
}
.dropdown-item:hover { background:var(--bg-muted); }
.dropdown-item.delete:hover { background:rgba(220,38,38,.06); color:var(--error); }
.dropdown-item i { font-size:11px; color:var(--text-muted); width:14px; }
.dropdown-item.delete i { color:var(--error); }

[data-theme="dark"] .act-stat-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .act-stat-val { color:#E2E8F8; }
[data-theme="dark"] .act-cal-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .act-cal-header { background:linear-gradient(135deg,rgba(59,130,246,.04),transparent); border-color:var(--border-light); }
[data-theme="dark"] .act-nav-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .act-nav-btn:hover { background:rgba(59,130,246,.15); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .act-cal-month { color:#E2E8F8; }
[data-theme="dark"] .act-view-pills { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-view-pill { color:var(--text-muted); }
[data-theme="dark"] .act-view-pill:hover:not(.active) { color:#93C5FD; }
[data-theme="dark"] .act-view-pill.active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; }
[data-theme="dark"] .act-icon-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .act-icon-btn:hover { background:rgba(59,130,246,.15); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .act-icon-btn--pdf  { background:rgba(220,38,38,.1); border-color:rgba(220,38,38,.25); color:#F87171; }
[data-theme="dark"] .act-icon-btn--word { background:rgba(59,130,246,.1); border-color:rgba(59,130,246,.25); color:#60A5FA; }
[data-theme="dark"] .act-dow { color:#4A6080; }
[data-theme="dark"] .act-day-full:hover:not(.other-month) { background:rgba(59,130,246,.08); }
[data-theme="dark"] .act-day-full.today { background:linear-gradient(135deg,#1E3A8A,#1E40AF); box-shadow:0 4px 14px rgba(30,58,138,.5); }
[data-theme="dark"] .act-day-num { color:#B8C8E8; }
[data-theme="dark"] .act-day-full.other-month .act-day-num { color:#2A3E60; }
[data-theme="dark"] .act-legend { border-color:var(--border-light); }
[data-theme="dark"] .act-legend-item { color:var(--text-muted); }
[data-theme="dark"] .act-events-panel { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .act-events-header { background:linear-gradient(135deg,rgba(59,130,246,.04),transparent); border-color:var(--border-light); }
[data-theme="dark"] .act-events-title { color:#E2E8F8; }
[data-theme="dark"] .act-events-sub { color:var(--text-muted); }
[data-theme="dark"] .act-search-box { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-search-box:focus-within { background:var(--input-bg); border-color:#3B82F6; }
[data-theme="dark"] .act-search-box input { color:#E2E8F8; }
[data-theme="dark"] .act-filter-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .act-filter-btn:hover, [data-theme="dark"] .act-filter-btn.on { background:rgba(59,130,246,.15); border-color:#3B82F6; color:#3B82F6; }
[data-theme="dark"] .act-event-item { border-color:var(--border-light); }
[data-theme="dark"] .act-event-item:hover { background:rgba(59,130,246,.06); }
[data-theme="dark"] .act-event-name { color:#E2E8F8; }
[data-theme="dark"] .act-event-dates { color:var(--text-muted); }
[data-theme="dark"] .act-event-more:hover { background:var(--bg-muted); color:#93C5FD; }
[data-theme="dark"] .dropdown-menu { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-lg); }
[data-theme="dark"] .dropdown-item { color:#E2E8F8; }
[data-theme="dark"] .dropdown-item:hover { background:rgba(59,130,246,.08); }
[data-theme="dark"] .dropdown-item.delete:hover { background:rgba(239,68,68,.1); color:#F87171; }
[data-theme="dark"] .dropdown-item i { color:var(--text-muted); }
[data-theme="dark"] .dropdown-item.delete i { color:#F87171; }

/* ── Confirm Dialog ── */
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
.confirm-btn--confirm.primary-style {
  background:linear-gradient(135deg,#1D4ED8,#1E3A8A);
  box-shadow:0 4px 14px rgba(30,58,138,.35), inset 0 1px 0 rgba(255,255,255,.2);
}
.confirm-btn--confirm.primary-style:hover { box-shadow:0 8px 24px rgba(30,58,138,.5); }
.confirm-btn:active { transform:scale(.97) translateY(0)!important; }

[data-theme="dark"] .confirm-overlay { background:rgba(0,5,15,.72); }
[data-theme="dark"] .confirm-dialog  { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .confirm-hint    { background:rgba(220,38,38,.1); color:#FCA5A5; }

/* ── Report Picker ── */
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
/* Colorless preview tile — looks like printed paper (white + light gray) */
.rp-preview-bw {
  width:100%; height:100%;
  background:#FFFFFF;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:6px; padding:14px;
  border-bottom:1px solid #E5E7EB;
}
.rp-mock-header-bw {
  width:80%; height:7px; border-radius:2px;
  background:#1F2937;
}
.rp-mock-line-bw   { border-radius:2px; background:#9CA3AF; }
.rp-mock-chips-bw  { display:flex; gap:5px; margin-top:2px; }
.rp-mock-chip-bw   {
  width:28px; height:9px; border-radius:2px;
  background:transparent; border:1px solid #9CA3AF;
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

[data-theme="dark"] .report-picker-overlay { background:rgba(0,5,15,.72); }
[data-theme="dark"] .report-picker { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rp-header { background:linear-gradient(135deg,rgba(59,130,246,.04),transparent); border-color:var(--border-light); }
[data-theme="dark"] .rp-title { color:#E2E8F8; }
[data-theme="dark"] .rp-sub { color:var(--text-muted); }
[data-theme="dark"] .rp-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .rp-option { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rp-option-name { color:#E2E8F8; }
[data-theme="dark"] .rp-format-pill { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .rp-format-name { color:#E2E8F8; }
[data-theme="dark"] .rp-footer { border-color:var(--border-light); }
[data-theme="dark"] .rp-btn.cancel { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
/* Colorless preview keeps a paper-white look even in dark mode so the
   user sees a faithful preview of the printed colorless report. */
[data-theme="dark"] .rp-preview-bw { background:#F8FAFC; border-bottom-color:#CBD5E1; }
[data-theme="dark"] .rp-mock-header-bw { background:#1F2937; }
[data-theme="dark"] .rp-mock-line-bw { background:#94A3B8; }
[data-theme="dark"] .rp-mock-chip-bw { border-color:#94A3B8; }
/* Focus ring for keyboard nav on radio-style options */
.rp-option:focus-visible {
  outline:none;
  box-shadow:0 0 0 3px rgba(30,58,138,.18), var(--shadow-md);
  border-color:var(--brand-primary);
}
[data-theme="dark"] .rp-option:focus-visible {
  box-shadow:0 0 0 3px rgba(59,130,246,.32), var(--shadow-md);
  border-color:#3B82F6;
}

/* ── Responsive ── */
@media (max-width:520px) {
  /* Report picker — collapse style/format columns + tighten padding so the
     picker fits comfortably on phones without horizontal scroll. */
  .rp-options, .rp-format-row { grid-template-columns:1fr; gap:10px; }
  .rp-footer { grid-template-columns:1fr 1fr; padding:14px 18px 18px; }
  .rp-header { padding:18px 18px 14px; }
  .rp-body { padding:18px 18px 16px; }
  .rp-btn { height:42px; font-size:13px; }
}
@media (max-width:1100px) {
  .activity-layout-v2 { grid-template-columns:1fr 300px; gap:12px; }
  .act-stats-strip { gap:10px; }
  .ts-stat-strip { gap:10px; }
}
@media (max-width:900px) {
  .ts-stat-strip { grid-template-columns:1fr 1fr; }
  .act-stats-strip { grid-template-columns:1fr 1fr; }
  .activity-layout-v2 { grid-template-columns:1fr; }
  .act-events-panel { max-height:400px; }
  .key-dates-grid { grid-template-columns:1fr 1fr; }
  .ts-table-head { display:none; }
  .ts-row { flex-wrap:wrap; gap:6px; padding:14px 14px; }
  .ts-num { width:100%; margin-bottom:2px; }
  .ts-cell.flex1 { width:100%; padding:0; }
  .ts-cell.w160 { width:calc(50% - 3px); padding:0; }
  .ts-cell.w100 { width:100%; padding:0; margin-top:4px; }
  .ts-actions { justify-content:flex-end; }
}
@media (max-width:768px) {
  /* Row wahi rehti hai (base ka auto-flow) — sirf padding chhoti. */
  .l1-tabs { padding:3px; gap:3px; }
  .l1-tab { padding:9px 8px; font-size:12px; gap:6px; }
  .l1-tab-icon { width:20px; height:20px; font-size:10px; }
  .l2-tabs { display:flex; overflow-x:auto; }
  .l2-tab { flex:1 0 auto; min-width:120px; padding:11px 16px; font-size:12.5px; white-space:nowrap; }
  .l3-tabs { grid-template-columns:1fr 1fr; gap:8px; }
  .l3-tab { padding:12px; gap:8px; border-radius:var(--radius-md); }
  .l3-tab-icon { width:32px; height:32px; font-size:13px; border-radius:8px; }
  .l3-tab-name { font-size:12px; }
  .l3-tab-desc { display:none; }
  .class-row, .table-head { grid-template-columns:50px 1fr auto 50px; padding:0 12px; }
  .td.cls-name { font-size:12px; }
  .inline-export .export-btn span,
  .inline-export .export-btn { font-size:10px; padding:5px 9px; }
  .act-stats-strip, .ts-stat-strip { grid-template-columns:1fr 1fr; gap:7px; }
  .ts-stat, .act-stat-card { padding:10px 11px; gap:8px; }
  .ts-stat-val, .act-stat-val { font-size:17px; }
  .ts-stat-icon, .act-stat-icon { width:30px; height:30px; font-size:13px; border-radius:8px; }
  .act-cal-card, .act-events-panel { width:100%; border-radius:var(--radius-lg); }
  .act-view-pill { padding:5px 7px; font-size:10.5px; }
  .act-day-full { min-height:88px; }
  .ts-card-header { padding:16px; flex-direction:column; align-items:flex-start; gap:12px; }
  .key-dates-grid { grid-template-columns:1fr; }
}

/* ═══════════════════════════════════════════════════════════════════
   DARK MODE — overrides for the rest of Academics' surfaces that the
   existing dark rules above don't cover. Brand-gradient buttons keep
   their light-mode look so the visual identity stays consistent.
   ═══════════════════════════════════════════════════════════════════ */

/* L1 / L2 / L3 tabs that don't have dark coverage yet */
[data-theme="dark"] .l1-tabs { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .l1-tab { color:var(--text-muted); }
[data-theme="dark"] .l1-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }
[data-theme="dark"] .l1-tab-icon { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .l2-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .l2-tab { color:var(--text-muted); }
[data-theme="dark"] .l2-tab:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .l3-tabs { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .l3-tab { color:var(--text-muted); }
[data-theme="dark"] .l3-tab:hover:not(.active) { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .l3-tab-text { color:inherit; }

/* Section cards (general container used across Academics) */
[data-theme="dark"] .section-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .term-section { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .subject-grid { background:transparent; }
[data-theme="dark"] .subj-icon { background:rgba(59,130,246,.12); color:#93C5FD; }

/* Subject colour chips — soften saturation for dark mode */
[data-theme="dark"] .subj-blue   { background:rgba(59,130,246,.18); color:#93C5FD; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .subj-green  { background:rgba(34,197,94,.18); color:#86EFAC; border-color:rgba(34,197,94,.3); }
[data-theme="dark"] .subj-amber  { background:rgba(217,119,6,.18); color:#FCD34D; border-color:rgba(217,119,6,.3); }
[data-theme="dark"] .subj-rose   { background:rgba(225,29,72,.18); color:#FDA4AF; border-color:rgba(225,29,72,.3); }
[data-theme="dark"] .subj-purple { background:rgba(124,58,237,.18); color:#C4B5FD; border-color:rgba(124,58,237,.3); }
[data-theme="dark"] .subj-teal   { background:rgba(13,148,136,.18); color:#5EEAD4; border-color:rgba(13,148,136,.3); }

/* Serial number labels */
[data-theme="dark"] .sno { color:var(--text-muted); }
[data-theme="dark"] .sno-hash { color:var(--text-muted); }

/* Tutorial button */
[data-theme="dark"] .tutorial-btn,
[data-theme="dark"] .page-tutorial-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .tutorial-btn:hover,
[data-theme="dark"] .page-tutorial-btn:hover { border-color:#3B82F6; color:#3B82F6; }

/* ─── Activity Calendar (left panel) ─── */
[data-theme="dark"] .activity-layout-v2 { background:transparent; }
[data-theme="dark"] .act-cal-card { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .act-events-panel { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .act-cal-header-left,
[data-theme="dark"] .act-cal-header-right { color:var(--text-primary); }
[data-theme="dark"] .act-cal-nav { color:var(--text-primary); }
[data-theme="dark"] .act-cal-month-wrap { color:var(--text-primary); }
[data-theme="dark"] .act-cal-month-sub { color:var(--text-muted); }
[data-theme="dark"] .act-nav-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
[data-theme="dark"] .act-nav-btn:hover { background:var(--bg-card); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .act-view-pills { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-view-pill { color:var(--text-muted); }
[data-theme="dark"] .act-view-pill.active { background:var(--bg-card); color:var(--text-primary); }
[data-theme="dark"] .act-icon-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .act-icon-btn:hover { background:var(--bg-card); border-color:var(--border-med); }
[data-theme="dark"] .act-icon-btn--pdf:hover { color:#FCA5A5; border-color:rgba(220,38,38,.4); background:rgba(220,38,38,.1); }
[data-theme="dark"] .act-icon-btn--word:hover { color:#93C5FD; border-color:rgba(59,130,246,.4); background:rgba(59,130,246,.1); }
[data-theme="dark"] .act-dow-row { color:var(--text-muted); background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-dow { color:var(--text-muted); }
[data-theme="dark"] .act-days-grid { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .act-day-full { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .act-day-full:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .act-day-num { color:var(--text-primary); }
[data-theme="dark"] .today-num { color:#fff; }
[data-theme="dark"] .today-dot { background:#3B82F6; }
[data-theme="dark"] .act-day-events { color:var(--text-muted); }
[data-theme="dark"] .cal-day-events { background:transparent; }
[data-theme="dark"] .cal-event-chip { background:rgba(59,130,246,.18); color:#E2E8F8; border-color:rgba(59,130,246,.3); }
[data-theme="dark"] .cal-event-more-chip { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
[data-theme="dark"] .act-stats-strip { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .act-stat-card { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-stat-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .act-stat-val { color:var(--text-primary); }
[data-theme="dark"] .act-stat-lbl { color:var(--text-muted); }
[data-theme="dark"] .act-legend-dot { border-color:var(--border-light); }

/* Activity Calendar — right panel (events list) */
[data-theme="dark"] .act-events-panel .act-events-list { background:transparent; }
[data-theme="dark"] .act-events-list { color:var(--text-primary); }
[data-theme="dark"] .act-add-btn { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .act-add-btn:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .act-search-row { background:transparent; border-color:var(--border-light); }
[data-theme="dark"] .act-search-box { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-search-box input { color:var(--text-primary); }
[data-theme="dark"] .act-search-box input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .act-search-box i { color:var(--text-muted); }
[data-theme="dark"] .act-filter-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .act-filter-btn:hover,
[data-theme="dark"] .act-filter-btn.on { background:var(--bg-card); color:#3B82F6; border-color:#3B82F6; }
[data-theme="dark"] .act-event-item { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-event-item:hover { background:var(--bg-card); }
[data-theme="dark"] .act-event-strip { box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
[data-theme="dark"] .act-event-body { color:var(--text-primary); }
[data-theme="dark"] .act-event-name { color:var(--text-primary); }
[data-theme="dark"] .act-event-dates { color:var(--text-muted); }
[data-theme="dark"] .act-event-badge { border:1px solid rgba(255,255,255,.06); }
[data-theme="dark"] .act-event-more { background:var(--bg-card); color:var(--text-muted); border-color:var(--border-light); }
[data-theme="dark"] .act-event-more:hover { background:var(--bg-muted); color:var(--text-primary); }
[data-theme="dark"] .act-empty { color:var(--text-muted); }
[data-theme="dark"] .act-empty-icon { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .dropdown-menu { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-lg); }
[data-theme="dark"] .dropdown-item { color:var(--text-primary); }
[data-theme="dark"] .dropdown-item:hover { background:var(--bg-muted); }
[data-theme="dark"] .dropdown-item.delete { color:#FCA5A5; }
[data-theme="dark"] .dropdown-item.delete:hover { background:rgba(220,38,38,.1); }

/* ─── Modals (shared rp- + modal- + cal- + activity-modal + confirm-) ─── */
[data-theme="dark"] .rp-overlay,
[data-theme="dark"] .modal-overlay,
[data-theme="dark"] .confirm-overlay { background:rgba(0,0,0,.6); }
[data-theme="dark"] .rp-modal,
[data-theme="dark"] .modal-card,
[data-theme="dark"] .confirm-card { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-xl); }
[data-theme="dark"] .rp-header,
[data-theme="dark"] .modal-header { border-bottom-color:var(--border-light); background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); }
[data-theme="dark"] .rp-header-left { color:var(--text-primary); }
[data-theme="dark"] .rp-header-icon { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .rp-title,
[data-theme="dark"] .modal-title { color:var(--text-primary); }
[data-theme="dark"] .rp-sub,
[data-theme="dark"] .modal-sub { color:var(--text-muted); }
[data-theme="dark"] .rp-close,
[data-theme="dark"] .modal-close { background:var(--bg-muted); color:var(--text-muted); }
[data-theme="dark"] .rp-close:hover,
[data-theme="dark"] .modal-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }
[data-theme="dark"] .rp-body,
[data-theme="dark"] .modal-body { color:var(--text-primary); }
[data-theme="dark"] .rp-section-label { color:var(--text-secondary); }
[data-theme="dark"] .rp-options { background:transparent; }
[data-theme="dark"] .rp-option,
[data-theme="dark"] .rp-format-row { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rp-option:hover,
[data-theme="dark"] .rp-format-row:hover { border-color:var(--border-med); background:var(--bg-card); }
[data-theme="dark"] .rp-option.selected,
[data-theme="dark"] .rp-format-row.selected,
[data-theme="dark"] .rp-format-row.selected-pdf,
[data-theme="dark"] .rp-format-row.selected-word { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.10)); border-color:#3B82F6; }
[data-theme="dark"] .rp-option-text,
[data-theme="dark"] .rp-option-desc { color:inherit; }
[data-theme="dark"] .rp-option-desc { color:var(--text-muted); }
[data-theme="dark"] .rp-format-desc { color:var(--text-muted); }
[data-theme="dark"] .rp-format-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .rp-check { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .rp-option.selected .rp-check,
[data-theme="dark"] .rp-format-row.selected .rp-check { background:#3B82F6; border-color:#3B82F6; color:#fff; }
[data-theme="dark"] .rp-preview,
[data-theme="dark"] .rp-preview-color,
[data-theme="dark"] .rp-preview-bw { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .rp-mock-header { background:linear-gradient(135deg,#1E3A8A,#2563EB); }
[data-theme="dark"] .rp-mock-header-bw { background:#1C2E50; color:#E2E8F8; }
[data-theme="dark"] .rp-mock-line,
[data-theme="dark"] .rp-mock-line-bw { background:var(--border-light); }
[data-theme="dark"] .rp-mock-chip { background:rgba(59,130,246,.18); color:#93C5FD; }
[data-theme="dark"] .rp-mock-chip-bw { background:var(--bg-muted); color:var(--text-secondary); }
[data-theme="dark"] .rp-footer { background:var(--bg-card); border-top-color:var(--border-light); }
[data-theme="dark"] .rp-btn.cancel { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .rp-btn.cancel:hover { background:var(--bg-card); border-color:var(--border-med); }

/* Calendar edit modal */
[data-theme="dark"] .cal-modal-section { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .cal-entry-row { background:var(--bg-card); border-color:var(--border-light); }
[data-theme="dark"] .cal-entry-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .cal-entry-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .cal-entry-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .remove-btn { background:rgba(220,38,38,.15); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
[data-theme="dark"] .remove-btn:hover { background:rgba(220,38,38,.25); border-color:var(--error); }
[data-theme="dark"] .add-more-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .add-more-btn:hover { border-color:#3B82F6; color:#3B82F6; }

/* Confirm dialog */
[data-theme="dark"] .confirm-body { background:var(--bg-card); }
[data-theme="dark"] .confirm-title { color:var(--text-primary); }
[data-theme="dark"] .confirm-message { color:var(--text-secondary); }
[data-theme="dark"] .confirm-footer { background:var(--bg-muted); border-top-color:var(--border-light); }
[data-theme="dark"] .confirm-btn { font-weight:700; }
[data-theme="dark"] .confirm-btn--cancel { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .confirm-btn--cancel:hover { background:var(--bg-muted); border-color:var(--border-med); }
[data-theme="dark"] .confirm-btn--confirm { color:#fff; }
[data-theme="dark"] .confirm-btn--confirm.primary-style { background:linear-gradient(135deg,#1E3A8A,#2563EB); }

/* Form inputs across all modals */
[data-theme="dark"] .form-input,
[data-theme="dark"] input.form-input,
[data-theme="dark"] textarea.form-input,
[data-theme="dark"] select.form-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .form-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .form-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .form-label { color:var(--text-secondary); }
[data-theme="dark"] .form-row { color:var(--text-primary); }
[data-theme="dark"] .btn-primary { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .btn-primary:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }
[data-theme="dark"] .btn-secondary { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
[data-theme="dark"] .btn-secondary:hover { background:var(--bg-muted); border-color:var(--border-med); }

/* ─── Term Settings — remaining surfaces ─── */
[data-theme="dark"] .ts-header-icon { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .ts-card-header-left { color:var(--text-primary); }
[data-theme="dark"] .ts-section-body { background:var(--bg-card); }
[data-theme="dark"] .ts-stat-strip { background:transparent; }
[data-theme="dark"] .ts-stat-bar { background:var(--bg-muted); border-color:var(--border-light); }
[data-theme="dark"] .ts-stat-icon { background:rgba(59,130,246,.12); color:#93C5FD; }
[data-theme="dark"] .ts-stat-lbl { color:var(--text-muted); }
[data-theme="dark"] .ts-field-group { color:var(--text-primary); }
[data-theme="dark"] .ts-input-wrap { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); }
[data-theme="dark"] .ts-input-wrap:focus-within { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
[data-theme="dark"] .ts-input,
[data-theme="dark"] .ts-select { background:transparent; color:var(--text-primary); }
[data-theme="dark"] .ts-input::placeholder { color:var(--text-muted); }
[data-theme="dark"] .ts-input-icon { color:var(--text-muted); }
[data-theme="dark"] .ts-cell { color:var(--text-primary); }
[data-theme="dark"] .ts-actions { background:transparent; }
[data-theme="dark"] .ts-act-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
[data-theme="dark"] .ts-act-btn.save:hover { background:var(--success); border-color:var(--success); color:#fff; }
[data-theme="dark"] .ts-act-btn.del:hover { background:var(--error); border-color:var(--error); color:#fff; }
[data-theme="dark"] .ts-num { color:var(--text-primary); }
[data-theme="dark"] .ts-add-icon { background:rgba(59,130,246,.15); color:#93C5FD; }
[data-theme="dark"] .ts-add-hint { color:var(--text-muted); }
[data-theme="dark"] .ts-hint { color:var(--text-muted); }
[data-theme="dark"] .ts-btn-primary { background:linear-gradient(135deg,#1E3A8A,#2563EB); color:#fff; }
[data-theme="dark"] .ts-btn-primary:hover { background:linear-gradient(135deg,#1E40AF,#3B82F6); }

/* ───────────────────────── MOBILE (≤600px) ─────────────────────────
   Real internal screen responsiveness — not modal sizing. Stacks
   top toolbars, makes sub-tab strips horizontally scrollable,
   collapses multi-column grids, wraps the wide term/class tables. */
@media (max-width:600px) {
  /* Page header — stack title + tutorial button */
  .page-header { padding:12px 14px; gap:10px; }
  .page-title-row { flex-direction:column; align-items:flex-start; gap:8px; width:100%; }
  .page-title { font-size:18px; }
  .page-sub { font-size:11px; }
  .page-tutorial-btn { width:100%; justify-content:center; }

  /* L1 tabs — keep 2-col but shrink padding */
  .l1-tabs { padding:3px; gap:3px; margin-bottom:14px; }
  .l1-tab { padding:9px 6px; font-size:11.5px; gap:5px; }
  .l1-tab-icon { width:20px; height:20px; font-size:10px; }

  /* L2 sub-tab strip — horizontal scroll instead of squashing */
  .l2-tabs { display:flex; overflow-x:auto; overflow-y:hidden; flex-wrap:nowrap; scrollbar-width:none; margin-bottom:14px; }
  .l2-tabs::-webkit-scrollbar { display:none; }
  .l2-tab { flex:0 0 auto; min-width:130px; padding:11px 14px; font-size:12px; white-space:nowrap; }
  .l2-tab:not(:last-child) { border-right:1px solid var(--border-light); }

  /* L3 tab grid — single column on phones */
  .l3-tabs { grid-template-columns:1fr; gap:8px; margin-bottom:14px; }
  .l3-tab { padding:12px 14px; gap:10px; }
  .l3-tab-icon { width:32px; height:32px; font-size:13px; border-radius:9px; }
  .l3-tab-name { font-size:12.5px; }
  .l3-tab-desc { font-size:10px; }

  /* Section card — tighter padding */
  .section-card { border-radius:var(--radius-md); }

  /* Class table — horizontal scroll, keep table-head visible */
  .table-head, .class-row { grid-template-columns:48px 1fr auto 44px; padding:0 10px; }
  .th { padding:10px 6px; font-size:10px; letter-spacing:.4px; }
  .td { padding:11px 6px; font-size:12px; }
  .td.cls-name { font-size:12.5px; gap:6px; }
  .cls-icon { width:26px; height:26px; font-size:10px; }
  .expand-btn { width:28px; height:28px; font-size:10px; }
  .detail-inner { padding:12px 12px 14px; }

  /* Inline export buttons — wrap */
  .inline-export { flex-wrap:wrap; gap:5px; }
  .export-btn { padding:5px 9px; font-size:10px; }

  /* Subject grid — single column */
  .subject-grid { grid-template-columns:1fr; gap:8px; }
  .subject-card { padding:11px 12px; gap:10px; }

  /* Term Settings stat strip — 2 cols */
  .ts-stat-strip { grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
  .ts-stat { padding:12px 12px; gap:10px; }
  .ts-stat-icon { width:34px; height:34px; font-size:14px; border-radius:9px; }
  .ts-stat-val { font-size:17px; }
  .ts-stat-lbl { font-size:10.5px; }

  /* Term Settings card header — stack title + subtab strip */
  .ts-card-header { flex-direction:column; align-items:stretch; padding:14px 14px 12px; gap:10px; }
  .ts-card-header-left { gap:10px; }
  .ts-header-icon { width:38px; height:38px; font-size:15px; border-radius:11px; }
  .ts-card-title { font-size:14px; }
  .ts-card-sub { font-size:11px; }

  /* ts-subtab row — horizontal scroll */
  .ts-subtab-row { overflow-x:auto; overflow-y:hidden; flex-wrap:nowrap; scrollbar-width:none; width:100%; }
  .ts-subtab-row::-webkit-scrollbar { display:none; }
  .ts-subtab { flex:0 0 auto; padding:7px 12px; font-size:12px; }

  /* Term Settings body — reduce padding */
  .ts-section-body { padding:14px 14px 18px; }
  .ts-info-strip { font-size:11.5px; padding:10px 12px; }

  /* Term Settings table — wrap to mobile-card style */
  .ts-table-head { display:none; }
  .ts-row { flex-wrap:wrap; padding:12px 12px; gap:8px; }
  .ts-num { width:100%; margin-bottom:2px; }
  .ts-cell.flex1 { width:100%; padding:0; }
  .ts-cell.w160 { width:calc(50% - 4px); padding:0; }
  .ts-cell.w100 { width:100%; padding:0; }
  .ts-actions { width:100%; justify-content:flex-end; }
  .ts-term-input { font-size:13px; }
  .ts-add-row-btn { padding:13px 14px; gap:10px; flex-wrap:wrap; }
  .ts-add-hint { width:100%; margin-left:0; text-align:left; }
  .ts-btn-primary, .ts-btn-ghost { width:100%; justify-content:center; padding:0 14px; }

  /* Term Settings field group — stack */
  .ts-input-wrap { max-width:none !important; }

  /* Academic Calendar header — stack */
  .cal-header { flex-direction:column; align-items:stretch; padding:14px 14px 12px; gap:10px; }
  .cal-header-title { font-size:14px; }
  .cal-edit-btn { width:100%; justify-content:center; }
  .term-section { padding:0 14px 14px; }

  /* Key-dates grid — single column */
  .key-dates-grid { grid-template-columns:1fr; gap:8px; }
  .key-date-card { padding:11px 12px; gap:9px; }
  .kd-icon { width:28px; height:28px; font-size:11px; }
  .kd-heading { font-size:12px; }
  .kd-date { font-size:10.5px; }

  /* Cal entry modal row — stack date pickers */
  .cal-entry-row { grid-template-columns:1fr 1fr; gap:6px; }
  .cal-entry-row > .remove-btn { grid-column:1 / -1; justify-self:end; }

  /* Activity Calendar — stack stat strip + layout */
  .act-stats-strip { grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; }
  .act-stat-card { padding:11px 12px; gap:10px; }
  .act-stat-icon { width:34px; height:34px; font-size:14px; border-radius:9px; }
  .act-stat-val { font-size:17px; }
  .act-stat-lbl { font-size:10.5px; }
  .activity-layout-v2 { grid-template-columns:1fr; gap:12px; }

  /* Activity calendar card header — stack month + view pills */
  .act-cal-header { flex-direction:column; align-items:stretch; padding:14px 14px 12px; gap:10px; }
  .act-cal-header-left, .act-cal-header-right { width:100%; }
  .act-cal-header-right { flex-wrap:wrap; gap:8px; }
  .act-cal-month { font-size:15px; }
  .act-cal-month-sub { font-size:10.5px; }
  .act-view-pills { width:100%; overflow-x:auto; flex-wrap:nowrap; scrollbar-width:none; }
  .act-view-pills::-webkit-scrollbar { display:none; }
  .act-view-pill { flex:0 0 auto; padding:5px 9px; font-size:10.5px; }
  .act-day-full { min-height:88px; }
  .act-events-panel { max-height:none; }

  /* Activity event search row + add btn — stack */
  .act-events-header { flex-direction:column; align-items:stretch; gap:10px; }
  .act-add-btn { width:100%; justify-content:center; }
  .act-search-row { padding:0 14px 12px; }

  /* Activity legend — wrap */
  .act-legend { flex-wrap:wrap; gap:8px; }

  /* Report picker — already responsive but tighten further */
  .rp-options, .rp-format-row { grid-template-columns:1fr; gap:8px; }
  .rp-footer { grid-template-columns:1fr; gap:8px; padding:12px 14px 14px; }
  .rp-header { padding:14px 14px 12px; }
  .rp-body { padding:14px 14px 12px; }
}

/* ═══════════════════════════════════════════════════════════════════
   MOBILE RESPONSIVE — Academics module (≤ 767px)
   Pure CSS, no JSX/logic changes. Converts div-based "tables"
   (Term Settings, Lesson Plans class list, etc.) into stacked
   card layouts. Makes all tab strips horizontal-scroll.
   ═══════════════════════════════════════════════════════════════════ */
@media (max-width: 767px) {
  /* ─── Page header / title ─── */
  .page-header { padding: 14px 12px; }
  .page-title-row { gap: 10px; flex-wrap: wrap; }
  .page-title { font-size: 18px; }
  .page-sub { font-size: 11.5px; }

  /* ─── L1 main tabs (Scheme of Studies / Lesson Plans / Resource Library) ───
     Yahan bhi aik hi row — teen tabs ke liye label chhota aur padding kam,
     taake phone par bhi teenon barabar samaa jayein. */
  .l1-tabs {
    display: grid !important;
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 4px;
    padding: 4px;
    margin-bottom: 12px;
  }
  .l1-tab {
    padding: 8px 6px !important;
    min-height: unset;
    height: auto;
    font-size: 11px;
    gap: 5px;
    line-height: 1.25;
  }
  .l1-tab-icon {
    width: 20px !important;
    height: 20px !important;
    font-size: 10px;
  }

  /* ─── L2 sub-tabs (Term Settings / Term Breakups / Create LP) ─── */
  .l2-tabs {
    grid-template-columns: none !important;
    display: flex !important;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
    gap: 6px;
  }
  .l2-tabs::-webkit-scrollbar { display: none; }
  .l2-tab {
    flex: 0 0 auto;
    min-width: 140px;
    padding: 9px 12px;
    font-size: 12.5px;
  }

  /* ─── L3 sub-tabs (Academic Calendar / Activity Calendar) ─── */
  .l3-tabs {
    grid-template-columns: 1fr !important;
    gap: 8px;
  }
  .l3-tab { padding: 12px; }

  /* ─── Term Settings ─── */
  .ts-stat-strip {
    grid-template-columns: 1fr 1fr !important;
    gap: 8px;
  }
  .ts-stat { padding: 10px; }
  .ts-stat-val { font-size: 14px; }
  .ts-stat-lbl { font-size: 10px; }

  .ts-card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .ts-card-header-left { gap: 10px; }
  .ts-card-title { font-size: 14px; }
  .ts-card-sub { font-size: 11px; }

  /* Settings sub-tab row (Session / Terms) — scroll */
  .ts-subtab-row {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }
  .ts-subtab-row::-webkit-scrollbar { display: none; }
  .ts-subtab { flex: 0 0 auto; min-width: 120px; }

  /* ─── Terms TABLE → CARD on mobile ─── */
  .ts-table-head { display: none !important; }
  .ts-row {
    display: flex !important;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 12px 14px;
    background: var(--bg-card);
    border-radius: 10px;
    margin-bottom: 10px;
    border: 1px solid var(--border-light);
  }
  .ts-row > .ts-num,
  .ts-row > .ts-cell {
    width: 100% !important;
    flex: none !important;
    padding: 0 !important;
    min-width: 0;
  }
  .ts-row > .ts-num::before { content: '#'; font-size: 11px; font-weight: 700; color: var(--text-muted); margin-right: 8px; text-transform: uppercase; letter-spacing: .4px; }
  .ts-row > .ts-num { display: inline-flex; align-items: center; }
  .ts-num-badge { margin-left: 0; }
  /* Column labels via :nth-child for the div-grid row */
  .ts-row > .ts-cell:nth-of-type(1)::before { content: 'Term Name'; }
  .ts-row > .ts-cell:nth-of-type(2)::before { content: 'Start Date'; }
  .ts-row > .ts-cell:nth-of-type(3)::before { content: 'End Date'; }
  .ts-row > .ts-cell:nth-of-type(4)::before { content: 'Actions'; }
  .ts-row > .ts-cell::before {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: .4px;
    margin-bottom: 5px;
  }
  .ts-term-input { width: 100%; }
  .ts-actions { justify-content: flex-start; }

  /* ─── Scheme of Studies → Textbooks class list — compact card layout ─── */
  .table-head { display: none !important; }
  .class-row-wrap {
    background: var(--bg-card);
    border: 1px solid var(--border-light);
    border-radius: 10px;
    margin-bottom: 10px;
  }
  .class-row {
    display: flex !important;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 12px !important;
    background: transparent;
    min-height: unset !important;
    height: auto !important;
  }
  .class-row.open { background: var(--bg-muted); }
  /* # number cell — inline compact, not full-width */
  .class-row > .td.sno {
    width: auto !important;
    padding: 0 !important;
    align-self: flex-start;
    font-size: 11px;
    color: var(--text-muted);
  }
  /* Class name row — full width */
  .class-row > .td.cls-name {
    width: 100% !important;
    padding: 0 !important;
    font-size: 14px;
    font-weight: 700;
  }
  /* PDF + Word buttons — side-by-side, equal width, no overflow */
  .class-row > .td.inline-export {
    width: 100% !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: row;
    gap: 8px;
    justify-content: stretch;
  }
  .class-row > .td.inline-export > * {
    flex: 1;
    min-width: 0;
  }
  .class-row > .td.inline-export .export-btn {
    flex: 1;
    min-width: 0;
    width: auto !important;
    justify-content: center;
  }
  /* Chevron expand button — right-aligned, immediately after PDF/Word row */
  .class-row > .td:last-child {
    width: 100% !important;
    padding: 0 !important;
    display: flex !important;
    justify-content: flex-end;
    margin-top: 4px;
  }
  .class-row > .td:last-child .expand-btn { width: auto; }

  .subject-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 8px;
  }

  /* ─── Academic Calendar ─── */
  .cal-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .cal-header-title { font-size: 15px; }
  .key-dates-grid {
    grid-template-columns: 1fr !important;
    gap: 8px;
  }
  .cal-entry-row {
    flex-wrap: wrap;
    gap: 6px;
  }
  .cal-entry-input { flex: 1 1 100%; min-width: 0; }

  /* ─── Activity Calendar ─── */
  .act-cal-header,
  .act-events-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 12px 14px;
  }
  .act-cal-header-left,
  .act-cal-header-right { width: 100%; }
  .act-cal-header-right { flex-wrap: wrap; gap: 8px; }
  .act-view-pills {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }
  .act-view-pills::-webkit-scrollbar { display: none; }
  .act-stats-strip {
    grid-template-columns: 1fr 1fr !important;
    gap: 8px;
  }
  .activity-layout-v2 {
    grid-template-columns: 1fr !important;
    gap: 12px;
  }
  .act-legend { flex-wrap: wrap; gap: 6px; }

  /* ─── ConfirmDialog (canonical) ─── */
  .confirm-dialog { max-width: 95vw !important; }
  .confirm-footer { flex-direction: column; gap: 8px; }
  .confirm-footer .confirm-btn { width: 100%; }

  /* ─── Report picker (Colorful / Colorless) ─── */
  .rp-overlay .rp-modal,
  .rp-modal { max-width: 95vw !important; max-height: 90vh !important; }
  .rp-body { padding: 12px 14px; }
}

/* ═══════════════════════════════════════════════════════════════════
   TABLET RESPONSIVE — Academics module (768px – 1023px)
   Mid-range layout for tablets — slightly compact, multi-col grids
   keep their structure.
   ═══════════════════════════════════════════════════════════════════ */
@media (min-width: 768px) and (max-width: 1023px) {
  .l2-tabs { grid-template-columns: repeat(3, 1fr); }
  .ts-stat-strip { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .key-dates-grid { grid-template-columns: repeat(2, 1fr); }
  .act-stats-strip { grid-template-columns: repeat(2, 1fr); }
  .activity-layout-v2 { grid-template-columns: 1fr; gap: 14px; }
  .subject-grid { grid-template-columns: repeat(3, 1fr); }
}

/* ══════════ RESOURCE LIBRARY ══════════ */
.rl-head { display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
.rl-head-title { font-size:17px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:9px; }
.rl-head-title i { color:var(--brand-primary); }
.rl-head-sub { font-size:12.5px; color:var(--text-muted); margin-top:3px; }

.rl-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:18px; }
.rl-stat {
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg); padding:14px 15px; box-shadow:var(--shadow-sm);
  display:flex; align-items:center; gap:12px; position:relative; overflow:hidden;
  transition:transform .2s ease, box-shadow .2s ease;
}
.rl-stat::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--accent); }
.rl-stat:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
.rl-stat-icon { width:40px; height:40px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.rl-stat-val { font-size:22px; font-weight:800; color:var(--text-primary); line-height:1.1; }
.rl-stat-lbl { font-size:11px; font-weight:600; color:var(--text-muted); margin-top:2px; }

.rl-filter-card { padding:14px 16px; margin-bottom:18px; }
.rl-filters { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.rl-search { position:relative; flex:1 1 220px; min-width:180px; }
.rl-search i { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted); font-size:12px; }
.rl-search input {
  width:100%; height:40px; padding:0 12px 0 34px; font-size:13px; font-family:var(--font-body);
  border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  background:var(--input-bg, var(--bg-card)); color:var(--text-primary); outline:none; transition:border-color .2s ease;
}
.rl-search input:focus { border-color:var(--brand-primary); }
.rl-fsel { height:40px; flex:0 1 150px; min-width:130px; }
.rl-reset { height:40px; white-space:nowrap; }
.rl-reset:disabled { opacity:.5; cursor:not-allowed; }

.rl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:14px; }
.rl-card {
  background:var(--bg-card); border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg); padding:15px 16px; box-shadow:var(--shadow-sm);
  display:flex; flex-direction:column; transition:transform .2s ease, box-shadow .2s ease;
}
.rl-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-md); }
.rl-card-top { display:flex; align-items:flex-start; gap:11px; }
.rl-card-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
.rl-card-headings { flex:1; min-width:0; }
.rl-card-title { font-size:14px; font-weight:800; color:var(--text-primary); line-height:1.35; margin-bottom:5px; }
.rl-card-meta { display:flex; flex-wrap:wrap; gap:10px; font-size:11px; color:var(--text-muted); font-weight:600; }
.rl-card-meta i { margin-right:3px; opacity:.8; }
.rl-badge { flex-shrink:0; font-size:10px; font-weight:800; padding:4px 9px; border-radius:var(--radius-full); white-space:nowrap; }
.rl-card-desc { font-size:12px; color:var(--text-secondary); line-height:1.5; margin:11px 0 0; }
.rl-card-file {
  display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;
  margin-top:12px; padding-top:11px; border-top:1px dashed var(--border-light);
  font-size:11.5px; color:var(--text-muted);
}
.rl-card-fname { display:inline-flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px; font-weight:600; }
.rl-card-fname i { color:#DC2626; }
.rl-card-date { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
.rl-card-actions { display:flex; gap:7px; margin-top:13px; flex-wrap:wrap; }
.rl-act {
  flex:1; min-width:64px; display:inline-flex; align-items:center; justify-content:center; gap:5px;
  height:33px; padding:0 8px; font-size:11.5px; font-weight:700; font-family:var(--font-body);
  border:1.5px solid var(--border-light); border-radius:var(--radius-md);
  background:var(--bg-card); color:var(--text-secondary); cursor:pointer; transition:all .18s ease;
}
.rl-act:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:rgba(30,58,138,.05); }
.rl-act-danger:hover { border-color:#DC2626; color:#DC2626; background:rgba(220,38,38,.05); }

.rl-empty { text-align:center; padding:46px 20px; }
.rl-empty-icon { width:62px; height:62px; margin:0 auto 14px; border-radius:50%; background:var(--bg-muted); display:flex; align-items:center; justify-content:center; font-size:26px; color:var(--text-muted); }
.rl-empty-title { font-size:15px; font-weight:800; color:var(--text-primary); }
.rl-empty-sub { font-size:12.5px; color:var(--text-muted); margin:6px 0 16px; }

.rl-upload {
  display:flex; align-items:center; gap:10px; padding:13px 15px; cursor:pointer;
  border:1.5px dashed var(--border-med, var(--border-light)); border-radius:var(--radius-md);
  background:var(--bg-muted); color:var(--text-secondary); font-size:12.5px; font-weight:600; transition:all .2s ease;
}
.rl-upload:hover { border-color:var(--brand-primary); color:var(--brand-primary); background:rgba(30,58,138,.04); }
.rl-upload i { font-size:16px; color:var(--brand-primary); }
.rl-upload-note { font-size:11.5px; color:var(--success); font-weight:600; margin-top:8px; display:flex; align-items:center; gap:6px; }
.rl-err { font-size:12px; color:var(--error); font-weight:600; margin-top:12px; display:flex; align-items:center; gap:7px; }

@media (max-width:980px) { .rl-stats { grid-template-columns:repeat(3,1fr); } }
@media (max-width:620px) {
  .rl-stats { grid-template-columns:repeat(2,1fr); }
  .rl-filters { flex-direction:column; align-items:stretch; }
  .rl-search, .rl-fsel, .rl-reset { flex:1 1 auto; width:100%; }
  .rl-grid { grid-template-columns:1fr; }
}


/* ═══════════════════════════════════════════════════════════════
   ERP DESIGN SYSTEM ALIGNMENT — Academics
   Canonical references: Fee / Attendance / Inventory
   ═══════════════════════════════════════════════════════════════ */
.l1-tabs,
.l2-tabs {
  display:flex;
  gap:6px;
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-lg);
  padding:5px;
  margin-bottom:18px;
  box-shadow:var(--shadow-sm);
  overflow-x:auto;
  flex-wrap:nowrap;
  -webkit-overflow-scrolling:touch;
}
.l1-tab,
.l2-tab {
  flex:1;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:8px;
  padding:11px 18px;
  border-radius:var(--radius-md);
  border:none;
  background:transparent;
  color:var(--text-muted);
  font-family:var(--font-body);
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  transition:var(--tr);
  white-space:nowrap;
}
.l1-tab:hover:not(.active),
.l2-tab:hover:not(.active) {
  background:var(--bg-muted);
  color:var(--text-primary);
  box-shadow:none;
}
.l1-tab.active,
.l2-tab.active {
  background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%);
  color:#fff;
  font-weight:600;
  box-shadow:0 6px 20px rgba(30,58,138,.4),inset 0 1px 0 rgba(255,255,255,.2);
}
.l2-tab::after,
.l2-tab.active::after,
.l2-tab-dot { display:none; }

/* Level 3 = canonical ERP segmented/pill navigation */
.l3-tabs {
  display:flex;
  width:100%;
  gap:4px;
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-full);
  padding:5px;
  margin-bottom:18px;
  box-shadow:var(--shadow-sm);
  overflow-x:auto;
}
.l3-tab {
  flex:1;
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  padding:10px 16px;
  border:none;
  border-radius:var(--radius-full);
  background:transparent;
  color:var(--text-muted);
  box-shadow:none;
  font-family:var(--font-body);
  font-size:13px;
  font-weight:700;
  text-align:center;
  cursor:pointer;
  transition:var(--tr);
  white-space:nowrap;
}
.l3-tab:hover:not(.active) {
  background:var(--bg-muted);
  color:var(--text-primary);
  border-color:transparent;
  box-shadow:none;
  transform:none;
}
.l3-tab.active {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff;
  border-color:transparent;
  box-shadow:0 4px 12px rgba(30,58,138,.3);
  transform:none;
}
.l3-tab-icon {
  width:auto;
  height:auto;
  min-width:0;
  border-radius:0;
  background:transparent;
  color:inherit;
  font-size:12px;
}
.l3-tab-text { display:flex; align-items:center; }
.l3-tab-desc { display:none; }

/* In-screen subtabs use the same ERP segmented control language */
.ts-subtab-row,
.act-view-pills {
  display:flex;
  gap:4px;
  background:var(--bg-card);
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-full);
  padding:5px;
  box-shadow:var(--shadow-sm);
  overflow-x:auto;
}
.ts-subtab,
.act-view-pill {
  flex:1;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  padding:9px 14px;
  border:none;
  border-radius:var(--radius-full);
  background:transparent;
  color:var(--text-muted);
  font-family:var(--font-body);
  font-size:12.5px;
  font-weight:600;
  cursor:pointer;
  transition:var(--tr);
  white-space:nowrap;
}
.ts-subtab:hover:not(.active),
.act-view-pill:hover:not(.active) {
  background:var(--bg-muted);
  color:var(--text-primary);
}
.ts-subtab.active,
.act-view-pill.active {
  background:linear-gradient(135deg,#1E3A8A,#1E40AF);
  color:#fff;
  box-shadow:0 4px 12px rgba(30,58,138,.3);
}

/* Canonical ERP action buttons */
.ts-btn-primary,
.act-add-btn {
  height:40px;
  padding:0 20px;
  border:none;
  border-radius:var(--radius-md);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  color:#fff;
  font-family:var(--font-body);
  font-size:13px;
  font-weight:600;
  cursor:pointer;
  transition:var(--tr);
  box-shadow:0 4px 14px rgba(30,58,138,.28);
}
.ts-btn-primary:hover,
.act-add-btn:hover {
  transform:translateY(-1px);
  box-shadow:0 8px 20px rgba(30,58,138,.38);
}
.ts-btn-ghost {
  height:40px;
  padding:0 20px;
  border:1.5px solid var(--border-light);
  border-radius:var(--radius-md);
  background:var(--bg-card);
  color:var(--text-secondary);
  font-family:var(--font-body);
  font-size:13px;
  font-weight:600;
}
.ts-btn-ghost:hover {
  background:var(--bg-muted);
  border-color:var(--border-med);
  color:var(--text-primary);
}

@media (max-width:768px) {
  .l1-tabs,.l2-tabs { padding:4px; gap:3px; margin-bottom:14px; }
  .l1-tab,.l2-tab { flex:0 0 auto; padding:9px 12px; font-size:11.5px; gap:5px; }
  .l3-tabs { padding:4px; gap:3px; border-radius:14px; }
  .l3-tab { flex:0 0 auto; padding:8px 12px; font-size:11.5px; }
  .ts-subtab-row,.act-view-pills { padding:4px; }
  .ts-subtab,.act-view-pill { flex:0 0 auto; padding:8px 11px; font-size:11.5px; }
}

/* ══════════ RELEASES FROM HEAD OFFICE ══════════ */
.ho-banner {
  display:flex; align-items:center; gap:14px; width:100%; text-align:left; cursor:pointer;
  background:linear-gradient(135deg,rgba(30,58,138,.06),rgba(37,99,235,.03));
  border:1.5px solid var(--border-light); border-left:4px solid var(--brand-primary);
  border-radius:var(--radius-lg); padding:14px 18px; margin-bottom:18px;
  box-shadow:var(--shadow-sm); font-family:var(--font-body); transition:all .2s ease;
}
.ho-banner:hover { box-shadow:var(--shadow-md); transform:translateY(-1px); border-left-color:#2563EB; }
.ho-banner-icon { width:44px; height:44px; border-radius:12px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:18px; color:#fff; background:linear-gradient(135deg,#1E3A8A,#2563EB); }
.ho-banner-text { flex:1; min-width:0; }
.ho-banner-title { font-size:14.5px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:8px; }
.ho-banner-arrow { font-size:11px; color:var(--brand-primary); transition:transform .2s ease; }
.ho-banner:hover .ho-banner-arrow { transform:translateX(4px); }
.ho-banner-sub { font-size:12px; color:var(--text-muted); margin-top:2px; }
.ho-banner-badge { flex-shrink:0; display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:800; color:#16A34A; background:rgba(22,163,74,.12); padding:5px 11px; border-radius:var(--radius-full); }

/* full-screen releases panel */
.ho-screen { position:fixed; inset:0; z-index:10000; background:var(--bg-page, #F1F5F9); display:flex; flex-direction:column; animation:hoFade .2s ease; }
[data-theme="dark"] .ho-screen { background:var(--bg-page, #0F172A); }
@keyframes hoFade { from{opacity:0} to{opacity:1} }
.ho-screen-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:18px 26px; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; flex-shrink:0; box-shadow:0 4px 16px rgba(30,58,138,.25); }
.ho-screen-head-left { display:flex; align-items:center; gap:14px; min-width:0; }
.ho-screen-icon { width:46px; height:46px; border-radius:13px; background:rgba(255,255,255,.16); display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0; }
.ho-screen-title { font-size:18px; font-weight:800; }
.ho-screen-sub { font-size:12.5px; color:rgba(255,255,255,.85); margin-top:2px; }
.ho-screen-close { width:38px; height:38px; border-radius:10px; border:1.5px solid rgba(255,255,255,.3); background:rgba(255,255,255,.12); color:#fff; cursor:pointer; font-size:16px; transition:all .2s ease; flex-shrink:0; }
.ho-screen-close:hover { background:rgba(255,255,255,.24); }
.ho-screen-body { flex:1; overflow:auto; padding:24px 26px; }

.ho-rel-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(330px,1fr)); gap:18px; max-width:1200px; margin:0 auto; }
.ho-rel-card { background:var(--bg-card); border:1.5px solid var(--border-light); border-radius:var(--radius-xl); padding:18px 19px; box-shadow:var(--shadow-sm); display:flex; flex-direction:column; transition:transform .2s ease, box-shadow .2s ease; }
.ho-rel-card:hover { transform:translateY(-3px); box-shadow:var(--shadow-lg); }
.ho-rel-card.master { border-top:3px solid #1E40AF; }
.ho-rel-card.sub { border-top:3px solid #7C3AED; }
.ho-rel-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:12px; }
.ho-rel-card-name { font-size:17px; font-weight:800; color:var(--text-primary); margin-bottom:7px; }
.ho-type-badge { display:inline-flex; align-items:center; gap:6px; font-size:10.5px; font-weight:800; padding:3px 9px; border-radius:var(--radius-full); }
.ho-type-badge.master { background:rgba(30,64,175,.1); color:#1E40AF; }
.ho-type-badge.sub { background:rgba(124,58,237,.1); color:#7C3AED; }
.ho-live-badge { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:800; color:#16A34A; background:rgba(22,163,74,.12); padding:4px 9px; border-radius:var(--radius-full); flex-shrink:0; }
.ho-rel-by { font-size:11.5px; color:var(--text-muted); font-weight:600; display:flex; align-items:center; gap:7px; margin-bottom:12px; }
.ho-rel-by i { color:var(--brand-primary); }
.ho-rel-dates { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; padding:12px; background:var(--bg-muted); border-radius:var(--radius-md); margin-bottom:14px; }
.ho-rel-dates > div { display:flex; flex-direction:column; gap:2px; }
.ho-rel-dates span { font-size:9.5px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--text-muted); }
.ho-rel-dates strong { font-size:12px; font-weight:800; color:var(--text-primary); }
.ho-rel-dates .ho-days { color:#16A34A; }
.ho-rel-inc { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted); margin-bottom:8px; }
.ho-rel-chips { display:flex; flex-direction:column; gap:7px; margin-bottom:16px; }
.ho-rel-chips span { display:flex; align-items:center; gap:9px; font-size:12.5px; font-weight:600; color:var(--text-secondary); }
.ho-rel-chips i { width:16px; text-align:center; color:var(--brand-primary); }
.ho-rel-view { margin-top:auto; justify-content:center; }

/* details modal */
.ho-detail-modal { max-width:780px; width:96%; }
.ho-sum-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:11px; margin-bottom:18px; }
.ho-sum { display:flex; align-items:center; gap:11px; padding:13px 14px; border:1.5px solid var(--border-light); border-radius:var(--radius-lg); background:var(--bg-card); position:relative; overflow:hidden; }
.ho-sum::before { content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--accent); }
.ho-sum > i { font-size:17px; color:var(--accent); }
.ho-sum-v { font-size:19px; font-weight:800; color:var(--text-primary); line-height:1; }
.ho-sum-l { font-size:11px; font-weight:600; color:var(--text-muted); margin-top:3px; }
.ho-sec-tabs { display:flex; gap:7px; flex-wrap:wrap; border-bottom:1.5px solid var(--border-light); padding-bottom:12px; margin-bottom:14px; }
.ho-sec-tab { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 13px; font-size:12.5px; font-weight:700; font-family:var(--font-body); border:1.5px solid var(--border-light); border-radius:var(--radius-md); background:var(--bg-card); color:var(--text-secondary); cursor:pointer; transition:all .18s ease; }
.ho-sec-tab:hover { border-color:var(--brand-primary); color:var(--brand-primary); }
.ho-sec-tab.active { background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; border-color:transparent; box-shadow:0 4px 12px rgba(30,58,138,.3); }
.ho-sec-n { font-size:10.5px; font-weight:800; background:rgba(0,0,0,.08); padding:1px 7px; border-radius:var(--radius-full); }
.ho-sec-tab.active .ho-sec-n { background:rgba(255,255,255,.25); }
.ho-sec { display:flex; flex-direction:column; gap:10px; }
.ho-sec-bar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; font-size:12px; color:var(--text-muted); margin-bottom:2px; }
.ho-saveall { height:34px; }
.ho-none { text-align:center; padding:26px; color:var(--text-muted); font-size:13px; font-style:italic; }
.ho-item { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; padding:14px 15px; border:1.5px solid var(--border-light); border-radius:var(--radius-lg); background:var(--bg-card); transition:border-color .18s ease; }
.ho-item:hover { border-color:var(--border-med, var(--border-light)); }
.ho-item-main { flex:1; min-width:200px; }
.ho-item-title { font-size:14px; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
.ho-item-sub { font-size:12.5px; color:var(--text-secondary); margin-top:3px; }
.ho-item-meta { display:flex; flex-wrap:wrap; gap:12px; font-size:11.5px; color:var(--text-muted); font-weight:600; margin-top:8px; }
.ho-item-meta i { margin-right:4px; opacity:.85; }
.ho-item-tag { background:rgba(30,64,175,.1); color:#1E40AF; padding:1px 8px; border-radius:var(--radius-full); font-size:10.5px; font-weight:800; text-transform:capitalize; }
.ho-item-line { font-size:12px; color:var(--text-secondary); margin-top:6px; line-height:1.45; }
.ho-item-line b { color:var(--text-primary); font-weight:700; }
.ho-item-actions { display:flex; flex-direction:column; gap:8px; align-items:flex-end; flex-shrink:0; }
.ho-save-btn { white-space:nowrap; }
.ho-saved-badge { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:800; color:#16A34A; background:rgba(22,163,74,.12); padding:7px 13px; border-radius:var(--radius-md); white-space:nowrap; }
.ho-map-from { font-size:12px; color:var(--text-muted); background:var(--bg-muted); padding:9px 12px; border-radius:var(--radius-md); margin-bottom:14px; }
.ho-map-from i { color:var(--brand-primary); margin-right:5px; }
.ho-map-from strong { color:var(--text-primary); }
.ho-prev { display:flex; flex-direction:column; gap:9px; }
.ho-prev-row { display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:12.5px; padding-bottom:9px; border-bottom:1px dashed var(--border-light); }
.ho-prev-row span { color:var(--text-muted); font-weight:600; }
.ho-prev-row strong { color:var(--text-primary); font-weight:800; text-align:right; }
.ho-prev-desc { font-size:12.5px; color:var(--text-secondary); line-height:1.5; background:var(--bg-muted); padding:11px; border-radius:var(--radius-md); margin-top:4px; }

@media (max-width:760px) {
  .ho-sum-grid { grid-template-columns:repeat(2,1fr); }
  .ho-rel-grid { grid-template-columns:1fr; }
  .ho-item-actions { flex-direction:row; align-items:center; width:100%; flex-wrap:wrap; }
}
`;
