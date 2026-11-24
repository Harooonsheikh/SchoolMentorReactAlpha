import { useEffect, useRef } from 'react';
import * as techTicketsApi from '../api/services/techTickets';
import { currentUserId } from '../api/services/auth';
import { playIncomingChime } from '../../support/sound';
import { TYPE_LABEL } from '../techTicketsData';

/* ═══════════════════════════════════════════════════════════════════
   TechAssignmentListener — background watcher (renders nothing).

   Jab logged-in user ko naya Bug / New Development ticket assign ho:
     • notification sound (Support wali chime) bajti hai
     • in-app toast message dikhta hai
     • browser notification (agar permission di hui ho)

   Do cases cover hote hain:
     1. Login / page open par — jo assignments user ne abhi tak nahi dekhi
     2. App khuli ho aur usi waqt assign ho — har POLL_MS par check

   "Dekh liya" ka record localStorage me per-user rakha jata hai
   (ticket id + assignedAt, taake reassign par dobara notify ho).
   Is browser par pehli dafa chalne par purani assignments par shor nahi
   machta — sirf baseline save hota hai.
   ═══════════════════════════════════════════════════════════════════ */

const POLL_MS = 60 * 1000;
const MAX_KEYS = 500;
const storeKey = (me) => `sa-tech-assign-seen-${me}`;

const assignKey = (t) => `${t.id}:${t.assignedAt || ''}`;

function readSeen(me) {
  try {
    const raw = localStorage.getItem(storeKey(me));
    return raw ? new Set(JSON.parse(raw)) : null; // null = pehli dafa
  } catch { return null; }
}

function writeSeen(me, set) {
  try { localStorage.setItem(storeKey(me), JSON.stringify([...set].slice(-MAX_KEYS))); } catch { /* ignore */ }
}

function showBrowserNotification(title, body, onClick) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.ico', tag: 'school-mentor-tech-assign' });
    n.onclick = () => { window.focus(); onClick?.(); n.close(); };
  } catch { /* ignore */ }
}

export default function TechAssignmentListener({ enabled = true, toast, onOpen }) {
  const toastRef = useRef(toast);
  const openRef = useRef(onOpen);
  toastRef.current = toast;
  openRef.current = onOpen;

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    let busy = false;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const check = async () => {
      const me = currentUserId();
      if (!me || busy) return;
      busy = true;
      try {
        const tickets = await techTicketsApi.getTickets();
        if (!alive) return;
        /* Mere assigned, abhi development me — khud ko assign kiya ho to notify nahi. */
        const mine = tickets.filter((t) => t.stage === 'in_progress'
          && Number(t.assignedTo?.id) === me
          && Number(t.assignedBy?.id) !== me);

        const seen = readSeen(me);
        if (!seen) { writeSeen(me, new Set(mine.map(assignKey))); return; }

        const fresh = mine.filter((t) => !seen.has(assignKey(t)));
        if (!fresh.length) return;
        fresh.forEach((t) => seen.add(assignKey(t)));
        writeSeen(me, seen);

        const msg = fresh.length === 1
          ? `New ${TYPE_LABEL[fresh[0].type] || 'ticket'} assigned to you: ${fresh[0].ticketNumber} — ${fresh[0].title}`
          : `${fresh.length} new tickets assigned to you (${fresh.map((t) => t.ticketNumber).join(', ')})`;

        playIncomingChime();
        toastRef.current?.(msg, 'info', 8000);
        showBrowserNotification('Tech Module — New Assignment', msg, () => openRef.current?.());
      } catch { /* network error — next poll will retry */ } finally {
        busy = false;
      }
    };

    check();
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return null;
}
