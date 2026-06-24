import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildUrl } from '../../../utils/apiConfig';

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
/* ─── Academic-session API wiring ─────────────────────────────────────
   GET    /api/Setting/get-academic-sessions-by-branch/{branchID}
   POST   /api/Setting/save-academic-session   (id:0 → insert, id>0 → update)
   DELETE /api/Setting/delete-academic-session/{id}

   Maps between the API's PascalCase / per-module boolean shape and the
   internal session shape used across the Settings UI. */

/* internal module id ↔ API field names (read uses PascalCase, save uses camelCase). */
const MODULE_API_MAP = [
  { id: 'acad',      readKey: 'Academics',      saveKey: 'academics' },
  { id: 'exam',      readKey: 'Examination',    saveKey: 'examination' },
  { id: 'paper',     readKey: 'PaperGenerator', saveKey: 'paperGenerator' },
  { id: 'att',       readKey: 'Attendance',     saveKey: 'attendance' },
  { id: 'tt',        readKey: 'TimeTable',      saveKey: 'timeTable' },
  { id: 'fee',       readKey: 'Fee',            saveKey: 'fee' },
  { id: 'accounts',  readKey: 'Accounts',       saveKey: 'accounts' },
  { id: 'inventory', readKey: 'Inventory',      saveKey: 'inventory' },
  { id: 'crm',       readKey: 'AdmissionCRM',   saveKey: 'admissionCRM' },
  { id: 'students',  readKey: 'Students',       saveKey: 'students' },
  { id: 'hr',        readKey: 'HR',             saveKey: 'hr' },
  { id: 'appraisal', readKey: 'Appraisals',     saveKey: 'appraisals' },
];

function sessionBranchId() {
  return sessionStorage.getItem('branchID') || '1';
}

function sessionAuthHeaders() {
  const token = sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    Accept: '*/*',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/* Normalise a CRUD response into { ok, message } using the API's own message.
   `success` is honoured when present; otherwise we infer failure from the text. */
export function settingResult(resp, fallbackMsg) {
  const message = resp?.message || resp?.Message || resp?.title || fallbackMsg;
  let ok;
  if (typeof resp?.success === 'boolean')      ok = resp.success;
  else if (/fail|error|not\s|cannot|invalid/i.test(message || '')) ok = false;
  else                                          ok = true;
  return { ok, message: message || fallbackMsg };
}

/* API row (PascalCase) → internal session shape. */
function sessionFromApi(row) {
  const status = String(row.Status || '').toLowerCase() || 'upcoming';
  return {
    id:        row.ID,
    name:      row.SessionName || '',
    status,
    startDate: String(row.StartDate || '').slice(0, 10),
    endDate:   String(row.EndDate || '').slice(0, 10),
    notes:     row.Notes || '',
    modules:   MODULE_API_MAP.filter(m => row[m.readKey]).map(m => m.id),
    locked:    status === 'past',
    createdBy: row.CreatedBy,
    createdAt: String(row.CreatedAt || '').slice(0, 10),
    updatedAt: String(row.ModifiedAt || '').slice(0, 10),
    isActive:  row.IsActive,
  };
}

/* internal session shape → save payload (camelCase + per-module booleans). */
function sessionToPayload(s) {
  const modSet = new Set(s.modules || []);
  const cap = (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : '');
  const payload = {
    id:          s.id || 0,
    branchID:    parseInt(sessionBranchId(), 10) || 1,
    sessionName: s.name || '',
    status:      cap(s.status) || 'Upcoming',
    startDate:   s.startDate ? new Date(s.startDate).toISOString() : null,
    endDate:     s.endDate ? new Date(s.endDate).toISOString() : null,
    notes:       s.notes || '',
    createdBy:   1,
    modifiedBy:  s.id ? 1 : 0,
  };
  MODULE_API_MAP.forEach(m => { payload[m.saveKey] = modSet.has(m.id); });
  return payload;
}

/* GET sessions for the active branch. Returns [] when the API reports none.
   `cache: 'no-store'` so a save is always followed by fresh data. */
export async function apiGetSessions() {
  const res = await fetch(
    buildUrl(`/api/Setting/get-academic-sessions-by-branch/${sessionBranchId()}`),
    { method: 'GET', headers: sessionAuthHeaders(), cache: 'no-store' },
  );
  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  return data.map(sessionFromApi);
}

/* POST insert (id:0) or update (id>0). */
export async function apiSaveSession(session) {
  const res = await fetch(buildUrl('/api/Setting/save-academic-session'), {
    method: 'POST',
    headers: sessionAuthHeaders(),
    body: JSON.stringify(sessionToPayload(session)),
  });
  return res.json().catch(() => ({}));
}

/* DELETE one session by id. */
export async function apiDeleteSession(id) {
  const res = await fetch(buildUrl(`/api/Setting/delete-academic-session/${id}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  return res.json().catch(() => ({}));
}

/* GET branch employees for the signature staff dropdown.
   GET /api/LaunchSetup/get-employees-by-branch/{branchID}
   Maps each active employee to { id, name, designation, image }. */
export async function apiGetEmployees() {
  const res = await fetch(
    buildUrl(`/api/LaunchSetup/get-employees-by-branch/${sessionBranchId()}`),
    { method: 'GET', headers: sessionAuthHeaders(), cache: 'no-store' },
  );
  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  return data
    .filter(e => e.isActive !== false)
    .map(e => ({
      id:          e.id,
      name:        `${e.firstName || ''} ${e.lastName || ''}`.trim() || `Employee #${e.id}`,
      designation: e.designationName || '',
      image:       e.empImage || '',
    }));
}

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

