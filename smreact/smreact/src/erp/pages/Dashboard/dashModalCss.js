/* ═══════════════════════════════════════════════════════════════════
   SHARED MODAL CSS for the Dashboard modals.

   The Announcements + App-Pending-Report modals were using the
   `up-modal-*` class set, which is defined inside UserPermissions
   module's UP_CSS string. That CSS only injects when the
   UserPermissions component renders. From the dashboard the user
   could click "View Details" or "Download Report" before ever
   visiting User Permissions — at that point the up-modal-* classes
   didn't exist, the modal rendered invisibly, and `body.overflow:
   hidden` (set in useEffect) locked the page.

   This file ports the minimum required classes so the dashboard
   modals are fully self-contained. Both modals inject this CSS via
   `<style>{DASH_MODAL_CSS}</style>`.
   ═══════════════════════════════════════════════════════════════════ */
export const DASH_MODAL_CSS = `
:root { --dm-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif; }
@keyframes dmFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dmPop  { from { transform: translateY(8px) scale(.985); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

/* ─── Modal scaffolding ─── */
.up-modal-back {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(8, 13, 26, .55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  animation: dmFade .14s ease-out;
}
.up-modal {
  width: min(620px, 100%);
  max-height: 92vh;
  background: var(--bg-card, #fff);
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(8, 13, 26, .35);
  display: flex; flex-direction: column;
  overflow: hidden;
  font-family: var(--dm-font);
  animation: dmPop .18s cubic-bezier(.2, .8, .2, 1);
}
.up-modal--lg { width: min(820px, 100%); }
.up-modal--xl { width: min(1000px, 100%); height: 90vh; max-height: 90vh; }
.up-modal--sm { width: min(480px, 100%); border-radius: 18px; }
@media (max-width: 600px) {
  .up-modal-back { padding: 12px; }
  .up-modal, .up-modal--lg, .up-modal--xl, .up-modal--sm { max-width: 96vw; }
  .up-modal-head, .up-modal-foot { padding-left: 14px; padding-right: 14px; }
  .up-modal-body { padding-left: 14px; padding-right: 14px; }
}

/* ─── Header (gradient brand chrome) ─── */
.up-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 14px; padding: 16px 22px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  flex-shrink: 0;
}
.up-modal-head-l { display: flex; align-items: center; gap: 14px; min-width: 0; }
.up-modal-icn {
  width: 42px; height: 42px; border-radius: 12px;
  background: rgba(255, 255, 255, .15);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
}
.up-modal-title {
  font-family: var(--dm-font);
  font-size: 16px; font-weight: 800;
  letter-spacing: -.01em; line-height: 1.3;
  word-break: break-word;
}
.up-modal-sub {
  font-family: var(--dm-font);
  font-size: 12px; font-weight: 500;
  color: rgba(255, 255, 255, .85);
  margin-top: 3px;
  display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap;
}
.up-modal-x {
  width: 34px; height: 34px; border: none;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
  transition: background .15s ease;
}
.up-modal-x:hover { background: rgba(255, 255, 255, .22); }

/* ─── Body + footer ─── */
.up-modal-body {
  flex: 1; overflow-y: auto;
  padding: 18px 22px;
  background: #F0F4FF;
}
[data-theme="dark"] .up-modal-body { background: rgba(255, 255, 255, .03); }
.up-modal-body--row {
  display: flex; flex-direction: row;
  gap: 0; padding: 0; background: transparent;
}
.up-modal-foot {
  display: flex; justify-content: flex-end; gap: 10px;
  padding: 14px 22px;
  background: var(--bg-card, #fff);
  border-top: 1px solid var(--border-light, #E2E8F0);
  flex-shrink: 0; flex-wrap: wrap;
}
.up-modal-foot--split { justify-content: space-between; align-items: center; }
.up-modal-foot--center { justify-content: center; }
.up-modal-foot-l { display: inline-flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.up-modal-foot-r { display: inline-flex; gap: 10px; align-items: center; }

/* ─── Buttons (used in modal footer) ─── */
.up-btn {
  display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 14px;
  font: 600 12px/1 var(--dm-font);
  border-radius: 9px; border: 1px solid transparent;
  cursor: pointer; transition: all .18s ease;
}
.up-btn:disabled { opacity: .5; cursor: not-allowed; }
.up-btn i { font-size: 11px; }
.up-btn-sm { height: 32px; padding: 0 12px; font-size: 11.5px; }
.up-btn-primary {
  background: linear-gradient(135deg, #1E3A8A, #1E40AF, #2563EB);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28);
}
.up-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(30, 58, 138, .38);
}
.up-btn-ghost {
  background: #fff;
  color: #475569;
  border-color: #E2E8F0;
}
.up-btn-ghost:hover:not(:disabled) {
  background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF;
}
[data-theme="dark"] .up-btn-ghost {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border-light);
}
[data-theme="dark"] .up-btn-ghost:hover:not(:disabled) {
  background: rgba(96, 165, 250, .08);
  border-color: #2B3E66;
  color: #93C5FD;
}

/* ─── Badges (header + footer use these) ─── */
.up-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  font: 700 10.5px/1 var(--dm-font);
  text-transform: uppercase; letter-spacing: .3px;
  white-space: nowrap;
}
.up-badge i { font-size: 9px; }
.up-badge--green  { background: rgba(21, 128, 61, .12);  color: #15803D; }
.up-badge--blue   { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.up-badge--gray   { background: rgba(100, 116, 139, .14); color: #475569; }
.up-badge--amber  { background: rgba(217, 119, 6, .12);  color: #92400E; }
.up-badge--red    { background: rgba(220, 38, 38, .12);  color: #B91C1C; }
.up-badge--purple { background: rgba(124, 58, 237, .14); color: #6D28D9; }
[data-theme="dark"] .up-badge--blue   { background: rgba(96, 165, 250, .18); color: #BFDBFE; }
[data-theme="dark"] .up-badge--green  { background: rgba(74, 222, 128, .18); color: #BBF7D0; }
[data-theme="dark"] .up-badge--red    { background: rgba(248, 113, 113, .18); color: #FECACA; }
[data-theme="dark"] .up-badge--gray   { background: rgba(148, 163, 184, .18); color: #CBD5E1; }
[data-theme="dark"] .up-badge--purple { background: rgba(167, 139, 250, .18); color: #DDD6FE; }

/* ─── Empty state (no-announcements fallback) ─── */
.up-empty {
  text-align: center; padding: 50px 24px;
  animation: dmFade .3s ease;
}
.up-empty-ic {
  width: 64px; height: 64px; border-radius: 16px;
  display: inline-flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  color: #1E40AF; font-size: 26px; margin-bottom: 14px;
}
.up-empty-t { font: 800 16px/1.4 var(--dm-font); color: var(--text-primary); margin-bottom: 4px; }
.up-empty-s { font: 500 12.5px/1.5 var(--dm-font); color: var(--text-muted, #64748B); }
`;
