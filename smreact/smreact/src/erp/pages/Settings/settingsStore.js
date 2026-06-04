import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS STORE — sessions + signatures + global current session

   In-memory React Context store. No external state library, no fetch
   calls. Replace the seed arrays with real API calls when wiring to
   a backend; everything else is API-shaped.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Reference constants ─────────────────────────────────────────── */

/* The 12 ERP modules a session can apply to. Kept in nav order so the
   checkbox grid reads naturally top-to-bottom. */
export const MODULE_OPTIONS = [
  { id: 'acad',      label: 'Academics' },
  { id: 'exam',      label: 'Examination' },
  { id: 'paper',     label: 'Paper Generator' },
  { id: 'att',       label: 'Attendance' },
  { id: 'tt',        label: 'Time Table' },
  { id: 'fee',       label: 'Fee' },
  { id: 'accounts',  label: 'Accounts' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'crm',       label: 'Admission CRM' },
  { id: 'students',  label: 'Students' },
  { id: 'hr',        label: 'HR' },
  { id: 'appraisal', label: 'Appraisals' },
];
const ALL_MODULE_IDS = MODULE_OPTIONS.map(m => m.id);

/* Documents a signature can be applied to. */
export const DOCUMENT_OPTIONS = [
  { id: 'result_cards',           label: 'Result Cards' },
  { id: 'student_certificates',   label: 'Student Certificates' },
  { id: 'staff_certificates',     label: 'Staff Certificates' },
  { id: 'appraisal_letters',      label: 'Appraisal Letters' },
  { id: 'hr_letters',             label: 'HR Letters' },
  { id: 'experience_letters',     label: 'Experience Letters' },
  { id: 'character_certificates', label: 'Character Certificates' },
  { id: 'admission_forms',        label: 'Admission Forms' },
  { id: 'fee_reports',            label: 'Fee Reports' },
  { id: 'examination_reports',    label: 'Examination Reports' },
  { id: 'academic_reports',       label: 'Academic Reports' },
  { id: 'general_reports',        label: 'General Reports' },
  { id: 'custom_documents',       label: 'Custom Documents' },
];

/* A small mock staff list used by the signature form dropdown. */
export const SIGNATURE_STAFF_OPTIONS = [
  { id: 1, name: 'Dr. Islahudin',     designation: 'Principal' },
  { id: 2, name: 'Mr. Ahmed Khan',    designation: 'Vice Principal' },
  { id: 3, name: 'Ms. Sarah Noor',    designation: 'HR Manager' },
  { id: 4, name: 'Ms. Nadia Iqbal',   designation: 'Senior Coordinator' },
  { id: 5, name: 'Mr. Bilal Hussain', designation: 'Academic Head' },
  { id: 6, name: 'Ms. Amna Farooq',   designation: 'Accounts Manager' },
];

/* ─── Seed data ───────────────────────────────────────────────────── */

const INITIAL_SESSIONS = [
  {
    id: 1,
    name: '2023–2024',
    startDate: '2023-08-01',
    endDate:   '2024-07-31',
    status:    'past',
    locked:    true,
    modules:   [...ALL_MODULE_IDS],
    notes:     'Closed academic year. Historical records preserved.',
    createdBy: 'Dr. Islahudin',
    createdAt: '2023-07-15',
    updatedAt: '2024-08-05',
  },
  {
    id: 2,
    name: '2024–2025',
    startDate: '2024-08-01',
    endDate:   '2025-07-31',
    status:    'current',
    locked:    false,
    modules:   [...ALL_MODULE_IDS],
    notes:     'Active academic year. All modules operating on this session.',
    createdBy: 'Dr. Islahudin',
    createdAt: '2024-07-10',
    updatedAt: '2025-04-12',
  },
  {
    id: 3,
    name: '2025–2026',
    startDate: '2025-08-01',
    endDate:   '2026-07-31',
    status:    'upcoming',
    locked:    false,
    modules:   [...ALL_MODULE_IDS],
    notes:     'Planned upcoming academic year. Configuration in preparation.',
    createdBy: 'Dr. Islahudin',
    createdAt: '2025-03-20',
    updatedAt: '2025-04-01',
  },
];

const INITIAL_SIGNATURES = [
  {
    id: 1,
    staffId: 1,
    staffName: 'Dr. Islahudin',
    designation: 'Principal',
    title: "Principal's Signature",
    imageDataUrl: '',
    documents: ['result_cards', 'student_certificates', 'appraisal_letters', 'hr_letters', 'character_certificates', 'academic_reports'],
    status: 'active',
    createdAt: '2024-08-01',
    updatedAt: '2024-08-01',
  },
  {
    id: 2,
    staffId: 2,
    staffName: 'Mr. Ahmed Khan',
    designation: 'Vice Principal',
    title: 'VP Signature',
    imageDataUrl: '',
    documents: ['result_cards', 'student_certificates', 'admission_forms', 'general_reports'],
    status: 'active',
    createdAt: '2024-08-01',
    updatedAt: '2024-08-01',
  },
  {
    id: 3,
    staffId: 3,
    staffName: 'Ms. Sarah Noor',
    designation: 'HR Manager',
    title: 'HR Authorization',
    imageDataUrl: '',
    documents: ['hr_letters', 'experience_letters', 'staff_certificates', 'appraisal_letters'],
    status: 'active',
    createdAt: '2024-09-15',
    updatedAt: '2024-09-15',
  },
];

