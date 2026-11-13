import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildUrl, resolveMediaUrl, storeCurrentSession, refreshActiveAcademicSession,
  loadActiveAcademicSessionOnce, readStoredActiveSession, SESSION_CHANGE_EVENT,
} from '../../../utils/apiConfig';

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
  { id: 'tt',        label: 'Timetable' },
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

/* Login-time active-session row (get-academic-active-sessions-by-branch, stored in
   sessionStorage) → internal session shape. Returns null when the row can't
   safely stand in for the full list's "current" session (no module flags, or a
   non-current status) — the provider then falls back to the full sessions GET. */
const truthyFlag = (v) => v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
function sessionFromActiveRow(row) {
  if (!row || (row.ID == null && row.id == null)) return null;
  if (!MODULE_API_MAP.some(m => m.readKey in row)) return null;
  const status = String(row.Status ?? row.status ?? 'current').toLowerCase();
  if (status !== 'current') return null;
  const s = sessionFromApi({ ...row, ID: row.ID ?? row.id, Status: 'current' });
  s.modules = MODULE_API_MAP.filter(m => truthyFlag(row[m.readKey])).map(m => m.id);
  return s;
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
  const json = await res.json().catch(() => ({}));
  /* Session change: refresh the stored active session immediately so every
     tab keeps using the new start/end without calling the API itself. */
  if (settingResult(json, 'Academic session saved').ok) {
    try { await refreshActiveAcademicSession(); }
    catch (e) { console.error('Could not refresh active academic session', e); }
  }
  return json;
}

