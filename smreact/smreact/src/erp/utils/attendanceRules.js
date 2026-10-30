/* ═══════════════════════════════════════════════════════════════════
   ATTENDANCE RULE ENGINE — centralized, deterministic, source-independent.

   This is the ONE place that turns a time-in / time-out into an
   attendance outcome. Student Attendance, Staff Attendance, the Smart
   Attendance App, and any future biometric/face-recognition/API
   integration must all call into this module instead of repeating the
   comparison logic themselves.

   Pure functions only — no React, no service calls, no Date-object
   timezone assumptions. Every time value here is the school's own
   wall-clock time as a "HH:MM" 24-hour string (the native value of an
   <input type="time">), compared as integer minutes-since-midnight.
   That sidesteps both the timezone and the Date-parsing ambiguity that
   JS Date string parsing is prone to — nothing here ever constructs a
   `new Date("...")` from a time string.
   ═══════════════════════════════════════════════════════════════════ */

/* Where an attendance event originated. The rules below never depend on
   this — the same configured rules apply no matter the source. Values
   match the strings already used by the ERP's "Marked From" picker
   (ERP / Mobile App / Biometric) so existing records keep working; the
   newer sources are additive. */
export const ATTENDANCE_SOURCE = {
  ERP: 'ERP',
  SMART_APP: 'Mobile App',
  BIOMETRIC: 'Biometric',
  FACE_RECOGNITION: 'Face Recognition',
  RFID: 'RFID',
  API: 'API',
};

export const TIME_IN_STATUS = { PRESENT: 'present', LATE: 'late' };
export const TIME_OUT_STATUS = {
  FULL_DAY: 'full_day',
  SHORT_LEAVE: 'short_leave',
  EARLY_OUT: 'early_out',
  NOT_COMPLETED: 'not_completed',
};

/* ── Time helpers — "HH:MM" string ↔ minutes-since-midnight ── */

