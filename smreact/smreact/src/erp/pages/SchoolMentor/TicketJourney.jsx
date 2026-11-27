import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import DataState from '../../shared/DataState';
import EmptyState from '../../shared/EmptyState';
import Skeleton from '../../shared/Skeleton';
import useAsyncData from '../../hooks/useAsyncData';
import Tooltip from '../../components/Tooltip';
import * as ticketJourneyService from '../../services/ticketJourneyService';

/* ═══════════════════════════════════════════════════════════════════
   MY TICKETS — the school's read-only view of every bug / improvement
   it reported through Support, shown as a journey:

     Reported → Added to Sprint → Development Complete → Quality Testing → Live

   The school only ever moves FORWARD on this track. If QA sends a fix
   back to the developer, the backend keeps journeyStage = 'testing', so
   the school just keeps seeing "under testing" (see
   ticketJourneyService.toJourneyStage).

   Data: ticketJourneyService (mock today, API later). Contract and
   backend guide: TICKET_JOURNEY_GUIDE.md.

   Props
     onUnseenChange(count)   keeps the sidebar badge in sync
   ═══════════════════════════════════════════════════════════════════ */

/* ── Customer-facing copy, one entry per journeyStage ─────────────── */
const STAGE_COPY = {
  received: {
    chip: 'Received', tone: 'slate', icon: 'fa-inbox', progress: 10,
    tip: 'Logged by our support team. Waiting to be planned into a sprint.',
    headline: 'We’ve received your request',
    message: () => 'Our team is reviewing it and will plan it into an upcoming sprint. You’ll see every step here.',
  },
  in_sprint: {
    chip: 'In development', tone: 'blue', icon: 'fa-code', progress: 35,
    tip: 'Planned in a sprint. A developer is working on it.',
    headline: 'In development',
    message: (t) => t.sprint
      ? `It has been planned in ${t.sprint.name} and a developer is working on it right now.`
      : 'A developer has picked it up and is working on it right now.',
  },
  testing: {
    chip: 'Under testing', tone: 'purple', icon: 'fa-vial-circle-check', progress: 65,
    tip: 'Development is done. Our quality team is testing it before it goes live.',
    headline: 'Development is done, now under testing',
    message: () => 'Our quality team is testing it carefully before it goes live, so it works perfectly for everyone. This can take a little time.',
  },
  approved: {
    chip: 'Going live soon', tone: 'teal', icon: 'fa-box-open', progress: 85,
    tip: 'Testing passed. It will be live in the next School Mentor update.',
    headline: 'Testing passed, going live soon',
    message: () => 'Everything checked out. It will be live for your school in the next School Mentor update.',
  },
  released: {
    chip: 'Resolved', tone: 'green', icon: 'fa-circle-check', progress: 100,
    tip: 'Live for your school. This ticket is complete.',
    headline: 'Successfully resolved',
    message: (t) => t.type === 'improvement'
      ? 'Your suggestion is now live for your school. Thank you for helping us make School Mentor better!'
      : 'The fix is live for your school. Thank you for reporting it and helping us make School Mentor better!',
  },
};

/* Which step is "current" for each stage (index into STEPS). */
const CURRENT_STEP = { received: 1, in_sprint: 2, testing: 3, approved: 4, released: 5 };

const STEPS = [
  { key: 'reported',  label: 'Reported',             icon: 'fa-flag',
    doneText: () => 'You reported this to School Mentor Support.',
    dateOf: (t) => t.reportedAt },
  { key: 'sprint',    label: 'Added to Sprint',      icon: 'fa-calendar-check',
    doneText: (t) => `${t.sprint ? `Planned in ${t.sprint.name} (${fmtDate(t.sprint.startsAt)} – ${fmtDate(t.sprint.endsAt)}).` : 'Planned into our development queue.'}${t.expectedDays ? ` Expected time: ${daysLabel(t.expectedDays)}.` : ''}`,
    currentText: () => 'Waiting to be planned into an upcoming sprint.',
    dateOf: (t) => t.sprintAddedAt },
  { key: 'dev',       label: 'Development Complete', icon: 'fa-laptop-code',
    doneText: () => 'Our developer finished the work and handed it to testing.',
    currentText: () => 'A developer is working on it.',
    dateOf: (t) => t.developmentCompletedAt },
  { key: 'testing',   label: 'Quality Testing',      icon: 'fa-vial-circle-check',
    doneText: () => 'Tested and approved by our quality team.',
    currentText: (t) => `Being tested since ${fmtDateTime(t.developmentCompletedAt)}.`,
    dateOf: (t) => t.testingPassedAt },
  { key: 'live',      label: 'Live & Resolved',      icon: 'fa-rocket',
    doneText: (t) => t.type === 'improvement' ? 'Now live for your school.' : 'The fix is now live for your school.',
    currentText: () => 'Approved, and will go live in the next update.',
    dateOf: (t) => t.releasedAt },
];