/* ─── Context + provider ──────────────────────────────────────────── */

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [sessions,   setSessions]   = useState(INITIAL_SESSIONS);
  const [signatures, setSignatures] = useState(INITIAL_SIGNATURES);

  const currentSession = useMemo(
    () => sessions.find(s => s.status === 'current') || null,
    [sessions],
  );

  /* Promote `id` to current, demote the existing current. The old current
     becomes 'past' if its end date has elapsed, or 'upcoming' otherwise. */
  const setAsCurrent = useCallback((id) => {
    setSessions(prev => {
      const today = new Date().toISOString().slice(0, 10);
      return prev.map(s => {
        if (s.id === id) return { ...s, status: 'current', updatedAt: today };
        if (s.status === 'current') {
          const isPast = s.endDate < today;
          return { ...s, status: isPast ? 'past' : 'upcoming', locked: isPast, updatedAt: today };
        }
        return s;
      });
    });
  }, []);

  const upsertSession = useCallback((payload) => {
    setSessions(prev => {
      const today = new Date().toISOString().slice(0, 10);
      if (payload.id) {
        return prev.map(s => (s.id === payload.id ? { ...s, ...payload, updatedAt: today } : s));
      }
      const nextId = prev.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      return [...prev, { ...payload, id: nextId, createdBy: 'Dr. Islahudin', createdAt: today, updatedAt: today }];
    });
  }, []);

  const deleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  const toggleSessionLock = useCallback((id) => {
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, locked: !s.locked } : s)));
  }, []);

  const upsertSignature = useCallback((payload) => {
    setSignatures(prev => {
      const today = new Date().toISOString().slice(0, 10);
      if (payload.id) {
        return prev.map(s => (s.id === payload.id ? { ...s, ...payload, updatedAt: today } : s));
      }
      const nextId = prev.reduce((m, s) => Math.max(m, s.id), 0) + 1;
      return [...prev, { ...payload, id: nextId, createdAt: today, updatedAt: today }];
    });
  }, []);

  const deleteSignature = useCallback((id) => {
    setSignatures(prev => prev.filter(s => s.id !== id));
  }, []);

  const toggleSignatureStatus = useCallback((id) => {
    setSignatures(prev => prev.map(s => (s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s)));
  }, []);

  const value = useMemo(() => ({
    sessions, setSessions, currentSession,
    setAsCurrent, upsertSession, deleteSession, toggleSessionLock,
    signatures, setSignatures,
    upsertSignature, deleteSignature, toggleSignatureStatus,
  }), [sessions, signatures, currentSession, setAsCurrent, upsertSession, deleteSession, toggleSessionLock, upsertSignature, deleteSignature, toggleSignatureStatus]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  /* If the provider isn't mounted (shouldn't happen since App wraps the
     whole tree, but be defensive), return a safe empty shape so consuming
     components don't blow up. */
  return ctx || {
    sessions: [], signatures: [], currentSession: null,
    setAsCurrent: () => {},
    upsertSession: () => {}, deleteSession: () => {}, toggleSessionLock: () => {},
    upsertSignature: () => {}, deleteSignature: () => {}, toggleSignatureStatus: () => {},
  };
}

/* ─── Topbar Current Session pill ─────────────────────────────────── */

const TOPBAR_PILL_CSS = `
.settings-topbar-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 12px;
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  border-radius: 999px;
  font-family: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif;
  font-size: 11.5px;
  font-weight: 700;
  color: #1E3A8A;
  letter-spacing: -.005em;
  white-space: nowrap;
}
.settings-topbar-pill i { font-size: 11px; color: #1E40AF; }
[data-theme="dark"] .settings-topbar-pill {
  background: rgba(30, 64, 175, .14);
  border-color: rgba(30, 64, 175, .35);
  color: #BFDBFE;
}
[data-theme="dark"] .settings-topbar-pill i { color: #93C5FD; }
@media (max-width: 720px) {
  .settings-topbar-pill { display: none; }
}
`;

/* Used in the global topbar (next to the theme toggle). Reads from
   context, so it updates the moment the current session changes. */
export function TopbarSessionPill() {
  const { currentSession } = useSettings();
  if (!currentSession) return null;
  return (
    <>
      <style>{TOPBAR_PILL_CSS}</style>
      <div className="settings-topbar-pill" role="status" aria-label={`Current session ${currentSession.name}`}>
        <i className="fa-solid fa-calendar" aria-hidden="true"></i>
        <span>Session: {currentSession.name}</span>
      </div>
    </>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

/* Plain English status → tone mapping used by every badge. */
export function sessionStatusTone(status) {
  switch (status) {
    case 'current':  return 'green';
    case 'upcoming': return 'blue';
    case 'past':     return 'gray';
    default:         return 'gray';
  }
}

export function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

/* Returns progress 0-1 for the given session based on today's date. */
export function sessionProgress(session) {
  if (!session?.startDate || !session?.endDate) return 0;
  const today = new Date().getTime();
  const start = new Date(session.startDate).getTime();
  const end   = new Date(session.endDate).getTime();
  if (today <= start) return 0;
  if (today >= end)   return 1;
  return (today - start) / (end - start);
}
