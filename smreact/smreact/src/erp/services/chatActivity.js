// ══════════════════════════════════════════════════════════════════
//  Chat module ka activity window (App.js ke global badge/notification poll
//  aur Chat.jsx ke in-page poll — dono isay share karte hain).
//
//  Scenario:
//    • ERP login par 1 min poll (CHAT_LOGIN_MS) — pending messages foran aa jayen.
//    • Us ke baad poll ruk jata hai.
//    • Dobara chalta hai jab: user message bheje / chat khole, ya (tab wapas
//      focus hone par) doosri taraf se jawab mila ho — har soorat me aakhri
//      message ke 2 min baad tak (CHAT_MSG_MS).
// ══════════════════════════════════════════════════════════════════
import { createActivityWindow } from '../../utils/activityWindow';

export const chatWindow = createActivityWindow();

export const CHAT_LOGIN_MS = 60 * 1000;    // login par 1 minute
export const CHAT_MSG_MS = 120 * 1000;     // aakhri message ke baad 2 minute
/* Tab wapas focus hone par choti si grace — ek tick chal kar dekh le ke
   doosri taraf se koi jawab aaya ya nahi. Kuch naya mila to poll khud 2 min
   tak barha lega; warna window phir band. */
export const CHAT_FOCUS_GRACE_MS = 8 * 1000;

/** Login par poll shuru karo (1 min). */
export const startChatLoginWindow = () => chatWindow.open(CHAT_LOGIN_MS);

/** Koi message hua (bheji / aayi) — 2 min reset. */
export const pingChat = () => chatWindow.ping(CHAT_MSG_MS);

/** Tab focus — ek tick ke liye window khol do (jawab aaya ho to pakda jaye). */
export const nudgeChatOnFocus = () => chatWindow.ping(CHAT_FOCUS_GRACE_MS);

export const chatActive = () => chatWindow.active();