/* ─── Signature API wiring ────────────────────────────────────────────
   GET  /api/Setting/get-signatures-by-branch/{branchID}
   POST /api/Setting/save-signature   (multipart/form-data; ID:0 → insert)
   DELETE /api/Setting/delete-signature/{id}   (assumed, mirrors sessions) */

/* internal document id ↔ API field name (PascalCase, same for read + save). */
const SIGNATURE_DOC_MAP = [
  { id: 'result_cards',           key: 'ResultCards' },
  { id: 'student_certificates',   key: 'StudentCertificates' },
  { id: 'staff_certificates',     key: 'StaffCertificates' },
  { id: 'appraisal_letters',      key: 'AppraisalLetters' },
  { id: 'hr_letters',             key: 'HRLetters' },
  { id: 'experience_letters',     key: 'ExperienceLetters' },
  { id: 'character_certificates', key: 'CharacterCertificates' },
  { id: 'admission_forms',        key: 'AdmissionForms' },
  { id: 'fee_reports',            key: 'FeeReports' },
  { id: 'examination_reports',    key: 'ExaminationReports' },
  { id: 'academic_reports',       key: 'AcademicReports' },
  { id: 'general_reports',        key: 'GeneralReports' },
  { id: 'custom_documents',       key: 'CustomDocuments' },
];

/* Auth header for multipart posts — note: NO Content-Type, the browser must
   set the multipart boundary itself. */