const STEP_STATUS_TIP = {
  done: 'Completed',
  current: 'Happening now',
  upcoming: 'Not started yet',
};

const MODULE_LABEL = {
  fee: 'Fee', attendance: 'Attendance', examination: 'Examination', hr: 'Human Resource',
  students: 'Students', timetable: 'Time Table', accounts: 'Accounts', general: 'General',
};

const TYPE_META = {
  bug:         { label: 'Bug',         icon: 'fa-bug' },
  improvement: { label: 'Improvement', icon: 'fa-lightbulb' },
};

/* ── Date helpers ─────────────────────────────────────────────────── */
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
}
function fmtDateTime(iso) { return iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '—'; }
function fmtSpan(fromIso, toIso) {
  if (!fromIso || !toIso) return '';
  const mins = Math.max(0, Math.round((new Date(toIso) - new Date(fromIso)) / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'}`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
function fmtAgo(iso) {
  const span = fmtSpan(iso, new Date().toISOString());
  return span ? (span.startsWith('0 ') ? 'just now' : `${span} ago`) : '';
}

/* Expected time (set by Support when the developer is assigned).
   Returns null when not set or already released. */
export function expectedStatus(t) {
  if (!t.expectedLiveBy || t.journeyStage === 'released') return null;
  const late = Date.now() > new Date(t.expectedLiveBy).getTime();
  return { late, days: t.expectedDays, by: t.expectedLiveBy };
}
const daysLabel = (n) => `${n} day${n === 1 ? '' : 's'}`;

/* Builds the 5 steps with status + date for one ticket. */
export function buildJourney(t) {
  const current = CURRENT_STEP[t.journeyStage] ?? 1;
  let prevAt = null;
  return STEPS.map((s, i) => {
    const status = i < current ? 'done' : i === current ? 'current' : 'upcoming';
    const at = status === 'done' ? s.dateOf(t) : null;
    const step = {
      ...s,
      status,
      at,
      text: status === 'done' ? s.doneText(t) : status === 'current' ? (s.currentText?.(t) || '') : '',
      after: at && prevAt ? fmtSpan(prevAt, at) : '',
    };
    if (at) prevAt = at;
    return step;
  });
}

/* Desktop: size the list/detail area to exactly fill the rest of the
   viewport, so each column scrolls on its own and the page never runs off
   the bottom. (Sticky positioning can't be used: the ERP shell's
   overflow-x:hidden wrappers break it.) Mobile keeps normal page scroll. */
function useFitToViewport(ref, deps) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      if (!window.matchMedia('(min-width: 901px)').matches) { el.style.height = ''; return; }
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(480, window.innerHeight - top - 24)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(document.body);
    return () => { window.removeEventListener('resize', fit); ro?.disconnect(); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════ */
export default function TicketJourney({ onUnseenChange = () => {} }) {
  const tickets = useAsyncData(ticketJourneyService.getMyTickets, []);
  const [statusFilter, setStatusFilter] = useState('all');   // all | active | resolved
  const [typeFilter, setTypeFilter] = useState('all');       // all | bug | improvement
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const gridRef = useRef(null);
  useFitToViewport(gridRef, [tickets.data]);

  const rows = useMemo(() => tickets.data || [], [tickets.data]);

  /* Keep the sidebar badge in sync with what's on screen. */
  useEffect(() => {
    if (tickets.data) onUnseenChange(rows.filter(t => t.hasNewUpdate).length);
  }, [rows, tickets.data, onUnseenChange]);

  const open = (id) => {
    setSelectedId(id);
    const t = rows.find(x => x.id === id);
    if (t?.hasNewUpdate) {
      tickets.setData(prev => prev.map(x => (x.id === id ? { ...x, hasNewUpdate: false } : x)));
      ticketJourneyService.markTicketSeen(id).catch(() => {});
    }
  };

  /* Desktop: open the newest ticket automatically so the page never
     looks empty. Mobile keeps the list first. */
  useEffect(() => {
    if (selectedId || !rows.length) return;
    if (window.matchMedia?.('(min-width: 901px)').matches) open(rows[0].id);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const resolved = rows.filter(t => t.journeyStage === 'released');
    return {
      total: rows.length,
      /* In progress = not yet "ready for release" and not released. */
      active: rows.filter(t => t.journeyStage !== 'approved' && t.journeyStage !== 'released').length,
      resolved: resolved.length,
      improvementsLive: resolved.filter(t => t.type === 'improvement').length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(t => {
      if (statusFilter === 'active' && (t.journeyStage === 'released' || t.journeyStage === 'approved')) return false;
      if (statusFilter === 'resolved' && t.journeyStage !== 'released') return false;
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (q && !`${t.ticketNumber} ${t.title} ${MODULE_LABEL[t.module] || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, statusFilter, typeFilter, search]);

  const selected = rows.find(t => t.id === selectedId) || null;

  return (
    <div className="tj-page">
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div className="tj-head">
        <h1 className="tj-title"><i className="fa-solid fa-route" /> My Tickets</h1>
        <p className="tj-sub">Follow every issue and idea you’ve shared with us, from the day you reported it until it goes live.</p>
      </div>

      <DataState
        loading={tickets.loading}
        error={tickets.error}
        isEmpty={tickets.isEmpty}
        onRetry={tickets.refetch}
        skeleton={<TicketsSkeleton />}
        empty={
          <EmptyState
            icon="fa-route"
            title="No tickets yet"
            message="When you report a bug or suggest an improvement through Support, you can follow its whole journey here."
          />
        }
      >
        {/* ── Stats + thank-you ── */}
        <div className="tj-stats">
          <Stat icon="fa-flag" tone="blue" label="Reported by you" value={stats.total}
            tip="All bugs and improvements your school has reported through Support." />
          <Stat icon="fa-spinner" tone="purple" label="In progress" value={stats.active}
            tip="Tickets not live yet: waiting for a sprint, in development or under testing." />
          <Stat icon="fa-circle-check" tone="green" label="Resolved" value={stats.resolved}
            tip="Tickets that are now live for your school." />
          <div className="tj-thanks">
            <i className="fa-solid fa-heart" />
            <div>
              <b>Thank you for helping us improve!</b>
              <span>
                {stats.resolved > 0
                  ? `${stats.resolved} of your reports ${stats.resolved === 1 ? 'is' : 'are'} already live${stats.improvementsLive ? `, including ${stats.improvementsLive} new feature${stats.improvementsLive === 1 ? '' : 's'}` : ''}.`
                  : 'Every report makes School Mentor better for your school.'}
              </span>
            </div>
          </div>
        </div>

        <div ref={gridRef} className={`tj-grid tj-grid--fit${selected ? ' has-sel' : ''}`}>
          {/* ── List ── */}
          <section className="tj-list-col">
            <div className="tj-filters">
              <div className="tj-seg" role="tablist" aria-label="Status">
                {[
                  ['all', 'All', 'Show every ticket'],
                  ['active', 'In progress', 'Tickets that are not live yet'],
                  ['resolved', 'Resolved', 'Tickets that are live for your school'],
                ].map(([id, lbl, tip]) => (
                  <Tooltip key={id} text={tip} placement="bottom">
                    <button role="tab" aria-selected={statusFilter === id}
                      className={statusFilter === id ? 'on' : ''} onClick={() => setStatusFilter(id)}>{lbl}</button>
                  </Tooltip>
                ))}
              </div>
              <div className="tj-filter-row">
                <div className="tj-search">
                  <i className="fa-solid fa-magnifying-glass" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets" aria-label="Search tickets" />
                </div>
                <Tooltip text="Bugs are things that don’t work. Improvements are new ideas." placement="bottom">
                <select className="tj-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Type">
                  <option value="all">All types</option>
                  <option value="bug">Bugs</option>
                  <option value="improvement">Improvements</option>
                </select>
                </Tooltip>
              </div>
            </div>

            <div className="tj-list-scroll">
              {filtered.length === 0 ? (
                <EmptyState icon="fa-filter" title="No matching tickets" message="Try a different filter or search." />
              ) : (
                <ul className="tj-list">
                  {filtered.map(t => (
                    <li key={t.id}>
                      <TicketCard ticket={t} active={t.id === selectedId} onClick={() => open(t.id)} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* ── Detail ── */}
          <section className="tj-detail-col">
            {selected
              ? <TicketDetail ticket={selected} onBack={() => setSelectedId(null)} />
              : <div className="tj-placeholder"><EmptyState icon="fa-hand-pointer" title="Select a ticket" message="Pick a ticket on the left to see its full journey." /></div>}
          </section>
        </div>
      </DataState>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PIECES
   ═══════════════════════════════════════════════════════════════════ */
function Stat({ icon, tone, label, value, tip }) {
  return (
    <Tooltip text={tip} placement="bottom">
    <div className="tj-stat" tabIndex={0}>
      <div className={`tj-stat-ic tone-${tone}`}><i className={`fa-solid ${icon}`} /></div>
      <div>
        <div className="tj-stat-v">{value}</div>
        <div className="tj-stat-l">{label}</div>
      </div>
    </div>
    </Tooltip>
  );
}

function StageChip({ stage }) {
  const c = STAGE_COPY[stage];
  return (
    <Tooltip text={c.tip}>
      <span className={`tj-chip tone-${c.tone}`}><i className={`fa-solid ${c.icon}`} /> {c.chip}</span>
    </Tooltip>
  );
}

function TypeTag({ type }) {
  const m = TYPE_META[type] || TYPE_META.bug;
  return (
    <Tooltip text={type === 'improvement' ? 'Improvement: a new idea or feature you suggested.' : 'Bug: something that was not working as it should.'}>
      <span className={`tj-type ${type}`}><i className={`fa-solid ${m.icon}`} /> {m.label}</span>
    </Tooltip>
  );
}

/* Tooltip for one dot: step name + its state/date. */
function miniDotTip(s, i, total) {
  const head = `Step ${i + 1} of ${total}: ${s.label}`;
  if (s.status === 'done') return s.at ? `${head} · Done ${fmtDate(s.at)}` : `${head} · Done`;
  if (s.status === 'current') return `${head} · In progress`;
  return `${head} · Upcoming`;
}

/* Compact 5-dot track used on list cards. */
function MiniTrack({ ticket }) {
  const steps = buildJourney(ticket);
  const cur = steps.find(s => s.status === 'current');
  const summary = cur ? `Now at step ${steps.indexOf(cur) + 1} of ${steps.length}: ${cur.label}` : `All ${steps.length} steps complete`;
  return (
    <div className="tj-mini" role="img" aria-label={summary}>
      {steps.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <span className={`tj-mini-line${s.status !== 'upcoming' ? ' on' : ''}`} />}
          {/* Each dot has its own tooltip; the wrapper gives it a
              comfortable 20px hover target around the 10px dot. */}
          <Tooltip text={miniDotTip(s, i, steps.length)}>
            <span className="tj-mini-hit"><span className={`tj-mini-dot ${s.status}`} /></span>
          </Tooltip>
        </React.Fragment>
      ))}
    </div>
  );
}

function TicketCard({ ticket: t, active, onClick }) {
  return (
    <button className={`tj-card${active ? ' active' : ''}`} onClick={onClick} aria-current={active || undefined}>
      <div className="tj-card-top">
        <span className="tj-num">{t.ticketNumber}</span>
        <TypeTag type={t.type} />
        {t.hasNewUpdate && (
          <Tooltip text="Something changed since you last opened this ticket.">
            <span className="tj-new">New update</span>
          </Tooltip>
        )}
      </div>
      <div className="tj-card-title">{t.title}</div>
      <MiniTrack ticket={t} />
      <div className="tj-card-foot">
        <StageChip stage={t.journeyStage} />
        <span className="tj-muted">Updated {fmtAgo(t.lastUpdatedAt)}</span>
      </div>
      <CardEta ticket={t} />
    </button>
  );
}

function CardEta({ ticket: t }) {
  const eta = expectedStatus(t);
  if (!eta) return null;
  return (
    <Tooltip text={`Our team expects this to be live in ${daysLabel(eta.days)} from the day it was planned.`}>
      <span className={`tj-eta${eta.late ? ' late' : ''}`}>
        <i className="fa-solid fa-hourglass-half" />
        {eta.late ? 'Taking a little longer than expected' : `Expected by ${fmtDate(eta.by)}`}
      </span>
    </Tooltip>
  );
}

function TicketDetail({ ticket: t, onBack }) {
  const eta = expectedStatus(t);
  const copy = STAGE_COPY[t.journeyStage];
  const steps = buildJourney(t);
  const released = t.journeyStage === 'released';

  return (
    <article className="tj-detail">
      <button className="tj-back" onClick={onBack}><i className="fa-solid fa-arrow-left" /> All tickets</button>

      <header className="tj-d-head">
        <div className="tj-card-top">
          <span className="tj-num">{t.ticketNumber}</span>
          <TypeTag type={t.type} />
          <span className="tj-muted">· {MODULE_LABEL[t.module] || t.module}</span>
        </div>
        <h2 className="tj-d-title">{t.title}</h2>
        <div className="tj-muted">Reported by {t.reportedByName} on {fmtDateTime(t.reportedAt)}</div>
      </header>

      {/* Status hero */}
      <div className={`tj-hero tone-${copy.tone}${released ? ' success' : ''}`}>
        <div className="tj-hero-ic"><i className={`fa-solid ${copy.icon}`} /></div>
        <div className="tj-hero-body">
          <div className="tj-hero-h">{copy.headline}</div>
          <p>{copy.message(t)}</p>
          {released && t.releasedAt && (
            <div className="tj-hero-meta">
              <span><i className="fa-solid fa-calendar-day" /> Live since {fmtDateTime(t.releasedAt)}</span>
              <Tooltip text="Time from the day you reported it to the day it went live">
                <span><i className="fa-solid fa-stopwatch" /> Resolved in {fmtSpan(t.reportedAt, t.releasedAt)}</span>
              </Tooltip>
              {t.expectedDays && (
                <Tooltip text="The expected time our team shared when development was planned">
                  <span><i className="fa-solid fa-hourglass-end" /> Expected {daysLabel(t.expectedDays)}</span>
                </Tooltip>
              )}
            </div>
          )}
          {eta && (
            <div className={`tj-hero-eta${eta.late ? ' late' : ''}`}>
              <i className="fa-solid fa-hourglass-half" />
              {eta.late
                ? <span>Expected by {fmtDate(eta.by)}. It’s taking a little longer than planned, and our team is on it. Thank you for your patience.</span>
                : <span><b>Expected time: {daysLabel(eta.days)}</b> · should be live by <b>{fmtDate(eta.by)}</b></span>}
            </div>
          )}
          {!released && (
            <Tooltip text={`About ${copy.progress}% of the way to going live`}>
            <div className="tj-progress" role="progressbar" aria-valuenow={copy.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Journey progress">
              <span style={{ width: `${copy.progress}%` }} />
            </div>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Journey timeline */}
      <h3 className="tj-h3">Journey</h3>
      <ol className="tj-timeline">
        {steps.map(s => (
          <li key={s.key} className={`tj-step ${s.status}`}>
            <div className="tj-step-rail">
              <Tooltip text={STEP_STATUS_TIP[s.status]} placement="right">
                <span className="tj-step-dot">
                  <i className={`fa-solid ${s.status === 'done' ? 'fa-check' : s.icon}`} />
                </span>
              </Tooltip>
            </div>
            <div className="tj-step-body">
              <div className="tj-step-row">
                <span className="tj-step-label">{s.label}</span>
                {s.status === 'current' && <span className="tj-now">In progress</span>}
                {s.status === 'upcoming' && <span className="tj-muted tj-small">Upcoming</span>}
              </div>
              {s.at && (
                <div className="tj-step-date">
                  <i className="fa-regular fa-clock" /> {fmtDate(s.at)} at {fmtTime(s.at)}
                  {s.after && <span className="tj-after"> · {s.after} later</span>}
                </div>
              )}
              {s.text && <div className="tj-step-text">{s.text}</div>}
            </div>
          </li>
        ))}
      </ol>

      {released && t.releaseNotes && (
        <>
          <h3 className="tj-h3">What changed</h3>
          <div className="tj-notes"><i className="fa-solid fa-wand-magic-sparkles" /> {t.releaseNotes}</div>
        </>
      )}

      {t.updates.length > 0 && (
        <>
          <h3 className="tj-h3">Updates from our team</h3>
          <ul className="tj-updates">
            {t.updates.map(u => (
              <li key={u.id}>
                <div className="tj-up-av"><i className="fa-solid fa-headset" /></div>
                <div>
                  <div className="tj-up-meta"><b>{u.author}</b> · {fmtDateTime(u.at)}</div>
                  <div className="tj-up-msg">{u.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="tj-h3">What you reported</h3>
      <ReportDetails ticket={t} />
    </article>
  );
}

/* The school's original report, laid out in labelled sections. Long
   reports scroll inside their own box so the journey stays in view. */
function ReportDetails({ ticket: t }) {
  const isBug = t.type === 'bug';
  const steps = (t.stepsToReproduce || []).filter(Boolean);
  return (
    <div className="tj-report" tabIndex={0} aria-label="Report details">
      <section>
        <div className="tj-report-lbl"><i className="fa-solid fa-align-left" /> Description</div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{t.description || 'No description was added to this ticket.'}</p>
      </section>
      {steps.length > 0 && (
        <section>
          <div className="tj-report-lbl"><i className="fa-solid fa-list-ol" /> Steps to see it</div>
          <ol>{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </section>
      )}
      {t.expectedBehaviour && (
        <section>
          <div className="tj-report-lbl ok"><i className="fa-solid fa-circle-check" /> {isBug ? 'What should happen' : 'How it should work'}</div>
          <p>{t.expectedBehaviour}</p>
        </section>
      )}
      {t.actualBehaviour && (
        <section>
          <div className="tj-report-lbl bad"><i className="fa-solid fa-circle-xmark" /> {isBug ? 'What happens instead' : 'How it works today'}</div>
          <p>{t.actualBehaviour}</p>
        </section>
      )}
    </div>
  );
}

function TicketsSkeleton() {
  return (
    <div className="tj-grid">
      <div className="tj-list-col">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} height={108} radius={12} style={{ display: 'block', marginBottom: 10 }} />)}
      </div>
      <div className="tj-detail-col"><Skeleton height={420} radius={14} style={{ display: 'block' }} /></div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STYLES — theme tokens from the shell (light + [data-theme="dark"])
   ═══════════════════════════════════════════════════════════════════ */
const CSS = `
.tj-page { max-width: 1440px; margin: 0 auto; color: var(--text-primary); }
.tj-head { margin-bottom:16px; }
.tj-title { font-size:20px; font-weight:800; margin:0 0 4px; display:flex; align-items:center; gap:10px; }
.tj-title i { color: var(--brand-mid); }
.tj-sub { margin:0; font-size:12.5px; color: var(--text-muted); max-width:560px; line-height:1.5; }
.tj-card:focus-visible, .tj-report:focus-visible, .tj-seg button:focus-visible, .tj-back:focus-visible { outline: 2px solid var(--brand-mid); outline-offset: 2px; }

.tj-stats { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)) minmax(0,2fr); gap:12px; margin-bottom:16px; }
.tj-stat, .tj-thanks { background: var(--bg-card); border:1px solid var(--border-light); border-radius: var(--radius-lg); padding:12px 14px; min-width:0; display:flex; align-items:center; gap:12px; box-shadow: var(--shadow-xs); }
.tj-stat-ic { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
.tj-stat-v { font-size:20px; font-weight:800; line-height:1.1; font-variant-numeric: tabular-nums; }
.tj-stat-l { font-size:11px; color: var(--text-muted); font-weight:600; }
.tj-thanks i { color:#E11D48; font-size:18px; }
.tj-thanks b { display:block; font-size:12.5px; }
.tj-thanks span { font-size:11.5px; color: var(--text-muted); }

.tone-blue   { --tc:#2563EB; --tb:rgba(37,99,235,.12); }
.tone-purple { --tc:#7C3AED; --tb:rgba(124,58,237,.12); }
.tone-green  { --tc:#16A34A; --tb:rgba(22,163,74,.13); }
.tone-teal   { --tc:#0D9488; --tb:rgba(13,148,136,.13); }
.tone-slate  { --tc:#64748B; --tb:rgba(100,116,139,.14); }
[data-theme="dark"] .tone-blue   { --tc:#60A5FA; }
[data-theme="dark"] .tone-purple { --tc:#A78BFA; }
[data-theme="dark"] .tone-green  { --tc:#4ADE80; }
[data-theme="dark"] .tone-teal   { --tc:#2DD4BF; }
[data-theme="dark"] .tone-slate  { --tc:#94A3B8; }
.tj-stat-ic.tone-blue, .tj-stat-ic.tone-purple, .tj-stat-ic.tone-green { color: var(--tc); background: var(--tb); }

/* Two columns. On desktop useFitToViewport() sets the grid's height and
   each column scrolls independently. */
.tj-grid { display:grid; grid-template-columns: minmax(280px, 360px) minmax(0,1fr); gap:16px; align-items:start; }
.tj-grid--fit { align-items:stretch; min-height:0; }
.tj-list-col, .tj-detail-col { min-width:0; min-height:0; display:flex; flex-direction:column; }
.tj-list-scroll { flex:1; min-height:0; overflow-y:auto; padding:3px 6px 6px 3px; margin:-3px -6px 0 -3px; }
.tj-detail-col > * { flex:1; min-height:0; }
.tj-list-scroll, .tj-detail, .tj-report { scrollbar-width: thin; scrollbar-color: var(--border-med) transparent; overscroll-behavior: contain; }
.tj-list-scroll::-webkit-scrollbar, .tj-detail::-webkit-scrollbar, .tj-report::-webkit-scrollbar { width:6px; }
.tj-list-scroll::-webkit-scrollbar-thumb, .tj-detail::-webkit-scrollbar-thumb, .tj-report::-webkit-scrollbar-thumb { background: var(--border-med); border-radius:6px; }

.tj-filters { display:flex; flex-direction:column; gap:8px; margin-bottom:10px; flex-shrink:0; }
.tj-seg { display:flex; background: var(--bg-muted); border:1px solid var(--border-light); border-radius: var(--radius-md); padding:3px; }
.tj-seg button { flex:1; border:0; background:transparent; font:inherit; font-size:12px; font-weight:700; color: var(--text-muted); padding:7px 8px; border-radius:7px; cursor:pointer; transition: var(--tr); }
.tj-seg button.on { background: var(--bg-card); color: var(--brand-dark); box-shadow: var(--shadow-xs); }
[data-theme="dark"] .tj-seg button.on { color: var(--brand-primary); }
.tj-filter-row { display:flex; gap:8px; }
.tj-search { flex:1; display:flex; align-items:center; gap:8px; background: var(--input-bg); border:1px solid var(--border-light); border-radius: var(--radius-md); padding:0 10px; }
.tj-search i { color: var(--text-muted); font-size:12px; }
.tj-search input { flex:1; min-width:0; border:0; outline:0; background:transparent; font:inherit; font-size:12.5px; color: var(--text-primary); padding:8px 0; }
.tj-select { font:inherit; font-size:12px; color: var(--text-primary); background: var(--input-bg); border:1px solid var(--border-light); border-radius: var(--radius-md); padding:0 8px; }

.tj-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.tj-card { width:100%; text-align:left; font:inherit; color:inherit; cursor:pointer; background: var(--bg-card); border:1px solid var(--border-light); border-radius: var(--radius-lg);
  padding:12px 14px; display:flex; flex-direction:column; gap:8px; transition: var(--tr); box-shadow: var(--shadow-xs); }
.tj-card:hover { border-color: var(--border-med); transform: translateY(-1px); }
.tj-card.active { border-color: var(--brand-mid); box-shadow: 0 0 0 3px rgba(var(--brand-primary-rgb), .12); }
.tj-card-top { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11px; }
.tj-num { font-weight:800; color: var(--text-secondary); font-variant-numeric: tabular-nums; letter-spacing:.2px; }
.tj-type { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:700; padding:2px 8px; border-radius: var(--radius-full); }
.tj-type.bug { color:#DC2626; background: rgba(220,38,38,.1); }
.tj-type.improvement { color:#B45309; background: rgba(217,119,6,.12); }
[data-theme="dark"] .tj-type.bug { color:#F87171; }
[data-theme="dark"] .tj-type.improvement { color:#FBBF24; }
.tj-new { margin-left:auto; font-size:10px; font-weight:800; color:#fff; background: var(--brand-mid); padding:2px 8px; border-radius: var(--radius-full); }
.tj-card-title { font-size:13px; font-weight:700; line-height:1.35; }
.tj-card-foot { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.tj-muted { color: var(--text-muted); font-size:11px; }
.tj-small { font-size:10.5px; }

.tj-eta { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; color: var(--text-secondary); align-self:flex-start; }
.tj-eta i { color: var(--brand-mid); font-size:10.5px; }
.tj-eta.late, .tj-eta.late i { color: var(--warning, #D97706); }
.tj-hero-eta { display:flex; gap:8px; align-items:flex-start; margin-top:10px; font-size:12px; line-height:1.5; color: var(--text-secondary);
  background: var(--bg-card); border:1px solid var(--border-light); border-radius: var(--radius-md); padding:8px 10px; }
.tj-hero-eta i { color: var(--brand-mid); margin-top:3px; }
.tj-hero-eta.late { border-color: rgba(217,119,6,.35); }
.tj-hero-eta.late i { color: var(--warning, #D97706); }
.tj-chip { display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700; padding:3px 9px; border-radius: var(--radius-full); color: var(--tc); background: var(--tb); }

.tj-mini { display:flex; align-items:center; margin: 0 -5px; }
.tj-mini-hit { width:20px; height:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0; border-radius:50%; }
.tj-mini-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; background: var(--bg-muted); border:2px solid var(--border-med); }
.tj-mini-dot.done { background:#16A34A; border-color:#16A34A; }
.tj-mini-dot.current { background: var(--bg-card); border-color: var(--brand-mid); box-shadow: 0 0 0 3px rgba(var(--brand-primary-rgb), .18); }
.tj-mini-line { flex:1; height:2px; background: var(--border-light); }
.tj-mini-line.on { background:#16A34A; }

.tj-detail { background: var(--bg-card); border:1px solid var(--border-light); border-radius: var(--radius-lg); padding:20px 22px 24px; box-shadow: var(--shadow-xs); overflow-y:auto; }
.tj-back { display:none; border:0; background:transparent; font:inherit; font-size:12px; font-weight:700; color: var(--brand-mid); cursor:pointer; padding:0; margin-bottom:12px; gap:6px; align-items:center; }
.tj-d-head { display:flex; flex-direction:column; gap:6px; margin-bottom:16px; }
.tj-d-title { font-size:17px; font-weight:800; margin:0; line-height:1.3; text-wrap: balance; }

.tj-hero { display:flex; gap:14px; padding:16px; border-radius: var(--radius-lg); background: var(--tb); border:1px solid transparent; }
.tj-hero-ic { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; background: var(--tc); font-size:18px; flex-shrink:0; }
.tj-hero-body { flex:1; min-width:0; }
.tj-hero-h { font-size:15px; font-weight:800; color: var(--tc); }
.tj-hero p { margin:4px 0 0; font-size:12.5px; line-height:1.55; color: var(--text-secondary); }
.tj-hero-meta { display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:10px; font-size:11.5px; font-weight:600; color: var(--text-secondary); }
.tj-hero-meta i { color: var(--tc); margin-right:4px; }
.tj-progress { margin-top:12px; height:6px; border-radius: var(--radius-full); background: rgba(127,127,127,.18); overflow:hidden; }
.tj-progress span { display:block; height:100%; border-radius:inherit; background: var(--tc); transition: width .6s ease; }
.tj-hero.success { border-color: rgba(22,163,74,.35); background: linear-gradient(135deg, rgba(22,163,74,.14), rgba(13,148,136,.10)); }
.tj-hero.success .tj-hero-ic { box-shadow: 0 0 0 6px rgba(22,163,74,.18); }
@media (prefers-reduced-motion: no-preference) {
  .tj-hero.success .tj-hero-ic { animation: tjPop .5s cubic-bezier(.2,1.4,.4,1) both; }
  .tj-step.current .tj-step-dot { animation: tjPulse 2s ease-in-out infinite; }
}
@keyframes tjPop { from { transform: scale(.6); opacity:0; } to { transform: scale(1); opacity:1; } }
@keyframes tjPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(var(--brand-primary-rgb), .35); } 50% { box-shadow: 0 0 0 7px rgba(var(--brand-primary-rgb), 0); } }

.tj-h3 { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color: var(--text-muted); margin:22px 0 10px; }
.tj-timeline { list-style:none; margin:0; padding:0; }
.tj-step { display:flex; gap:12px; }
.tj-step-rail { display:flex; flex-direction:column; align-items:center; width:30px; flex-shrink:0; }
.tj-step-rail::after { content:''; flex:1; width:2px; background: var(--border-light); margin:4px 0; min-height:18px; }
.tj-step:last-child .tj-step-rail::after { display:none; }
.tj-step.done .tj-step-rail::after { background:#16A34A; }
.tj-step-dot { width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0;
  background: var(--bg-muted); color: var(--text-muted); border:2px solid var(--border-light); }
.tj-step.done .tj-step-dot { background:#16A34A; border-color:#16A34A; color:#fff; }
.tj-step.current .tj-step-dot { background: var(--bg-card); border-color: var(--brand-mid); color: var(--brand-mid); }
.tj-step-body { padding: 4px 0 18px; min-width:0; }
.tj-step-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.tj-step-label { font-size:13px; font-weight:700; }
.tj-step.upcoming .tj-step-label { color: var(--text-muted); }
.tj-now { font-size:10px; font-weight:800; color: var(--brand-mid); background: rgba(var(--brand-primary-rgb), .12); padding:2px 8px; border-radius: var(--radius-full); }
.tj-step-date { font-size:11.5px; color: var(--text-secondary); margin-top:3px; font-variant-numeric: tabular-nums; }
.tj-step-date i { color: var(--text-muted); margin-right:3px; }
.tj-after { color: var(--text-muted); }
.tj-step-text { font-size:12px; color: var(--text-muted); margin-top:3px; line-height:1.5; }

.tj-notes { display:flex; gap:10px; font-size:12.5px; line-height:1.55; padding:12px 14px; border-radius: var(--radius-md); background: rgba(22,163,74,.08); border:1px solid rgba(22,163,74,.25); color: var(--text-secondary); }
.tj-notes i { color:#16A34A; margin-top:3px; }
.tj-updates { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.tj-updates li { display:flex; gap:10px; }
.tj-up-av { width:30px; height:30px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:12px; color: var(--brand-mid); background: rgba(var(--brand-primary-rgb), .12); }
.tj-up-meta { font-size:11px; color: var(--text-muted); }
.tj-up-meta b { color: var(--text-secondary); }
.tj-up-msg { font-size:12.5px; line-height:1.55; margin-top:2px; background: var(--bg-muted); padding:9px 12px; border-radius: 4px 12px 12px 12px; }
/* Original report — labelled sections, own scroller for long reports. */
.tj-report { max-height: 280px; overflow-y:auto; background: var(--bg-muted); border:1px solid var(--border-light); border-radius: var(--radius-md); padding:4px 14px; }
.tj-report section { padding:10px 0; }
.tj-report section + section { border-top:1px dashed var(--border-light); }
.tj-report-lbl { font-size:11px; font-weight:800; color: var(--text-secondary); display:flex; align-items:center; gap:6px; margin-bottom:4px; }
.tj-report-lbl i { color: var(--brand-mid); font-size:11px; }
.tj-report-lbl.ok i { color:#16A34A; }
.tj-report-lbl.bad i { color:#DC2626; }
.tj-report p { margin:0; font-size:12.5px; line-height:1.6; color: var(--text-secondary); white-space: pre-wrap; overflow-wrap:anywhere; }
.tj-report ol { margin:0; padding-left:20px; font-size:12.5px; line-height:1.6; color: var(--text-secondary); }
.tj-report ol li + li { margin-top:2px; }
.tj-placeholder { background: var(--bg-card); border:1px dashed var(--border-med); border-radius: var(--radius-lg); display:flex; align-items:center; justify-content:center; }

@media (max-width: 1100px) {
  .tj-stats { grid-template-columns: repeat(3, minmax(0,1fr)); }
  .tj-thanks { grid-column: 1 / -1; }
}
@media (max-width: 900px) {
  .tj-grid { grid-template-columns: 1fr; }
  .tj-list-scroll { overflow: visible; margin:0; padding:0; }
  .tj-detail { overflow: visible; }
  .tj-report { max-height: 320px; }
  .tj-detail-col { display:none; }
  .tj-grid.has-sel .tj-detail-col { display:block; }
  .tj-grid.has-sel .tj-list-col { display:none; }
  .tj-back { display:inline-flex; }
  .tj-detail { padding:16px; }
}
@media (max-width: 520px) {
  .tj-stats { grid-template-columns: 1fr 1fr; }
  .tj-stat:nth-child(3) { grid-column: 1 / -1; }
}
`;
