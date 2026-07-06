/* ════════════════════════════════════════════════════════════════════
   Support frontend configuration + runtime bridge.

   The support UI runs in three ways, all served by the SAME components:
     1. Inside the CRA dev app  → values come from REACT_APP_* env vars
                                   (or the localhost defaults below).
     2. Embedded in ASP.NET MVC → the host page calls
                                   window.SchoolMentorSupportWidget.init({...})
                                   / SchoolMentorSupportAdmin.init({...}),
                                   which calls configureSupport(opts) to inject
                                   apiBaseUrl / signalRHubUrl / token / identity
                                   at runtime — NO hardcoded URLs, NO re-login.

   The exported SUPPORT_API_BASE / SUPPORT_HUB_URL / SUPPORT_BACKEND_ENABLED are
   declared with `let` so configureSupport() can update them; ES module live
   bindings propagate the new values to every importer (api.js, realtime.js,
   the components) the next time they read them.
   ════════════════════════════════════════════════════════════════════ */

const env = (typeof process !== 'undefined' && process.env) ? process.env : {};

/* Mutable runtime config — defaults from env / localhost, overridden by init(). */
const cfg = {
  apiBaseUrl: env.REACT_APP_SUPPORT_API || 'http://localhost:5150',
  hubUrl: env.REACT_APP_SUPPORT_HUB || null,   // null → derived from apiBaseUrl
  token: env.REACT_APP_SUPPORT_TOKEN || null,  // bridge JWT from the host app
  identity: {
    role: null,        // 'SchoolUser' | 'Agent' | 'SuperAdmin'
    userId: null,
    schoolId: null,
    schoolName: null,
    campusName: null,
    agentId: null,
    name: null,
    email: null,
    contactNumber: null,
  },
};

const deriveHub = () => cfg.hubUrl || `${cfg.apiBaseUrl}/hubs/support`;

/* Live-binding exports (updated by configureSupport). */
export let SUPPORT_API_BASE = cfg.apiBaseUrl;
export let SUPPORT_HUB_URL = deriveHub();
export let SUPPORT_BACKEND_ENABLED = Boolean(cfg.apiBaseUrl);

const IDENTITY_KEYS = [
  'role', 'userId', 'schoolId', 'schoolName', 'campusName',
  'agentId', 'name', 'email', 'contactNumber',
];

/**
 * Apply host-supplied configuration at runtime. Called by the embed entry
 * points (window.SchoolMentorSupport*.init). Safe to call more than once.
 *
 *   configureSupport({
 *     apiBaseUrl, signalRHubUrl, token,
 *     role, userId, schoolId, schoolName, campusName, agentId, name, email, contactNumber
 *   })
 */
export function configureSupport(opts = {}) {
  if (opts.apiBaseUrl) cfg.apiBaseUrl = stripTrailingSlash(opts.apiBaseUrl);
  if (opts.signalRHubUrl) cfg.hubUrl = opts.signalRHubUrl;
  if (opts.token) cfg.token = opts.token;

  for (const k of IDENTITY_KEYS) {
    if (opts[k] != null) cfg.identity[k] = opts[k];
  }

  SUPPORT_API_BASE = cfg.apiBaseUrl;
  SUPPORT_HUB_URL = deriveHub();
  SUPPORT_BACKEND_ENABLED = Boolean(cfg.apiBaseUrl);
  return { ...cfg };
}

const stripTrailingSlash = (u) => (typeof u === 'string' ? u.replace(/\/+$/, '') : u);

/** Bridge JWT issued by the host ERP / Super Admin backend (null in demo mode). */
export const getSupportToken = () => cfg.token;
/** Identity claims the host passed alongside the token (display only). */
export const getSupportIdentity = () => ({ ...cfg.identity });
/** True when the host injected a token → skip the demo login flow. */
export const hasBridgeToken = () => Boolean(cfg.token);

/* Backend is "enabled" whenever a base URL is configured. When the API is
   unreachable the components fall back to their offline demo behaviour. */

/* Demo credentials matching the seeded accounts (DbSeeder). Used ONLY when no
   bridge token is supplied (i.e. the standalone CRA dev app). In production the
   host app injects a real token via init() and these are never touched. */
export const DEMO_SCHOOL_LOGIN = {
  usernameOrEmail: env.REACT_APP_SUPPORT_SCHOOL_USER || 'daffodil',
  password: env.REACT_APP_SUPPORT_SCHOOL_PASS || 'Password123!',
};
export const DEMO_AGENT_LOGIN = {
  usernameOrEmail: env.REACT_APP_SUPPORT_AGENT_USER || 'admin@schoolmentor.app',
  password: env.REACT_APP_SUPPORT_AGENT_PASS || 'Password123!',
};

/* Backend enum values (mirror SchoolMentor.Support.Domain.Enums). */
export const SenderType = { School: 1, Agent: 2 };
export const MessageStatus = { Sent: 1, Delivered: 2, Read: 3 };
export const SessionStatus = { Open: 1, Closed: 2 };
export const UserRole = { SchoolUser: 1, Agent: 2, SuperAdmin: 3 };
export const MessageType = {
  Text: 1, Image: 2, Document: 3, Pdf: 4, VoiceNote: 5, Video: 6, Screenshot: 7,
};

/* Max files per single send, by category (frontend-enforced). */
export const ATTACH_LIMITS = { image: 10, document: 10, video: 5 };

/* Build an absolute URL for a stored attachment (backend returns "/files/..."). */
export const fileUrl = (relativeOrAbsolute) => {
  if (!relativeOrAbsolute) return '';
  return /^https?:\/\//i.test(relativeOrAbsolute)
    ? relativeOrAbsolute
    : `${cfg.apiBaseUrl}${relativeOrAbsolute}`;
};