function signatureAuthHeaders() {
  const token = sessionStorage.getItem('token');
  return { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

/* API row (PascalCase) → internal signature shape. */
function signatureFromApi(row) {
  return {
    id:           row.ID,
    staffId:      row.UserID,
    staffName:    row.UserName || '',
    designation:  row.DesignationName || '',
    department:   row.DepartmentName || '',
    title:        row.SignatureTitle || '',
    imageDataUrl: row.SignatureImage || '',        // already a full URL
    status:       String(row.Status || '').toLowerCase() === 'active' ? 'active' : 'inactive',
    documents:    SIGNATURE_DOC_MAP.filter(d => row[d.key]).map(d => d.id),
    createdAt:    String(row.CreatedAt || '').slice(0, 10),
    updatedAt:    String(row.ModifiedAt || '').slice(0, 10),
  };
}

/* GET signatures for the active branch. Returns [] when the API reports none. */
export async function apiGetSignatures() {
  const res = await fetch(
    buildUrl(`/api/Setting/get-signatures-by-branch/${sessionBranchId()}`),
    { method: 'GET', headers: signatureAuthHeaders(), cache: 'no-store' },
  );
  const json = await res.json();
  const data = Array.isArray(json?.data) ? json.data : [];
  return data.map(signatureFromApi);
}

/* POST insert (id:0) or update (id>0) as multipart/form-data.
   `sig.imageFile` (a File) is sent only when the user picked a new image;
   otherwise the existing image URL is preserved via `SignatureImage`. */
export async function apiSaveSignature(sig) {
  const docSet = new Set(sig.documents || []);
  const fd = new FormData();
  fd.append('ID', String(sig.id || 0));
  fd.append('BranchID', String(parseInt(sessionBranchId(), 10) || 1));
  fd.append('UserID', String(sig.staffId || 0));
  fd.append('SignatureTitle', sig.title || '');
  fd.append('Status', sig.status === 'inactive' ? 'Inactive' : 'Active');
  SIGNATURE_DOC_MAP.forEach(d => fd.append(d.key, docSet.has(d.id) ? 'true' : 'false'));
  fd.append('CreatedBy', '1');
  fd.append('ModifiedBy', '1');
  fd.append('SignatureImage', sig.imageDataUrl || '');
  if (sig.imageFile instanceof File) fd.append('SignatureImageFile', sig.imageFile);

  const res = await fetch(buildUrl('/api/Setting/save-signature'), {
    method: 'POST',
    headers: signatureAuthHeaders(),
    body: fd,
  });
  return res.json().catch(() => ({}));
}

/* DELETE one signature by id. */
export async function apiDeleteSignature(id) {
  const res = await fetch(buildUrl(`/api/Setting/delete-signature/${id}`), {
    method: 'DELETE',
    headers: signatureAuthHeaders(),
  });
  return res.json().catch(() => ({}));
}

/* A small mock staff list used by the signature form dropdown. */
export const SIGNATURE_STAFF_OPTIONS = [
  { id: 1, name: 'Dr. Islahudin',     designation: 'Principal' },
  { id: 2, name: 'Mr. Ahmed Khan',    designation: 'Vice Principal' },
  { id: 3, name: 'Ms. Sarah Noor',    designation: 'HR Manager' },
  { id: 4, name: 'Ms. Nadia Iqbal',   designation: 'Senior Coordinator' },
  { id: 5, name: 'Mr. Bilal Hussain', designation: 'Academic Head' },
  { id: 6, name: 'Ms. Amna Farooq',   designation: 'Accounts Manager' },
];

/* ─── Context + provider ──────────────────────────────────────────── */

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [sessions,   setSessions]   = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [signatures, setSignatures] = useState([]);
  const [signaturesLoading, setSignaturesLoading] = useState(true);

  const currentSession = useMemo(
    () => sessions.find(s => s.status === 'current') || null,
    [sessions],
  );

  /* Load sessions from the API for the active branch. Empty response → empty list. */
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await apiGetSessions());
    } catch (err) {
      console.error('Could not load academic sessions:', err);
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  /* Load signatures from the API for the active branch. Empty response → empty list. */
  const loadSignatures = useCallback(async () => {
    setSignaturesLoading(true);
    try {
      setSignatures(await apiGetSignatures());
    } catch (err) {
      console.error('Could not load signatures:', err);
      setSignatures([]);
    } finally {
      setSignaturesLoading(false);
    }
  }, []);

  useEffect(() => { loadSignatures(); }, [loadSignatures]);

  /* Promote `id` to current, demote the existing current. The old current
     becomes 'past' if its end date has elapsed, or 'upcoming' otherwise.
     Persists both changes via the save API, then reloads from the server. */
  const setAsCurrent = useCallback(async (id) => {
    const today = new Date().toISOString().slice(0, 10);
    const chosen = sessions.find(s => s.id === id);
    if (!chosen) return;
    const prevCurrent = sessions.find(s => s.status === 'current' && s.id !== id);
    try {
      await apiSaveSession({ ...chosen, status: 'current' });
      if (prevCurrent) {
        const isPast = prevCurrent.endDate < today;
        await apiSaveSession({ ...prevCurrent, status: isPast ? 'past' : 'upcoming' });
      }
    } catch (err) {
      console.error('Could not set current session:', err);
    }
    await loadSessions();
  }, [sessions, loadSessions]);

  const upsertSession = useCallback(async (payload) => {
    let result = { ok: false, message: 'Could not save academic session' };
    try {
      result = settingResult(await apiSaveSession(payload), 'Academic session saved');
    } catch (err) {
      console.error('Could not save academic session:', err);
    }
    await loadSessions();
    return result;
  }, [loadSessions]);

  const deleteSession = useCallback(async (id) => {
    let result = { ok: false, message: 'Could not delete academic session' };
    try {
      result = settingResult(await apiDeleteSession(id), 'Academic session deleted');
    } catch (err) {
      console.error('Could not delete academic session:', err);
    }
    await loadSessions();
    return result;
  }, [loadSessions]);

  const toggleSessionLock = useCallback((id) => {
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, locked: !s.locked } : s)));
  }, []);

  const upsertSignature = useCallback(async (payload) => {
    let result = { ok: false, message: 'Could not save signature' };
    try {
      result = settingResult(await apiSaveSignature(payload), 'Signature saved');
    } catch (err) {
      console.error('Could not save signature:', err);
    }
    await loadSignatures();
    return result;
  }, [loadSignatures]);

  const deleteSignature = useCallback(async (id) => {
    let result = { ok: false, message: 'Could not delete signature' };
    try {
      result = settingResult(await apiDeleteSignature(id), 'Signature deleted');
    } catch (err) {
      console.error('Could not delete signature:', err);
    }
    await loadSignatures();
    return result;
  }, [loadSignatures]);

  const toggleSignatureStatus = useCallback(async (id) => {
    const sig = signatures.find(s => s.id === id);
    if (!sig) return;
    try {
      await apiSaveSignature({ ...sig, status: sig.status === 'active' ? 'inactive' : 'active' });
    } catch (err) {
      console.error('Could not update signature status:', err);
    }
    await loadSignatures();
  }, [signatures, loadSignatures]);

  const value = useMemo(() => ({
    sessions, setSessions, currentSession, sessionsLoading, reloadSessions: loadSessions,
    setAsCurrent, upsertSession, deleteSession, toggleSessionLock,
    signatures, setSignatures, signaturesLoading, reloadSignatures: loadSignatures,
    upsertSignature, deleteSignature, toggleSignatureStatus,
  }), [sessions, signatures, currentSession, sessionsLoading, loadSessions, signaturesLoading, loadSignatures, setAsCurrent, upsertSession, deleteSession, toggleSessionLock, upsertSignature, deleteSignature, toggleSignatureStatus]);

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
    sessionsLoading: false, reloadSessions: () => {},
    signaturesLoading: false, reloadSignatures: () => {},
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
