/* Tech Tickets service — Bug/Improvement issue tracking.
   Mirrors the shape a real .NET backend would return; see
   SUPERADMIN_API_GUIDE.md conventions and EP.techTickets in ../endpoints. */
import { request } from '../client';
import { SA_ADMIN_API_BASE } from '../config';
import EP from '../endpoints';
import {
  getAllTickets, getTicketById as getTicketByIdLocal, addTicket, updateTicketStatus as updateTicketStatusLocal, assignTicketTo, updateTicketPriority as updateTicketPriorityLocal,
  updateTicketStage as updateTicketStageLocal, submitDeveloperTestingReport as submitDeveloperTestingReportLocal,
  sendForQaTesting as sendForQaTestingLocal, submitQaReview as submitQaReviewLocal, releaseTicket as releaseTicketLocal,
  filterTickets, ticketStats, developerWorkload, rangeForPreset,
} from '../../techTicketsData';

/* Live only — same as the other super-admin modules; base URL from config. */
const resolve = (_mock, live) => live();
const call = (path, opts = {}) => request(path, { ...opts, base: SA_ADMIN_API_BASE });

/** GET /api/superadmin/tech-tickets → TechTicket[] (filtered/searched). */
export const getTickets = (filters = {}) =>
  resolve(
    () => filterTickets(getAllTickets(), filters),
    () => call(EP.techTickets.list(), { query: filters }),
  );

/** GET /api/superadmin/tech-tickets/{id} → TechTicket. */
export const getTicketById = (id) =>
  resolve(
    () => getTicketByIdLocal(id),
    () => call(EP.techTickets.get(id)),
  );

/** POST /api/superadmin/tech-tickets → TechTicket. Called from the Support
 *  Bug/Improvement modal — payload carries everything Part 12 needs. */
export const createTicketFromReport = (payload) =>
  resolve(
    () => addTicket(payload),
    () => call(EP.techTickets.create(), { method: 'POST', body: payload }),
  );

/** PUT /api/superadmin/tech-tickets/{id}/status → TechTicket. */
export const updateTicketStatus = (id, status, note) =>
  resolve(
    () => updateTicketStatusLocal(id, status, note),
    () => call(EP.techTickets.updateStatus(id), { method: 'PUT', body: { status, note } }),
  );

/** PUT /api/superadmin/tech-tickets/{id}/priority → TechTicket. */
export const updateTicketPriority = (id, priority) =>
  resolve(
    () => updateTicketPriorityLocal(id, priority),
    () => call(EP.techTickets.updatePriority(id), { method: 'PUT', body: { priority } }),
  );

/** PUT /api/superadmin/tech-tickets/{id}/assign → TechTicket. Assigning also
 *  moves the ticket to In Progress (see techTicketsData.assignTicketTo). */
export const assignTicket = (id, developerName, note) =>
  resolve(
    () => assignTicketTo(id, developerName, note),
    () => call(EP.techTickets.assign(id), { method: 'PUT', body: { developerName, note } }),
  );

/** PUT /api/superadmin/tech-tickets/{id}/stage → TechTicket. */
export const updateTicketStage = (id, stage, note) =>
  resolve(
    () => updateTicketStageLocal(id, stage, note),
    () => call(EP.techTickets.updateStage(id), { method: 'PUT', body: { stage, note } }),
  );

/** POST /api/superadmin/tech-tickets/{id}/dev-report → TechTicket.
 *  Mandatory gate before a ticket can move to QA Review. */
export const submitDeveloperTestingReport = (id, report) =>
  resolve(
    () => submitDeveloperTestingReportLocal(id, report),
    () => call(EP.techTickets.devReport(id), { method: 'POST', body: report }),
  );

/** POST /api/superadmin/tech-tickets/{id}/send-for-qa → TechTicket. Throws
 *  if no Developer Testing Report has been submitted yet. */
export const sendForQaTesting = (id) =>
  resolve(
    () => sendForQaTestingLocal(id),
    () => call(EP.techTickets.sendForQa(id), { method: 'POST' }),
  );

/** POST /api/superadmin/tech-tickets/{id}/qa-review → TechTicket.
 *  { decision:'approved'|'rejected', comments, attachments, reviewedBy }. */
export const submitQaReview = (id, review) =>
  resolve(
    () => submitQaReviewLocal(id, review),
    () => call(EP.techTickets.qaReview(id), { method: 'POST', body: review }),
  );

/** POST /api/superadmin/tech-tickets/{id}/release → TechTicket.
 *  { testingComments, releasedBy }. */
export const releaseTicket = (id, payload) =>
  resolve(
    () => releaseTicketLocal(id, payload),
    () => call(EP.techTickets.release(id), { method: 'POST', body: payload }),
  );

/** GET /api/superadmin/tech-tickets/stats?from=&to= → { total, bugs, improvements, ... }. */
export const getTicketStats = (preset = 'all', from, to) =>
  resolve(
    () => ticketStats(filterTickets(getAllTickets(), { range: rangeForPreset(preset, from, to) })),
    () => call(EP.techTickets.stats(), { query: rangeForPreset(preset, from, to) }),
  );

/** GET /api/superadmin/tech-tickets/workload?from=&to= → developer workload rows. */
export const getDeveloperWorkload = (preset = 'all', from, to) =>
  resolve(
    () => developerWorkload(getAllTickets()),
    () => call(EP.techTickets.workload(), { query: rangeForPreset(preset, from, to) }),
  );
