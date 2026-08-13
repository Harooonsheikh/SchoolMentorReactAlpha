import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import { SCHOOL_MENTOR_ANNOUNCEMENTS } from './dashboardData';
import { DASH_MODAL_CSS } from './dashModalCss';

/* ═══════════════════════════════════════════════════════════════════
   ANNOUNCEMENTS MODAL — clean timeline list of every School Mentor
   message received this month. Each row shows status badge, title,
   description, date, time, sender, and category. Local "Mark all
   read" toggle that mutates the in-memory list (would be persisted
   to backend in production).
   ═══════════════════════════════════════════════════════════════════ */
export default function AnnouncementsModal({ onClose, toast = () => {}, announcements }) {
  /* Real announcements (API se) prop me aate hain — jab pass hon (khaali array bhi)
     to wahi dikhao; na aayein (purane callers) to fallback mock list. Is se dummy
     announcements khatam (API khaali → "No announcements" empty state). */
  const [items, setItems] = useState(Array.isArray(announcements) ? announcements : SCHOOL_MENTOR_ANNOUNCEMENTS);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const unreadCount = items.filter(i => i.status === 'new').length;

  const markRead = (id) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'read' } : i));
  };
  const markAllRead = () => {
    if (unreadCount === 0) return;
    setItems(prev => prev.map(i => ({ ...i, status: 'read' })));
    toast('All announcements marked as read', 'success');
  };

  return createPortal((
    <div
      className="up-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="an-modal-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="up-modal up-modal--lg" style={{ maxHeight: '90vh' }}>
        {/* ─── Head ─── */}
        <div className="up-modal-head">
          <div className="up-modal-head-l">
            <div className="up-modal-icn"><i className="fa-solid fa-bullhorn" aria-hidden="true"></i></div>
            <div>
              <div className="up-modal-title" id="an-modal-title">School Mentor Announcements</div>
              <div className="up-modal-sub">
                <span>This month · {items.length} total</span>
                {unreadCount > 0 && (
                  <span
                    className="up-badge up-badge--red"
                    style={{ background: 'rgba(255,255,255,.22)', color: '#fff' }}
                  >
                    <span
                      style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'inline-block', marginRight: 4 }}
                    />
                    {unreadCount} unread
                  </span>
                )}
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="up-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        {/* ─── Body — timeline list ─── */}
        <div className="up-modal-body" style={{ background: 'var(--bg-muted, #F8FAFF)' }}>
          {items.length === 0 ? (
            <div className="up-empty">
              <div className="up-empty-ic"><i className="fa-solid fa-bullhorn" aria-hidden="true"></i></div>
              <div className="up-empty-t">No announcements this month</div>
              <div className="up-empty-s">You're all caught up. Check back later.</div>
            </div>
          ) : (
            <div className="an-timeline">
              {items.map((a, idx) => {
                const isUnread = a.status === 'new';
                return (
                  <div key={a.id} className={`an-row${isUnread ? ' an-row--new' : ''}`}>
                    <div className="an-rail">
                      <span className={`an-dot${isUnread ? ' an-dot--new' : ''}`} />
                      {idx < items.length - 1 && <span className="an-line" />}
                    </div>
                    <div className="an-card">
                      <div className="an-card-h">
                        <div className="an-card-h-l">
                          <span className={`an-status${isUnread ? ' an-status--new' : ''}`}>
                            {isUnread ? 'Unread' : 'Read'}
                          </span>
                          <span className="an-category">{a.category}</span>
                        </div>
                        <div className="an-card-h-r">
                          <i className="fa-solid fa-calendar-day" aria-hidden="true"></i>
                          <span>{a.date}</span>
                          <span className="an-sep">·</span>
                          <i className="fa-solid fa-clock" aria-hidden="true"></i>
                          <span>{a.time}</span>
                        </div>
                      </div>
                      <div className="an-title">{a.title}</div>
                      <div className="an-desc">{a.description}</div>
                      <div className="an-foot">
                        <span className="an-sender">
                          <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
                          {a.sender}
                        </span>
                        {isUnread && (
                          <button
                            type="button"
                            className="an-mark-read"
                            onClick={() => markRead(a.id)}
                          >
                            Mark as read <i className="fa-solid fa-check" aria-hidden="true"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Foot ─── */}
        <div className="up-modal-foot up-modal-foot--split">
          <div className="up-modal-foot-l">
            <span className="up-badge up-badge--blue">{items.length} total</span>
            {unreadCount > 0 && (
              <span className="up-badge up-badge--red">{unreadCount} unread</span>
            )}
            <span className="up-badge up-badge--gray">{items.length - unreadCount} read</span>
          </div>
          <div className="up-modal-foot-r">
            <button
              type="button"
              className="up-btn up-btn-ghost"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <i className="fa-solid fa-check-double" aria-hidden="true"></i> Mark all read
            </button>
            <button type="button" className="up-btn up-btn-primary" onClick={onClose}>
              <i className="fa-solid fa-check" aria-hidden="true"></i> Done
            </button>
          </div>
        </div>
      </div>

      <style>{DASH_MODAL_CSS}</style>
      <style>{AN_CSS}</style>
    </div>
  ), document.body);
}

const AN_CSS = `
.an-timeline {
  display: flex; flex-direction: column;
  padding: 4px 4px 8px;
}
.an-row {
  display: flex; gap: 14px;
  padding: 6px 0;
}
.an-rail {
  position: relative; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center;
  width: 14px; padding-top: 18px;
}
.an-dot {
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--bg-card, #fff);
  border: 2px solid #94A3B8;
  flex-shrink: 0;
  z-index: 1;
}
.an-dot--new {
  background: #DC2626;
  border-color: #DC2626;
  box-shadow: 0 0 0 4px rgba(220, 38, 38, .15);
}
.an-line {
  flex: 1;
  width: 2px;
  background: var(--border-light, #E2E8F0);
  margin-top: 2px;
  min-height: 24px;
}
.an-card {
  flex: 1; min-width: 0;
  padding: 14px 16px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border-light, #E2E8F0);
  border-radius: 12px;
  transition: all .15s;
}
.an-card:hover {
  border-color: #CBD5E1;
  box-shadow: 0 4px 12px rgba(15, 23, 42, .06);
}
[data-theme="dark"] .an-card:hover { border-color: #2B3E66; box-shadow: 0 4px 12px rgba(0, 0, 0, .35); }
.an-row--new .an-card {
  border-color: rgba(220, 38, 38, .22);
  background: linear-gradient(135deg, rgba(220, 38, 38, .03), var(--bg-card, #fff));
}
.an-card-h {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; margin-bottom: 8px; flex-wrap: wrap;
}
.an-card-h-l { display: inline-flex; align-items: center; gap: 8px; }
.an-card-h-r {
  display: inline-flex; align-items: center; gap: 6px;
  font: 600 11px/1 var(--up-font);
  color: var(--text-muted, #64748B);
}
.an-card-h-r i { font-size: 10px; }
.an-sep { color: #CBD5E1; }
.an-status {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 999px;
  font: 800 10px/1 var(--up-font);
  text-transform: uppercase; letter-spacing: .5px;
  background: rgba(100, 116, 139, .14);
  color: #475569;
}
.an-status--new {
  background: rgba(220, 38, 38, .14);
  color: #B91C1C;
}
.an-category {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: 999px;
  font: 700 10.5px/1 var(--up-font);
  background: rgba(30, 64, 175, .12);
  color: #1E40AF;
}
.an-title {
  font: 800 15px/1.3 var(--up-font);
  color: var(--text-primary);
  letter-spacing: -0.2px;
  margin-bottom: 6px;
}
.an-desc {
  font: 500 12.5px/1.6 var(--up-font);
  color: var(--text-secondary, #475569);
}
.an-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-light, #E2E8F0);
  flex-wrap: wrap;
}
.an-sender {
  display: inline-flex; align-items: center; gap: 5px;
  font: 600 11px/1 var(--up-font);
  color: var(--text-muted, #64748B);
}
.an-sender i { color: #1E40AF; font-size: 10px; }
.an-mark-read {
  display: inline-flex; align-items: center; gap: 5px;
  height: 26px; padding: 0 10px;
  background: transparent;
  border: 1px solid rgba(30, 64, 175, .24);
  border-radius: 7px;
  font: 700 11px/1 var(--up-font);
  color: #1E40AF;
  cursor: pointer; transition: all .15s;
}
.an-mark-read:hover {
  background: rgba(30, 64, 175, .08);
  border-color: #1E40AF;
}
.an-mark-read i { font-size: 9px; }

[data-theme="dark"] .an-card { background: #0E1628; border-color: #1F3158; }
[data-theme="dark"] .an-row--new .an-card {
  background: linear-gradient(135deg, rgba(248, 113, 113, .06), #0E1628);
  border-color: rgba(248, 113, 113, .22);
}
[data-theme="dark"] .an-status { background: rgba(148, 163, 184, .16); color: #94A3B8; }
[data-theme="dark"] .an-status--new { background: rgba(248, 113, 113, .14); color: #F87171; }
[data-theme="dark"] .an-category { background: rgba(96, 165, 250, .12); color: #60A5FA; }
[data-theme="dark"] .an-mark-read { color: #60A5FA; border-color: rgba(96, 165, 250, .24); }
[data-theme="dark"] .an-foot { border-top-color: #1C2E50; }
[data-theme="dark"] .an-line { background: #1C2E50; }
[data-theme="dark"] .an-dot { background: #0E1628; border-color: #94A3B8; }
`;
