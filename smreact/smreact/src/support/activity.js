// ══════════════════════════════════════════════════════════════════
//  Support chat ka activity window (SupportWidget ka band-widget unread poll
//  aur useSupportChat ka REST fallback poll — dono isay share karte hain).
//
//  Scenario (chat module se mukhtalif):
//    • Login / ERP browsing par KUCH NAHI — koi support poll nahi.
//    • Poll sirf tab shuru hota hai jab user support chat khol kar ek message
//      BHEJE. Us ke baad aakhri message ke 2 min baad tak (SUPPORT_MSG_MS)
//      chalta hai — jawab (doosri taraf se) aaye to 2 min phir reset.
//    • 2 min khamoshi ke baad ruk jata hai; user ka agla message dobara
//      chalata hai. (Tab focus par, agar ek dafa shuru ho chuka ho, choti si
//      grace — late jawab aaya ho to nazar aa jaye.)
// ══════════════════════════════════════════════════════════════════
import { createActivityWindow } from '../utils/activityWindow';

export const supportWindow = createActivityWindow();

export const SUPPORT_MSG_MS = 120 * 1000;       // aakhri message ke baad 2 min
export const SUPPORT_FOCUS_GRACE_MS = 8 * 1000; // focus par ek tick ki grace

/* Is login me user ne kabhi support me message bheja? Isse pehle focus-grace
   nahi chalni chahiye (warna bina kisi guftagu ke support poll chal parta). */
let everStarted = false;

/** User ne message bheja — window khol do aur "shuru ho chuki" nishan laga do. */
export const startSupport = () => { everStarted = true; supportWindow.open(SUPPORT_MSG_MS); };

/** Koi message hua (bheji / aayi) — 2 min reset. */
export const pingSupport = () => supportWindow.ping(SUPPORT_MSG_MS);

/** Tab focus — sirf tab jab support ek dafa shuru ho chuka ho. */
export const nudgeSupportOnFocus = () => {
  if (everStarted) supportWindow.ping(SUPPORT_FOCUS_GRACE_MS);
};

export const supportActive = () => supportWindow.active();