export function timeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function formatTime12h(hhmm) {
  const mins = timeToMinutes(hhmm);
  if (mins == null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

const isAfterOrEq = (a, b) => a != null && b != null && a >= b;
const isBefore = (a, b) => a != null && b != null && a < b;

/* ── Default configuration — mirrors the example in the spec, but every
   school can change every value. Never hard-coded into the engine
   itself; this is only the seed a new setup starts from. ──

   geofenceEnabled / schoolLocationName / latitude / longitude /
   geofenceRadiusMeters / maxAccuracyMeters — config for "Mark My
   Attendance" (self-attendance for Admin/Teacher from the mobile app):
   a school enters its own location once here, and the mobile app's
   geofence check (Haversine distance against geofenceRadiusMeters,
   GPS accuracy against maxAccuracyMeters) reads it from the same
   place this screen saves it to. Field names match what the real
   backend's school-location API is expected to return, so wiring a
   real API in later needs no reshaping. Off by default — a school
   that hasn't set its location yet keeps using manual/ERP-marked
   staff attendance exactly as before. */
export const DEFAULT_ATTENDANCE_SETUP = {
  isEnabled: false,
  schoolStartTime: '08:00',
  schoolEndTime: '14:00',
  attendanceStartTime: '07:30',
  normalTimeInUntil: '08:15',
  lateAfter: '08:15',
  shortLeaveFrom: '12:00',
  fullDayTimeOut: '14:00',

  geofenceEnabled: false,
  schoolLocationName: '',
  latitude: null,
  longitude: null,
  geofenceRadiusMeters: 200,
  maxAccuracyMeters: 100,

  /* Working Hours & Attendance Rules — Students (student*-prefixed,
     same 7-field shape as the staff rules above, independently
     enabled). Time tracking mode per audience — see mock/attendance.js
     for the full explanation; this is just the seed for a new setup. */
  studentRulesEnabled: false,
  studentSchoolStartTime: '08:00',
  studentSchoolEndTime: '14:00',
  studentAttendanceStartTime: '07:45',
  studentNormalTimeInUntil: '08:00',
  studentLateAfter: '08:00',
  studentShortLeaveFrom: '12:30',
  studentFullDayTimeOut: '14:00',

  staffTrackingMode: 'in_out',
  studentTrackingMode: 'in_out',
};

/* ═══════════════════════════════════════════════════════════════════
   VALIDATION — section 11. Returns { field: message }; empty object
   means the configuration is valid and safe to save.
   ═══════════════════════════════════════════════════════════════════ */
export function validateAttendanceSetup(setup) {
  const errors = {};
  const REQUIRED = [
    ['schoolStartTime', 'School Start Time'],
    ['schoolEndTime', 'School End Time'],
    ['attendanceStartTime', 'Attendance Start Time'],
    ['normalTimeInUntil', 'Normal Time-In Until'],
    ['lateAfter', 'Late After'],
    ['shortLeaveFrom', 'Short Leave Before'],
    ['fullDayTimeOut', 'Full Day Time-Out'],
  ];
  REQUIRED.forEach(([key, label]) => {
    if (!setup?.[key]) errors[key] = `${label} is required.`;
  });

  /* Geofence fields are only required when geofenced attendance is
     actually turned on — a school that hasn't enabled it yet can save
     every other attendance setting without ever touching this. */
  if (setup?.geofenceEnabled) {
    const lat = Number(setup.latitude);
    const lng = Number(setup.longitude);
    if (setup.latitude == null || setup.latitude === '' || Number.isNaN(lat)) errors.latitude = 'School Latitude is required when geo-fenced attendance is enabled.';
    else if (lat < -90 || lat > 90) errors.latitude = 'Latitude must be between -90 and 90.';
    if (setup.longitude == null || setup.longitude === '' || Number.isNaN(lng)) errors.longitude = 'School Longitude is required when geo-fenced attendance is enabled.';
    else if (lng < -180 || lng > 180) errors.longitude = 'Longitude must be between -180 and 180.';
    if (!setup.geofenceRadiusMeters || Number(setup.geofenceRadiusMeters) <= 0) errors.geofenceRadiusMeters = 'Geofence radius must be greater than 0 metres.';
    if (setup.maxAccuracyMeters != null && setup.maxAccuracyMeters !== '' && Number(setup.maxAccuracyMeters) <= 0) errors.maxAccuracyMeters = 'Maximum GPS accuracy must be greater than 0 metres.';
  }

  if (Object.keys(errors).length) return errors; // comparisons below need every value present

  const m = Object.fromEntries(REQUIRED.map(([key]) => [key, timeToMinutes(setup[key])]));

  if (m.schoolStartTime > m.schoolEndTime) {
    errors.schoolEndTime = 'School End Time cannot be before School Start Time.';
  }
  if (m.normalTimeInUntil < m.attendanceStartTime) {
    errors.normalTimeInUntil = 'Normal Time-In Until cannot be before Attendance Start Time.';
  }
  if (m.lateAfter < m.normalTimeInUntil) {
    errors.lateAfter = 'Late After cannot be before Normal Time-In Until.';
  }
  if (m.shortLeaveFrom < m.schoolStartTime) {
    errors.shortLeaveFrom = 'Short Leave Before cannot be before School Start Time.';
  }
  if (m.fullDayTimeOut < m.shortLeaveFrom) {
    errors.fullDayTimeOut = 'Full Day Time-Out cannot be before Short Leave Before.';
  }
  if (m.fullDayTimeOut > m.schoolEndTime) {
    errors.fullDayTimeOut = 'Full Day Time-Out should not be after School End Time.';
  }
  return errors;
}

/* Geofence config (latitude/longitude/radius/accuracy) is an entirely
   separate feature from the Present/Late/Short-Leave/Full-Day time
   engine below — a school leaving geofencing unconfigured must never
   stop its normal attendance rules from working. isAttendanceSetupValid
   is what calculateAttendanceResult gates on, so it only looks at the
   time-rule errors; validateAttendanceSetup itself still reports
   geofence errors too, for the Setup screen's own save button. */
const GEOFENCE_ERROR_KEYS = ['latitude', 'longitude', 'geofenceRadiusMeters', 'maxAccuracyMeters'];
export const isAttendanceSetupValid = (setup) => {
  const errors = validateAttendanceSetup(setup);
  return Object.keys(errors).filter((k) => !GEOFENCE_ERROR_KEYS.includes(k)).length === 0;
};

/* Has the school actually entered a usable location yet? Same check
   the mobile app's own geofence logic needs to run before it can tell
   a real distance apart from "not configured" — kept here so the
   Setup screen's "Configured / Not Configured" status and any future
   mobile code agree on exactly what "configured" means. */
export const isGeofenceConfigured = (setup) => (
  !!setup
  && Number.isFinite(Number(setup.latitude))
  && Number.isFinite(Number(setup.longitude))
  && Number(setup.geofenceRadiusMeters) > 0
);

/* ═══════════════════════════════════════════════════════════════════
   CALENDAR CHECK — section 18. A date's fixed status (holiday / weekly
   off) always wins over anything time-based. Mirrors the day-type
   matching already used by the Attendance reports (Monday-indexed
   weekly-off array; from/to date-range holidays).
   ═══════════════════════════════════════════════════════════════════ */
export function getCalendarStatus(date, { weeklyOff = [], holidays = [] } = {}) {
  if (!date) return null;
  const dow = (date.getDay() + 6) % 7; // Monday = 0 … Sunday = 6, matches DAYS_F
  if ((weeklyOff || []).includes(dow)) return 'weekly_off';
  const hit = (holidays || []).some((h) => {
    const from = new Date(h.from);
    const to = new Date(h.to);
    return date >= from && date <= to;
  });
  return hit ? 'holiday' : null;
}

/* ═══════════════════════════════════════════════════════════════════
   THE RULE ENGINE — sections 6, 7, 8, 9, 18.

   Inputs:
     timeIn, timeOut   — "HH:MM" strings, or '' / null if not recorded yet
     calendarStatus    — 'holiday' | 'weekly_off' | null (see getCalendarStatus)
     isOnApprovedLeave — true when the person already has an approved leave
     setup             — the school's AttendanceSetup (see DEFAULT_ATTENDANCE_SETUP)

   Output — never a single flat value (section 8):
     {
       timeInStatus:  'present' | 'late' | null,
       timeOutStatus: 'full_day' | 'short_leave' | 'early_out' | 'not_completed' | null,
       finalStatus:   'present' | 'late' | 'short_leave' | 'leave' | 'holiday' | 'weekly_off' | null,
       isAutomatic:   whether finalStatus was derived from configured rules
                      (false for leave/holiday/weekly-off, which are calendar/
                      HR facts, not time-rule outcomes, and false when rules
                      are disabled or a required time is missing)
     }

   A calendar or leave fact is never overwritten by a time value — those
   checks run first and return immediately. ────────────────────────── */
export function calculateAttendanceResult({ timeIn, timeOut, calendarStatus, isOnApprovedLeave, setup } = {}) {
  if (isOnApprovedLeave) {
    return { timeInStatus: null, timeOutStatus: null, finalStatus: 'leave', isAutomatic: false };
  }
  if (calendarStatus === 'holiday' || calendarStatus === 'weekly_off') {
    return { timeInStatus: null, timeOutStatus: null, finalStatus: calendarStatus, isAutomatic: false };
  }
  if (!setup?.isEnabled || !isAttendanceSetupValid(setup)) {
    return { timeInStatus: null, timeOutStatus: null, finalStatus: null, isAutomatic: false };
  }

  const inMin = timeToMinutes(timeIn);
  const outMin = timeToMinutes(timeOut);
  const attendanceStart = timeToMinutes(setup.attendanceStartTime);
  const lateAfter = timeToMinutes(setup.lateAfter);
  const shortLeaveFrom = timeToMinutes(setup.shortLeaveFrom);
  const fullDayAt = timeToMinutes(setup.fullDayTimeOut);

  /* A check-in before Attendance Start Time isn't for today's working
     day at all (e.g. a stray biometric ping before the campus opens),
     so it is not considered — section 4A. Otherwise: on/before Late
     After → Present, after it → Late. Normal Time-In Until is the
     official, displayed cutoff; Late After is the actual (optionally
     later, grace-period) boundary the engine evaluates against —
     validation guarantees lateAfter >= normalTimeInUntil. */
  let timeInStatus = null;
  if (inMin != null && inMin >= attendanceStart) {
    timeInStatus = inMin <= lateAfter ? TIME_IN_STATUS.PRESENT : TIME_IN_STATUS.LATE;
  }

  /* "Short Leave Before" (shortLeaveFrom) now reads literally: checking
     out BEFORE this time is Short Leave. Checking out at or after it
     but before Full Day Time Out is an incomplete working day — the
     existing "early out / not completed" outcome, never auto-labelled
     Short Leave. At or after Full Day Time Out completes the day. */
  /* A school on "Time In Only" (setup.trackTimeOut === false) never
     collects a time out at all, so a missing one is expected, not an
     incomplete day — timeOutStatus stays null instead of the
     NOT_COMPLETED outcome below, which only makes sense for a school
     that does expect a time out and didn't get one. */
  const trackTimeOut = setup.trackTimeOut !== false;
  let timeOutStatus = null;
  if (trackTimeOut && outMin != null) {
    if (isAfterOrEq(outMin, fullDayAt)) timeOutStatus = TIME_OUT_STATUS.FULL_DAY;
    else if (isBefore(outMin, shortLeaveFrom)) timeOutStatus = TIME_OUT_STATUS.SHORT_LEAVE;
    else timeOutStatus = TIME_OUT_STATUS.EARLY_OUT; // shortLeaveFrom <= outMin < fullDayAt
  } else if (trackTimeOut && inMin != null) {
    timeOutStatus = TIME_OUT_STATUS.NOT_COMPLETED;
  }

  /* finalStatus is the flat summary a report/list column shows. The two
     fields above keep the full Present+ShortLeave / Late+FullDay detail
     for anything that wants it (section 8) — finalStatus just picks the
     one that matters most for a status column, preferring Short Leave
     over a plain Present/Late once checkout is in. */
  let finalStatus = timeInStatus;
  if (timeOutStatus === TIME_OUT_STATUS.SHORT_LEAVE && timeInStatus) finalStatus = 'short_leave';

  return {
    timeInStatus,
    timeOutStatus,
    finalStatus,
    isAutomatic: timeInStatus != null || (timeOutStatus != null && timeOutStatus !== TIME_OUT_STATUS.NOT_COMPLETED),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   HUMAN-READABLE SUMMARY — section 12/13. Builds the sentences the
   "Automatic Classification" / "Attendance Rules Summary" panels show,
   always from the live configuration, never a hard-coded example.
   ═══════════════════════════════════════════════════════════════════ */
export function describeAttendanceRules(setup) {
  const t = (key) => formatTime12h(setup?.[key]) || '—';
  /* Late is decided by Late After (the engine's real boundary); a gap
     between Normal Time-In Until and Late After is grace — still Present. */
  const grace = setup?.lateAfter && setup?.normalTimeInUntil && setup.lateAfter > setup.normalTimeInUntil;
  return {
    timeIn: [
      { range: `${t('attendanceStartTime')} – ${t('normalTimeInUntil')}`, label: 'Present' },
      ...(grace ? [{ range: `${t('normalTimeInUntil')} – ${t('lateAfter')} (grace)`, label: 'Present', key: 'grace' }] : []),
      { range: `After ${t('lateAfter')}`, label: 'Late' },
    ],
    /* Nothing to summarize when this school only tracks Time In — Short
       Leave / Full Day are both time-out outcomes. */
    timeOut: setup?.trackTimeOut === false ? [] : [
      { range: `Before ${t('shortLeaveFrom')}`, label: 'Short Leave' },
      { range: `${t('shortLeaveFrom')} – ${t('fullDayTimeOut')}`, label: 'Early Out / Not Completed' },
      { range: `${t('fullDayTimeOut')} onwards`, label: 'Full Day' },
    ],
  };
}
