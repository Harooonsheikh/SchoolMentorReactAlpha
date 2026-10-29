import { delay, clone } from '../services/_http';
import { getStuSchool } from '../services/studentService';
import { ID_CARD_THEMES, CARD_SIZES } from './idCardThemes';
import { DEFAULT_FIELD_ORDER } from './idCardFields';

/* ═══════════════════════════════════════════════════════════════════
   idCardService — ID Card Designer persistence.

   Same seam as every other service in src/services/: today it resolves
   against localStorage-backed mock state (there is no school-branding
   or design-config storage anywhere in this app yet — see
   studentService.getStuSchool()/mockStuSchool, which only carries
   name/session/address/phone, no logo); swap the two localStorage
   helpers below for real HTTP calls when a backend lands and every
   caller keeps working unchanged.

   Scoped per school (by school name — the only stable identifier the
   current school model exposes) and per card kind ('student' | 'staff')
   so one school's saved design/branding never leaks into another's.
   ═══════════════════════════════════════════════════════════════════ */

import { fetchReportHeader } from '../../utils/pdfReports';

const readJSON = (key, fallback) => {
  try { const raw = localStorage.getItem(key); const v = raw ? JSON.parse(raw) : null; return v ?? fallback; }
  catch { return fallback; }
};
const writeJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};

function schoolScopeKey(schoolName) {
  return (schoolName || 'default').trim().toLowerCase().replace(/\s+/g, '-');
}

/* ─── School branding (logo + contact details shown on cards) ─────── */

export function defaultDesign(kind) {
  const theme = ID_CARD_THEMES[0];
  return {
    themeId: theme.id,
    orientation: theme.defaultOrientation,
    sizeId: 'cr80',
    photoShape: theme.defaultPhotoShape,
    photoSizePct: 100,
    fields: [...(DEFAULT_FIELD_ORDER[kind] || [])],
    branding: {
      showLogo: true, logoSizePct: 100, logoPlacement: 'left',
      showSchoolName: true, showAddress: true, showContact: true,
      primaryColor: theme.colors.primary, secondaryColor: theme.colors.secondary,
    },
    /* QR/barcode are shown independently per side — previously they were
       jammed into `fields` as a single on/off, which is exactly why they
       showed on BOTH the front corner badge and the back at once with no
       way to turn either off separately. Default: QR on the back only
       (the one that actually gets scanned), barcode off entirely. */
    qr: { showFront: false, showBack: true, position: 'bottom-right', backPosition: 'center', sizePct: 100 },
    barcode: { showFront: false, showBack: false },
    /* Back-of-card content — independent from the front's `fields`.
       backFields lets a school add/remove EXTRA text rows on the back
       (from the same field catalog); backOptions toggles the two fixed
       elements (the "return to school" banner and the printed ID text)
       that sit above them, next to the QR/barcode. */
    backFields: [],
    backOptions: { showBanner: true, bannerText: 'If found, please return to school office', showIdText: true },
  };
}

export async function getSchoolBranding() {
  await delay();
  const base = clone(await getStuSchool());
  const override = readJSON('idcard_school_branding', {});
  /* Default logo = the branch logo from /report-header, resolved the same way the
     sidebar and reports resolve it. A logo the user saved or removed (override) wins. */
  const branch = await fetchReportHeader();
  return { ...base, email: '', website: '', campus: '', logo: branch?.branchLogo || null, ...override };
}

export async function saveSchoolBranding(patch) {
  await delay();
  const current = readJSON('idcard_school_branding', {});
  const next = { ...current, ...patch };
  writeJSON('idcard_school_branding', next);
  return clone(next);
}

/* ─── Per-school, per-kind ID card design ──────────────────────────── */

export async function getIdCardDesign(kind, schoolName) {
  await delay();
  const key = `idcard_design_${kind}_${schoolScopeKey(schoolName)}`;
  const saved = readJSON(key, null);
  const base = defaultDesign(kind);
  if (!saved) return clone(base);
  /* Defensive merge, not a bare overwrite — a design saved before a
     Designer update (e.g. before backFields/backOptions existed) must
     still come back with every field the current UI expects, instead
     of crashing on an undefined array/object. */
  return clone({
    ...base,
    ...saved,
    branding: { ...base.branding, ...(saved.branding || {}) },
    backOptions: { ...base.backOptions, ...(saved.backOptions || {}) },
    qr: { ...base.qr, ...(saved.qr || {}) },
    barcode: { ...base.barcode, ...(saved.barcode || {}) },
  });
}

export async function saveIdCardDesign(kind, schoolName, design) {
  await delay();
  const key = `idcard_design_${kind}_${schoolScopeKey(schoolName)}`;
  writeJSON(key, design);
  return clone(design);
}

export async function resetIdCardDesign(kind, schoolName) {
  await delay();
  const key = `idcard_design_${kind}_${schoolScopeKey(schoolName)}`;
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  return clone(defaultDesign(kind));
}

export { CARD_SIZES };