/* DELETE one session by id. */
export async function apiDeleteSession(id) {
  const res = await fetch(buildUrl(`/api/Setting/delete-academic-session/${id}`), {
    method: 'DELETE',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => ({}));
  if (settingResult(json, 'Academic session deleted').ok) {
    try { await refreshActiveAcademicSession(); }
    catch (e) { console.error('Could not refresh active academic session', e); }
  }
  return json;
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
      image:       resolveMediaUrl(e.empImage),
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

/* Backend base64 image ko DB me save karta hai aur GET par uske aage apna host
   jod deta hai → "http://host.aidata:image/png;base64,..." (toota hua URL).
   Agar string me "data:image" ho to wahin se aage ka hissa lo. */
function cleanSignatureImage(raw) {
  const s = String(raw || '');
  const i = s.indexOf('data:image');
  return i > 0 ? s.slice(i) : s;
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
    imageDataUrl: cleanSignatureImage(row.SignatureImage), // full URL ya base64
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
/* Backend image ko `SignatureImage` ki base64 string se save karta hai. Edit /
   status-toggle par nayi file nahi hoti aur hamare paas sirf server ka URL hota
   hai — wo URL bhejne se image toot jati thi. Is liye existing URL ko wapas
   base64 me badal kar bhejte hain (naye upload wala hi raasta). Fetch fail ho
   to purana behaviour (URL as-is). */
async function imageUrlToDataUrl(url) {
  if (!url || /^(data|blob):/i.test(url)) return url || '';
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return url;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return url;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export async function apiSaveSignature(sig) {
  if (!(sig.imageFile instanceof File)) {
    sig = { ...sig, imageDataUrl: await imageUrlToDataUrl(sig.imageDataUrl) };
  }
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

  /* ── Lazy loading ──
     The provider wraps the whole ERP, so it must NOT hit Settings APIs on
     every screen. The full sessions list and signatures are fetched only when
     a screen that needs them calls ensureSessions() / ensureSignatures().
     Everywhere else, currentSession comes from the active-session row already
     fetched once at login (sessionStorage), so no extra request is made. */
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const sessionsRequested   = useRef(false);
  const signaturesRequested = useRef(false);
  const [activeSeed, setActiveSeed] = useState(() => sessionFromActiveRow(readStoredActiveSession()));

  const currentSession = useMemo(
    () => (sessionsLoaded ? sessions.find(s => s.status === 'current') || null : activeSeed),
    [sessionsLoaded, sessions, activeSeed],
  );

  /* Publish the current session to the shared store as soon as it is known.
     SettingsProvider wraps the whole ERP, so this runs once at app start no
     matter which module the user opens first.

     Before this, sessionName/sessionID were only written by Academics,
     Accounts, Examination and Paper Generator — so a user who went straight to
     Students, Fee, Attendance or a report saw whatever those keys happened to
     hold (a previous branch's session, or nothing at all, which then fell
     through to each module's own hardcoded year). That is the "some modules
     show an incorrect session" bug. */
  useEffect(() => {
    if (currentSession) storeCurrentSession(currentSession);
  }, [currentSession]);

  /* Load sessions from the API for the active branch. Empty response → empty list. */
  const loadSessions = useCallback(async () => {
    sessionsRequested.current = true;
    setSessionsLoading(true);
    try {
      setSessions(await apiGetSessions());
      setSessionsLoaded(true);
    } catch (err) {
      console.error('Could not load academic sessions:', err);
      setSessions([]);
      setSessionsLoaded(true);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  /* Fetch the full list once, on demand (Settings › Sessions, Branch-Class
     Mapping, Annual Leave report). Later calls are no-ops; mutations reload. */
  const ensureSessions = useCallback(() => {
    if (!sessionsRequested.current) loadSessions();
  }, [loadSessions]);

  /* Resolve currentSession from the login snapshot (shared, deduped request —
     no call at all when it's already in sessionStorage). Only if that row
     can't be used do we fall back to the full sessions GET. */
  useEffect(() => {
    let alive = true;
    loadActiveAcademicSessionOnce()
      .then((row) => {
        if (!alive) return;
        const seed = sessionFromActiveRow(row);
        if (seed) setActiveSeed(seed);
        else ensureSessions();
      })
      .catch(() => { if (alive) ensureSessions(); });
    return () => { alive = false; };
  }, [ensureSessions]);

  /* Keep the seed in sync when the stored active session changes (login
     refresh, or a session save/delete calling refreshActiveAcademicSession). */
  useEffect(() => {
    let lastRaw = JSON.stringify(readStoredActiveSession());
    const onChange = () => {
      const row = readStoredActiveSession();
      const raw = JSON.stringify(row);
      if (raw === lastRaw) return;
      lastRaw = raw;
      setActiveSeed(sessionFromActiveRow(row));
    };
    window.addEventListener(SESSION_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(SESSION_CHANGE_EVENT, onChange);
  }, []);

  /* Load signatures from the API for the active branch. Empty response → empty list. */
  const loadSignatures = useCallback(async () => {
    signaturesRequested.current = true;
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

  /* Signatures are only used by Settings › Signatures — fetched on first open. */
  const ensureSignatures = useCallback(() => {
    if (!signaturesRequested.current) loadSignatures();
  }, [loadSignatures]);

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
    sessions, setSessions, currentSession, sessionsLoading, reloadSessions: loadSessions, ensureSessions,
    setAsCurrent, upsertSession, deleteSession, toggleSessionLock,
    signatures, setSignatures, signaturesLoading, reloadSignatures: loadSignatures, ensureSignatures,
    upsertSignature, deleteSignature, toggleSignatureStatus,
  }), [sessions, signatures, currentSession, sessionsLoading, loadSessions, ensureSessions, signaturesLoading, loadSignatures, ensureSignatures, setAsCurrent, upsertSession, deleteSession, toggleSessionLock, upsertSignature, deleteSignature, toggleSignatureStatus]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/* True when a CURRENT session exists but this module's checkbox is turned OFF
   in that session — the module becomes view-only (no add/edit/update/delete)
   even though the session itself is current. `moduleId` is a MODULE_OPTIONS id
   ('acad', 'exam', 'paper', ...). Returns false when there is no current session
   (that "no session" case is handled separately by each module). */
export function useModuleReadOnly(moduleId) {
  const { currentSession } = useSettings();
  if (!currentSession) return false;
  return !(currentSession.modules || []).includes(moduleId);
}

/* ── Session date guard (ERP-wide) ──
   Koi bhi CREATION/UPDATION date jo academic session se bandhi hai (exam dates,
   datesheet, attendance date, validation dates, etc. — NATURAL/personal dates
   jaise DOB, joining date par YE NAHI lagti) current session ki UTC window ke
   andar honi chahiye. { ok, message } lautata hai — out-of-range par ready toaster
   message. Hisaab hamesha UTC midnight par taake timezone shift se din na badle. */
export function validateSessionDate(dateISO, currentSession, label = 'date') {
  const d = utcMidnightISO(dateISO);
  if (!d) return { ok: true };                       // khaali/invalid date → check nahi
  if (!currentSession) {
    return { ok: false, message: 'No active academic session. Please set a current session from Session Settings first.' };
  }
  const s = utcMidnightISO(currentSession.startDate);
  const e = utcMidnightISO(currentSession.endDate);
  if (!s || !e) {
    return { ok: false, message: 'The current session has no start/end date. Please set them from Session Settings.' };
  }
  if (d < s || d > e) {
    return {
      ok: false,
      message: `Your session runs ${formatDate(currentSession.startDate)} → ${formatDate(currentSession.endDate)}. Please pick the ${label} within this range, or change the session from Session Settings.`,
    };
  }
  return { ok: true };
}

/* Hook: live current session se bandha hua validate(dateISO, label) deta hai.
   Modules isse call karke save se pehle date check karte hain. */
export function useSessionDateGuard() {
  const { currentSession } = useSettings();
  return useCallback(
    (dateISO, label = 'date') => validateSessionDate(dateISO, currentSession, label),
    [currentSession],
  );
}

/* sessionStorage snapshot (login par set: sessionStartDate/sessionEndDate) se wahi
   validation — synchronous aur bharosemand, is liye jo modules pehle se isi source
   par gating karte hain (Examination, Attendance, Accounts, Paper Generator) wo bina
   context par depend kiye save se pehle date check kar saken. Range hi na mile to
   block NAHI karte (ok:true) — taake data missing hone par galat block na lage. */
export function validateSessionDateFromStorage(dateISO, label = 'date') {
  let start = '', end = '';
  try {
    start = String(sessionStorage.getItem('sessionStartDate') || '').slice(0, 10);
    end   = String(sessionStorage.getItem('sessionEndDate')   || '').slice(0, 10);
  } catch { /* storage unavailable */ }
  if (!start || !end) return { ok: true };
  return validateSessionDate(dateISO, { startDate: start, endDate: end }, label);
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  /* If the provider isn't mounted (shouldn't happen since App wraps the
     whole tree, but be defensive), return a safe empty shape so consuming
     components don't blow up. */
  return ctx || {
    sessions: [], signatures: [], currentSession: null,
    sessionsLoading: false, reloadSessions: () => {}, ensureSessions: () => {},
    signaturesLoading: false, reloadSignatures: () => {}, ensureSignatures: () => {},
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

/* Kisi bhi date/ISO string ko UTC midnight Date me badalta hai (sirf YYYY-MM-DD
   part). Invalid/khaali par null. Session date guard isi se timezone-safe
   comparison karta hai. */
export function utcMidnightISO(value) {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
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
