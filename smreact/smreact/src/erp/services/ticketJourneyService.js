import { delay, clone } from './_http';
import { buildSuperAdminUrl } from '../../utils/apiConfig';
import { mockInternalTickets, CURRENT_SCHOOL } from '../mock/ticketJourney';

/* ═══════════════════════════════════════════════════════════════════
   ticketJourneyService — feeds pages/SchoolMentor/TicketJourney.jsx
   ("My Tickets" in the sidebar). READ-ONLY for the school, except
   marking a ticket as seen.

   Full backend contract: TICKET_JOURNEY_GUIDE.md (repo root).

   ── Endpoints the backend must expose (school JWT; SchoolId comes from
      the token, NEVER from the query string) ─────────────────────────
     GET  /api/school/tickets                 → SchoolTicket[]  (newest first)
     GET  /api/school/tickets/{id}            → SchoolTicket    (404 if not this school's)
     POST /api/school/tickets/{id}/seen       → 204
     GET  /api/school/tickets/unseen-count    → { count: number }

   ── SchoolTicket (what the school is allowed to see) ────────────────
     {
       id, ticketNumber, type: 'bug' | 'improvement',
       title, description, module, reportedByName,
       stepsToReproduce: string[], expectedBehaviour, actualBehaviour,   // optional, '' / [] when empty
       journeyStage: 'received' | 'in_sprint' | 'testing' | 'approved' | 'released',
       sprint: { name, startsAt, endsAt } | null,
       reportedAt,               // always set
       sprintAddedAt,            // when a developer was assigned
       expectedDays,             // set by Support when assigning (null = not set)
       expectedLiveBy,           // sprintAddedAt + expectedDays
       developmentCompletedAt,   // FIRST time it was sent to QA
       testingPassedAt,          // QA approved (null until then)
       releasedAt,               // live for the school
       releaseNotes,             // customer-friendly "what changed"
       updates: [{ id, at, author, message }],   // only visibleToSchool notes
       lastUpdatedAt, hasNewUpdate
     }

   Never sent to the school: developer / QA names, QA rejections, internal
   notes, priority, other schools' tickets, head-office internal tickets.

   When wiring the real API: replace the body of each exported function
   with the HTTP call and delete toSchoolTicket() from here (the backend
   does that mapping). Keep the signatures and return shapes.
   ═══════════════════════════════════════════════════════════════════ */

/* Only tickets the SCHOOL raised appear in its journey. Tickets created
   internally from the Tech Module (head_office_internal /
   development_team) are hidden even if they are tagged with this school. */
export const SCHOOL_VISIBLE_SOURCES = ['customer_support', 'school_direct'];

const maxIso = (...dates) => dates.filter(Boolean).sort().pop() || null;

/* Internal Tech-Module stage → what the school sees.
   Rules (port 1:1 to C#):
     released                               → released
     ready_for_release                      → approved
     qa_review                              → testing
     in_progress  + already been to QA once → testing    (QA sent it back —
                                                          the school keeps
                                                          seeing "testing")
     in_progress  / any stage with assignee → in_sprint
     bugs_new_dev without assignee          → received                    */
export function toJourneyStage(t) {
  if (t.stage === 'released') return 'released';
  if (t.stage === 'ready_for_release') return 'approved';
  if (t.stage === 'qa_review') return 'testing';
  if (t.firstSentToQaAt) return 'testing';
  if (t.stage === 'in_progress' || t.assignedTo) return 'in_sprint';
  return 'received';
}

/* BACKEND REFERENCE: this is the exact mapping the .NET API must do.
   Input = internal Tech Module ticket, output = SchoolTicket DTO. */
