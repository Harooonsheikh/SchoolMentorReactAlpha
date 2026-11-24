import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as techTicketsApi from './api/services/techTickets';
import { TM_CSS } from './techModule/techModuleStyles';
import { loadSchools } from './techModule/SchoolPicker';
import BugsNewDevTab from './techModule/BugsNewDevTab';
import InProgressTab from './techModule/InProgressTab';
import QaReviewTab from './techModule/QaReviewTab';
import ReadyForReleaseTab from './techModule/ReadyForReleaseTab';
import TicketDetailModal from './techModule/TicketDetailModal';
import AnalyticsCards from './techModule/AnalyticsCards';
import { usePermissionsStore } from './adminPermissions/AdminPermissionsContext';
import { findRole } from './adminPermissions/adminPermissionsData';
import { useSaPerms, denyMessage } from './saPerms';
import { currentUserId } from './api/services/auth';
import { isHeadUser } from './permissionModel';

/* ═══════════════════════════════════════════════════════════════════
   TECH MODULE — 5-tab bug/new-development lifecycle: Bugs, New
   Development (both share stage 'bugs_new_dev', split by type), In
   Progress, Review & Testing (QA), Ready for Release.

   Data flows entirely through api/services/techTickets.js's resolve()
   pattern, same as the module it replaces — see SUPERADMIN_API_GUIDE.md.
   Permission gating (Assign/Approve/Release) reads from the new RBAC
   system (adminPermissions/) via usePermissionsStore(); until a real
   login/session exists, gating uses the "Viewing as" preview (defaults
   to full Super Admin access), the same convention Dashboard.jsx's own
   legacy preview already established.
   ═══════════════════════════════════════════════════════════════════ */

/* Tab id → User Permission screen id (permissionModel MODULE_SCREENS.techModule). */
const TAB_SCREEN = { bugs: 'bugs_new_dev', new_dev: 'bugs_new_dev', in_progress: 'in_progress', qa_review: 'qa_review', ready_for_release: 'ready_for_release' };

/* In Progress shows only the logged-in user's own tasks — tickets assigned to
   them. All other tabs (Bugs, New Development, QA, Release) show every ticket.
   Admin (Head, isAdmin) sees every ticket everywhere. No session id (0) = no
   filter, so the screen behaves exactly as before. */
const isMine = (t, me) => !me || Number(t.assignedTo?.id) === me;
const mineOnly = (ts, me) => ts.filter((t) => isMine(t, me));

const TAB_DEFS = [
  { id: 'bugs',              label: 'Bugs',                   icon: 'fa-bug',               filter: (ts) => ts.filter((t) => t.stage === 'bugs_new_dev' && t.type === 'bug') },
  { id: 'new_dev',           label: 'New Development',        icon: 'fa-code-branch',       filter: (ts) => ts.filter((t) => t.stage === 'bugs_new_dev' && t.type === 'improvement') },
  { id: 'in_progress',       label: 'In Progress',            icon: 'fa-spinner',           filter: (ts, me) => mineOnly(ts, me).filter((t) => t.stage === 'in_progress') },
  { id: 'qa_review',         label: 'Review & Testing (QA)',  icon: 'fa-vial-circle-check', filter: (ts) => ts.filter((t) => t.stage === 'qa_review') },
  { id: 'ready_for_release', label: 'Ready for Release',      icon: 'fa-box-open',          filter: (ts) => ts.filter((t) => t.stage === 'ready_for_release' || t.stage === 'released') },
];

/* Legacy status deep-links (Dashboard's byStatus cards) → tab id. */
const STATUS_TO_TAB = { reported: 'bugs', assigned: 'bugs', in_progress: 'in_progress', fixed: 'qa_review', communicated: 'ready_for_release', closed: 'ready_for_release' };
/* Legacy stage deep-links → tab id (bugs_new_dev has no single answer — defaults to Bugs). */
const STAGE_TO_TAB = { bugs_new_dev: 'bugs', in_progress: 'in_progress', qa_review: 'qa_review', ready_for_release: 'ready_for_release', released: 'ready_for_release' };

