import {
  DAILY_TEMPLATES, WEEKLY_TEMPLATES, MONTHLY_TEMPLATES,
  COMPLIANCE_AREAS, COMPLIANCE_PROBLEMS,
  PROBLEM_CATEGORIES, PROBLEM_PRIORITIES, PROBLEM_STATUSES,
  generateInstances, STATUS,
} from '../mock/compliance';
import { delay, clone } from './_http';

/* ═══════════════════════════════════════════════════════════════════
   School Compliance — in-memory service layer. Same `await delay();
   return clone(...)` contract as every other service in this app (see
   this file's imports for the shared helper), so a real backend can
   replace the body of each function later without any page changing.

   Templates live in src/mock/compliance.js (frequency-scoped arrays);
   INSTANCES (one real occurrence of a template, for a date/week/month)
   are generated once per period and cached in the module-level stores
   below so a status update made in the UI genuinely persists while
   the app is open — this is a frontend prototype, so nothing survives
   a full page reload (no localStorage, no backend), and no page
   pretends otherwise.
   ═══════════════════════════════════════════════════════════════════ */

/* Fixed demo "today" — same convention as every other fixed-clock mock
   in this app (e.g. AuditLogs' isoToday()), so dates here line up with
   the Problems & Follow-ups seed data and the rest of May 2026's demo
   activity. */
export const TODAY_ISO = '2026-05-31';
export function isoDaysAgo(n) {
  const d = new Date(`${TODAY_ISO}T00:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
export function isoWeekKey(dateIso) {
  const d = new Date(`${dateIso}T00:00:00`);
  const day = (d.getDay() + 6) % 7; // Mon-indexed
  d.setDate(d.getDate() - day); // Monday of that week
  return d.toISOString().slice(0, 10);
}
export function monthKey(dateIso) { return dateIso.slice(0, 7); }

let templates = { daily: clone(DAILY_TEMPLATES), weekly: clone(WEEKLY_TEMPLATES), monthly: clone(MONTHLY_TEMPLATES) };
const instanceStore = { daily: new Map(), weekly: new Map(), monthly: new Map() };

function getOrBuildInstances(freq, periodKey) {
  if (!instanceStore[freq].has(periodKey)) {
    const tpls = templates[freq];
    instanceStore[freq].set(periodKey, generateInstances(tpls, periodKey));
  }
  return instanceStore[freq].get(periodKey);
}

/* ── Templates (read + Compliance Setup edits) ── */
export async function getDailyTemplates()   { await delay(); return clone(templates.daily); }
export async function getWeeklyTemplates()  { await delay(); return clone(templates.weekly); }
export async function getMonthlyTemplates() { await delay(); return clone(templates.monthly); }
export async function getAllTemplates()     { await delay(); return clone({ daily: templates.daily, weekly: templates.weekly, monthly: templates.monthly }); }

export async function saveTemplate(freq, id, patch) {
  await delay();
  const list = templates[freq];
  const idx = list.findIndex(t => t.id === id);
  if (idx < 0) throw new Error('Checklist item not found.');
  list[idx] = { ...list[idx], ...patch };
  /* Changing a template after instances for the current period were
     already generated would silently desync the two — simplest honest
     fix for a prototype: drop any cached instances for this frequency
     so they regenerate against the updated template next read. */
  instanceStore[freq].clear();
  return clone(list[idx]);
}

/* Lets a school add its own checklist item alongside the built-in
   ones, without ever touching or replacing them — the 91 built-in
   items stay exactly as they are, permanently; this only appends a
   new one next to them. `payload` already carries everything the
   Setup form collected (area/category, dashArea, label, assignedStaff,
   dueDay for weekly, evidenceAllowed, verificationRequired). */
let customCounter = 0;
export async function addTemplate(freq, payload) {
  await delay();
  customCounter += 1;
  const id = `CUSTOM-${freq}-${customCounter}`;
  const record = {
    frequency: freq,
    order: 9000 + customCounter,
    evidenceAllowed: true,
    verificationRequired: false,
    active: true,
    ...payload,
    id,
    custom: true,
  };
  templates[freq] = [...templates[freq], record];
  instanceStore[freq].clear();
  return clone(record);
}

/* Removes one — but only a school-added item (`custom: true`). The
   built-in checklist can be turned off per item (see saveTemplate's
   `active` toggle) but is never removable, so this refuses anything
   that isn't a custom addition. */
export async function deleteTemplate(freq, id) {
  await delay();
  const list = templates[freq];
  const item = list.find(t => t.id === id);
  if (!item) throw new Error('Checklist item not found.');
  if (!item.custom) throw new Error('Built-in checklist items cannot be removed — turn them off instead.');
  templates[freq] = list.filter(t => t.id !== id);
  instanceStore[freq].clear();
}

/* ── Instances (what Daily/Weekly/Monthly pages actually show) ── */
export async function getDailyInstances(dateIso = TODAY_ISO)       { await delay(); return clone(getOrBuildInstances('daily', dateIso)); }
export async function getWeeklyInstances(weekKey = isoWeekKey(TODAY_ISO)) { await delay(); return clone(getOrBuildInstances('weekly', weekKey)); }
export async function getMonthlyInstances(mKey = monthKey(TODAY_ISO)) { await delay(); return clone(getOrBuildInstances('monthly', mKey)); }

/* Updates one instance's status/remark/evidence in place (the ONLY
   mutation surface for checklist data — matches the brief's "logs are
   read-only" spirit by keeping everything else append-only, while
   genuinely letting a user complete a check). Returns the updated
   instance. */
export async function updateInstance(freq, id, patch) {
  await delay();
  for (const [, list] of instanceStore[freq]) {
    const idx = list.findIndex(i => i.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
      return clone(list[idx]);
    }
  }
  throw new Error('Checklist entry not found.');
}

/* ── Problems & Follow-ups ── */
let problems = clone(COMPLIANCE_PROBLEMS);
export async function getProblems()           { await delay(); return clone(problems); }
export async function getProblemCategories()  { await delay(); return clone(PROBLEM_CATEGORIES); }
export async function getProblemPriorities()  { await delay(); return clone(PROBLEM_PRIORITIES); }
export async function getProblemStatuses()    { await delay(); return clone(PROBLEM_STATUSES); }

export async function createProblem(payload) {
  await delay();
  const id = `P-${String(problems.length + 1).padStart(4, '0')}`;
  const record = {
    id, status: 'Open', resolutionRemarks: '',
    history: [{ date: new Date().toISOString(), by: payload.reportedBy || 'Unknown', action: 'Reported the problem.' }],
    ...payload,
  };
  problems = [record, ...problems];
  return clone(record);
}

export async function updateProblem(id, patch, { by, action } = {}) {
  await delay();
  const idx = problems.findIndex(p => p.id === id);
  if (idx < 0) throw new Error('Problem not found.');
  const next = { ...problems[idx], ...patch };
  if (action) next.history = [...next.history, { date: new Date().toISOString(), by: by || 'Unknown', action }];
  problems[idx] = next;
  return clone(next);
}

/* ── Reference lists ── */
export async function getAreas() { await delay(); return clone(COMPLIANCE_AREAS); }

export { STATUS };