export function toSchoolTicket(t) {
  const journeyStage = toJourneyStage(t);
  const updates = (t.activity || [])
    .filter(a => a.visibleToSchool && a.note)
    .map((a, i) => ({ id: `${t.id}-u${i}`, at: a.at, author: 'School Mentor Support', message: a.note }));

  const sprintAddedAt = t.assignedAt || null;
  const expectedDays = sprintAddedAt && t.expectedDays ? t.expectedDays : null;
  const expectedLiveBy = expectedDays
    ? new Date(new Date(sprintAddedAt).getTime() + expectedDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const developmentCompletedAt = t.firstSentToQaAt || null;
  const testingPassedAt = ['approved', 'released'].includes(journeyStage) ? (t.communicatedAt || null) : null;
  const releasedAt = journeyStage === 'released' ? (t.closedAt || null) : null;

  const lastUpdatedAt = maxIso(
    t.reportedAt, sprintAddedAt, developmentCompletedAt, testingPassedAt, releasedAt,
    ...updates.map(u => u.at),
  );

  return {
    id: t.id,
    ticketNumber: t.ticketNumber,
    type: t.type,
    title: t.title,
    description: t.description,
    stepsToReproduce: t.stepsToReproduce || [],
    expectedBehaviour: t.expectedBehaviour || '',
    actualBehaviour: t.actualBehaviour || '',
    module: t.module,
    reportedByName: t.reportedByName,
    journeyStage,
    sprint: t.sprint && sprintAddedAt ? { name: t.sprint.name, startsAt: t.sprint.startsAt, endsAt: t.sprint.endsAt } : null,
    reportedAt: t.reportedAt,
    sprintAddedAt,
    expectedDays,
    expectedLiveBy,
    developmentCompletedAt,
    testingPassedAt,
    releasedAt,
    releaseNotes: journeyStage === 'released' ? (t.releaseNotes || '') : '',
    updates,
    lastUpdatedAt,
    hasNewUpdate: !t.lastSchoolViewedAt || (lastUpdatedAt && lastUpdatedAt > t.lastSchoolViewedAt),
  };
}

function schoolTickets() {
  return mockInternalTickets
    .filter(t => t.school?.id === CURRENT_SCHOOL.id && SCHOOL_VISIBLE_SOURCES.includes(t.source))
    .map(toSchoolTicket)
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

/* ── Real API: Super Admin → Tech tickets (this branch) ───────────────
   GET {host}/SchoolMentorSuperAdminAPI/api/superadmin/tech-tickets
       ?Action=list&SchoolBranchId=<branchID>
   → { success, count, data: [{ id, ticketNo, ticketType, module, stage, title, description,
        expectedBehaviour, actualBehaviour, reportedBy{name}, reportedAt,
        assignment{assignedAt}, qa{sentForQaAt, approvedAt}, release{releasedAt, releaseNotes},
        updatedAt, … }] }
   Mapped here into the SchoolTicket shape the page already renders. */
const SEEN_KEY = 'sm_ticket_seen';
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) { return {}; } };
const writeSeen = (m) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } };

function fromApiTicket(r, seen) {
  const journeyStage = toJourneyStage({
    stage: r.stage,
    firstSentToQaAt: r.qa?.sentForQaAt || null,
    assignedTo: r.assignment?.assignedTo || null,
  });
  const sprintAddedAt = r.assignment?.assignedAt || null;
  const developmentCompletedAt = r.qa?.sentForQaAt || null;
  const testingPassedAt = ['approved', 'released'].includes(journeyStage) ? (r.qa?.approvedAt || null) : null;
  const releasedAt = journeyStage === 'released' ? (r.release?.releasedAt || null) : null;
  const lastUpdatedAt = r.updatedAt || maxIso(r.reportedAt, sprintAddedAt, developmentCompletedAt, testingPassedAt, releasedAt);
  return {
    id: r.id,
    ticketNumber: r.ticketNo,
    type: r.ticketType === 'bug' ? 'bug' : 'improvement',
    title: r.title || '',
    description: r.description || '',
    stepsToReproduce: [],
    expectedBehaviour: r.expectedBehaviour || '',
    actualBehaviour: r.actualBehaviour || '',
    module: r.module || 'other',
    reportedByName: r.reportedBy?.name || '',
    journeyStage,
    sprint: null,
    reportedAt: r.reportedAt,
    sprintAddedAt,
    expectedDays: null,
    expectedLiveBy: null,
    developmentCompletedAt,
    testingPassedAt,
    releasedAt,
    releaseNotes: journeyStage === 'released' ? (r.release?.releaseNotes || '') : '',
    updates: [],
    lastUpdatedAt,
    hasNewUpdate: !seen[r.id] || (!!lastUpdatedAt && new Date(lastUpdatedAt).getTime() > seen[r.id]),
  };
}

/** GET tech-tickets (this branch) → SchoolTicket[] (newest first). */
export async function getMyTickets() {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchId) return [];
  const res = await fetch(
    buildSuperAdminUrl(`/api/superadmin/tech-tickets?Action=list&SchoolBranchId=${branchId}`),
    { method: 'GET', headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Could not load tickets (${res.status})`);
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.data) ? json.data : [];
  const seen = readSeen();
  return rows
    .map(r => fromApiTicket(r, seen))
    .sort((x, y) => String(y.reportedAt || '').localeCompare(String(x.reportedAt || '')));
}

/** GET /api/school/tickets/{id} → SchoolTicket. Throws if not found. */
export async function getMyTicket(id) {
  await delay();
  const t = schoolTickets().find(x => x.id === id);
  if (!t) throw new Error('Ticket not found');
  return clone(t);
}

/** POST /api/school/tickets/{id}/seen → clears the "new update" dot. */
export async function markTicketSeen(id) {
  await delay(40);
  const t = mockInternalTickets.find(x => x.id === id && x.school?.id === CURRENT_SCHOOL.id);
  if (t) t.lastSchoolViewedAt = new Date().toISOString();
  /* API tickets: remember locally so the "new update" dot stays cleared after reload. */
  const seen = readSeen(); seen[id] = Date.now(); writeSeen(seen);
}

/** GET /api/school/tickets/unseen-count → number (sidebar badge). */
export async function getUnseenUpdateCount() {
  /* Mock count (showed 5 to every school) — replaced by the real tickets API below.
  await delay();
  return schoolTickets().filter(t => t.hasNewUpdate).length;
  */
  const rows = await getMyTickets();
  return rows.filter(t => t.hasNewUpdate).length;
}