export default function TechModule({ toast, users = [], initialFilter, onConsumedInitialFilter, onOpenSupportSession }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabState, setTab] = useState('bugs');
  const [detailId, setDetailId] = useState(null);
  /* Logged-in user's id (login identity, else sessionStorage 'superadminid'). */
  const myId = currentUserId();
  /* Admin (login isAdmin, else the users list) → no "my tasks" filter. */
  const isAdmin = useMemo(() => {
    let flag = null;
    try { flag = sessionStorage.getItem('superadminisadmin'); } catch { /* ignore */ }
    if (String(flag).toLowerCase() === 'true') return true;
    return isHeadUser(users.find((u) => Number(u.id) === myId));
  }, [users, myId]);
  const me = isAdmin ? 0 : myId;
  const { roles, roleAssignments, permsForUser, viewingAsUserId, setViewingAsUserId } = usePermissionsStore();
  /* Logged-in user's User Permission matrix — layered on top of the role-based "Viewing as" gate below. */
  const P = useSaPerms('techModule');
  const visibleTabs = TAB_DEFS.filter((d) => P.canView(TAB_SCREEN[d.id]));
  const tab = visibleTabs.some((d) => d.id === tabState) ? tabState : (visibleTabs[0]?.id || null);

  /* Full-screen loader only on the first load. Later reloads (after a create,
     assign, review or release) refresh in the background so the screen never blanks. */
  const loadedRef = useRef(false);
  const [serverStats, setServerStats] = useState(null);
  const loadStats = useCallback(() => {
    techTicketsApi.getStats().then(setServerStats).catch(() => {});
  }, []);
  const load = useCallback(() => {
    loadStats();
    if (!loadedRef.current) setLoading(true);
    return techTicketsApi.getTickets()
      .then((t) => { setTickets(t); })
      .catch(() => {})
      .finally(() => { loadedRef.current = true; setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);
  /* Warm the school list so the Create form opens with it ready. */
  useEffect(() => { loadSchools().catch(() => {}); }, []);

  /* Deep-link from Dashboard/Support: jump to a tab or open a specific
     ticket's detail. Dashboard's {type:'bug'|'improvement'} deep-links
     now select the Bugs/New Development tab directly. */
  useEffect(() => {
    if (!initialFilter) return;
    if (initialFilter.openTicketId) setDetailId(initialFilter.openTicketId);
    else if (initialFilter.type === 'bug') setTab('bugs');
    else if (initialFilter.type === 'improvement') setTab('new_dev');
    else if (initialFilter.stage && STAGE_TO_TAB[initialFilter.stage]) setTab(STAGE_TO_TAB[initialFilter.stage]);
    else if (initialFilter.status && STATUS_TO_TAB[initialFilter.status]) setTab(STATUS_TO_TAB[initialFilter.status]);
    onConsumedInitialFilter?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter]);

  /* Permission gate — currentUser is a stand-in until real auth exists;
     no viewingAs override = full Super Admin access (matches
     Dashboard.jsx's own existing "Viewing as" convention). */
  const perms = useMemo(() => {
    if (!viewingAsUserId) return null; // null = unrestricted (Super Admin default)
    return permsForUser({ id: viewingAsUserId });
  }, [viewingAsUserId, permsForUser]);
  const can = (screenId, action) => !perms || !!perms[`${screenId}.${action}`];

  const counts = useMemo(() => {
    const c = {};
    TAB_DEFS.forEach((d) => { c[d.id] = d.filter(tickets, me).length; });
    return c;
  }, [tickets, me]);

  const createTicket = (payload) => {
    if (!P.guard('bugs_new_dev', 'create', toast)) return Promise.reject(new Error(denyMessage('create')));
    /* Show the new ticket right away (server returns it), together with the
       toast — then refresh the list + stats quietly in the background. */
    return techTicketsApi.createTicketFromReport(payload).then((t) => {
      if (t?.id != null) setTickets((prev) => [t, ...prev.filter((x) => x.id !== t.id)]);
      toast?.(`Ticket ${t.ticketNumber} created`, 'success');
      load();
      return t;
    });
  };
  const assignTicket = (id, developerId) => {
    if (!P.guard('bugs_new_dev', 'assign', toast)) return Promise.resolve(false);
    /* Resolves true on success so the Assign modal closes only when it worked. */
    return Promise.resolve(techTicketsApi.assignTicket(id, developerId))
      .then(() => { load(); toast?.('Ticket assigned — moved to In Progress', 'success'); return true; })
      .catch((e) => { toast?.(e?.message || 'Could not assign the ticket', 'warn'); return false; });
  };
  /* Submitting the Developer Testing Report and sending the ticket for
     QA Testing are now one action (In Progress tab's single "Send for
     QA Testing" button opens the report modal directly) — save the
     report, then immediately send for QA, in one chained call. */
  const submitReportAndSendForQa = (id, report) => {
    if (!P.guard('in_progress', 'edit', toast)) return;
    Promise.resolve(techTicketsApi.submitDeveloperTestingReport(id, report))
      .then(() => techTicketsApi.sendForQaTesting(id))
      .then(() => { load(); toast?.('Developer Testing Report submitted — sent for QA Testing', 'success'); })
      .catch((e) => { load(); toast?.(e?.message || 'Could not send for QA Testing', 'warn'); });
  };
  /* Resolves only on success, so the QA modal closes only when the action worked. */
  const submitReview = (id, decision, comments, attachments) => {
    /* Approve = 'approve'; Reject (sends the ticket back to In Progress) = 'edit'. */
    const act = decision === 'approved' ? 'approve' : 'edit';
    if (!P.guard('qa_review', act, toast)) return Promise.reject(new Error(denyMessage(act)));
    return techTicketsApi.submitQaReview(id, { decision, comments, attachments, reviewedBy: 'QA Team' }).then((t) => {
      load();
      toast?.(decision === 'approved' ? 'Ticket approved — Ready for Release' : 'Ticket rejected — returned to In Progress', decision === 'approved' ? 'success' : 'info');
      return t;
    }).catch((err) => {
      /* Refresh so a stale card (ticket already moved on) drops out; the modal shows the error. */
      load();
      throw err;
    });
  };
  /* The server creates the Support notification on release (README §9) —
     the client only releases and reloads. */
  const release = (id, payload) => {
    if (!P.guard('ready_for_release', 'approve', toast)) return;
    techTicketsApi.releaseTicket(id, payload).then(() => load()).catch((e) => toast?.(e?.message || 'Could not release', 'warn'));
  };

  const detailTicket = detailId ? tickets.find((t) => t.id === detailId || t.ticketNumber === detailId) : null;
  const openDetails = (idOrNumber) => setDetailId(idOrNumber);

  return (
    <div className="page-content">
      <style>{TM_CSS}</style>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-list-check" /></div>
          <div>
            <div className="page-title">Tech Module</div>
            <div className="page-sub">Bug &amp; development lifecycle — triage, develop, QA, and release.</div>
          </div>
        </div>
        {/* "Viewing as" dropdown band — ab access User Permission (logged-in user) se chalta hai.
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tm)' }}>Viewing as</label>
          <select className="um-input" style={{ height: 34, width: 220 }} value={viewingAsUserId || ''} onChange={(e) => setViewingAsUserId(e.target.value || null)}>
            <option value="">Super Admin (full access)</option>
            {users.map((u) => {
              const role = findRole(roles, roleAssignments[u.id]?.role);
              return <option key={u.id} value={u.id}>{u.fullName}{role ? ` — ${role.name}` : ' — No role'}</option>;
            })}
          </select>
        </div>
        */}
      </div>

      {!loading && <AnalyticsCards tickets={tickets} server={serverStats} />}

      <div className="app-tabs">
        {visibleTabs.map((d) => (
          <button key={d.id} className={`app-tab${tab === d.id ? ' active' : ''}`} onClick={() => setTab(d.id)}>
            <i className={`fa-solid ${d.icon}`} /> {d.label} <span className="tab-count">{counts[d.id] || 0}</span>
          </button>
        ))}
      </div>

      {!tab ? (
        <div className="tm-empty"><i className="fa-solid fa-lock" /><div>You don't have permission to view this</div></div>
      ) : loading ? (
        <div className="tm-empty"><i className="fa-solid fa-spinner fa-spin" /><div>Loading…</div></div>
      ) : (
        <>
          {tab === 'bugs' && (
            <BugsNewDevTab kind="bug" tickets={TAB_DEFS[0].filter(tickets, me)} onCreate={createTicket} onAssign={assignTicket} onViewDetails={openDetails} toast={toast}
              canCreate={can('techmodule.bugs_new_dev', 'create')} canAssign={can('techmodule.bugs_new_dev', 'assign')} />
          )}
          {tab === 'new_dev' && (
            <BugsNewDevTab kind="improvement" tickets={TAB_DEFS[1].filter(tickets, me)} onCreate={createTicket} onAssign={assignTicket} onViewDetails={openDetails} toast={toast}
              canCreate={can('techmodule.bugs_new_dev', 'create')} canAssign={can('techmodule.bugs_new_dev', 'assign')} />
          )}
          {tab === 'in_progress' && (
            <InProgressTab tickets={TAB_DEFS[2].filter(tickets, me)} onSubmitAndSendForQa={submitReportAndSendForQa} onViewDetails={openDetails} toast={toast}
              canEdit={can('techmodule.in_progress', 'edit')} />
          )}
          {tab === 'qa_review' && (
            <QaReviewTab tickets={TAB_DEFS[3].filter(tickets, me)} onReview={submitReview} onViewDetails={openDetails} toast={toast}
              canApprove={can('techmodule.qa_review', 'approve')} />
          )}
          {tab === 'ready_for_release' && (
            <ReadyForReleaseTab tickets={TAB_DEFS[4].filter(tickets, me)} onRelease={release} onViewDetails={openDetails} toast={toast}
              canRelease={can('techmodule.ready_for_release', 'approve')} />
          )}
        </>
      )}

      {detailTicket && (
        <TicketDetailModal
          ticket={detailTicket}
          onClose={() => setDetailId(null)}
          onOpenSupportSession={onOpenSupportSession}
          onOpenRelated={(ticketNumber) => setDetailId(ticketNumber)}
        />
      )}
    </div>
  );
}
