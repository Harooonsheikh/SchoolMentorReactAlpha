import {
  APPRAISAL_FRAMEWORK,
  APPRAISAL_CYCLES,
  APPRAISAL_AUTO_SOURCES,
  APPRAISAL_REPORT_TYPES,
  defaultAppraisalSetup,
  mockAppraisals,
  mockAppraisalNextId,
  mockAutoScore,
} from '../mock/appraisal';
import { delay, clone } from './_http';

/* ─── Setup ─── */
export async function getAppraisalSetup() {
  await delay();
  return clone(defaultAppraisalSetup());
}
export async function saveAppraisalSetup(setup) {
  await delay();
  return clone({ ...setup, ok: true });
}

/* ─── Framework ─── */
export async function getAppraisalFramework() {
  await delay();
  return clone(APPRAISAL_FRAMEWORK);
}
export async function getAppraisalCycles() {
  await delay();
  return clone(APPRAISAL_CYCLES);
}
export async function getAppraisalAutoSources() {
  await delay();
  return clone(APPRAISAL_AUTO_SOURCES);
}
export async function getAppraisalReportTypes() {
  await delay();
  return clone(APPRAISAL_REPORT_TYPES);
}

/* ─── Appraisals ─── */
export async function getAppraisals()         { await delay(); return clone(mockAppraisals); }
export async function getAppraisalNextId()    { await delay(); return mockAppraisalNextId; }
export async function saveAppraisal(payload)  { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteAppraisal({ id }) { await delay(); return { id, deleted: true }; }

/* ─── Auto KPI fetcher (consumed by Conduct modal) ─── */
export async function getAutoScore(empId, criterionId) {
  await delay();
  return mockAutoScore(empId, criterionId);
}
