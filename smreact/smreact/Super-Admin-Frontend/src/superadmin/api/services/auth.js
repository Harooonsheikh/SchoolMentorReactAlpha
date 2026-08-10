/* Auth service — sign-in for the standalone Super Admin console.

   Super Admin ka apna endpoint, SchoolMentorSuperAdminAPI ke ANDAR:
     POST {SA_ADMIN_API_BASE}/SchoolMentorSuperAdminAPI/api/Auth/login
     body: { user_Name, password }        (schema: MdlAHM_SuperAdmin_Login)
   Main ERP app ka /api/Auth/login is se alag route hai (ERP host par) —
   dono ka naam ek jaisa hai, base alag.

   Login hamesha ASLI API par jata hai, chahe baqi screens mock mode me hon —
   demo credentials se andar aa jana aur phir har screen ka khali hona is se
   behtar hai ke login wahin saaf mana kar de.

   Jab console kisi host app ke andar chalta hai to host khud
   configureSuperAdmin({ token }) se JWT deta hai aur login screen aati hi
   nahi. */
import { ApiError } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminIdentity, getSuperAdminToken } from '../config';
import EP from '../endpoints';

/* Backend kabhi JSON deta hai aur kabhi plain text (e.g. "Internal Server
   Error: This branch is not active."). Dono se kaam ka message nikaalo.

   Raw text sirf TAB use hota hai jab jawab JSON tha hi nahi — warna user ko
   error ki jagah poora JSON body dikhne lagta hai. */
function messageFrom(data, raw, fallback) {
  const m = data && (data.message || data.Message || data.title || data.error);
  if (m) return String(m);
  if (data) return fallback;                 // JSON tha, magar koi message nahi
  const text = String(raw || '').trim();
  return text && text.length < 300 ? text : fallback;
}

/* Login response ki har value sessionStorage me — key hamesha "superadmin"
   se shuru (baqi app aur koi bhi screen inhi naamon se padh sakti hai).
   Field na aaye to us key ko haath nahi lagate. */
export const SA_SESSION_KEYS = {
  id:              'superadminid',
  firstName:       'superadminfirstname',
  lastName:        'superadminlastname',
  user_Name:       'superadminusername',
  isAdmin:         'superadminisadmin',
  signUpDateTime:  'superadminsignupdatetime',
  token:           'superadmintoken',
};

function storeSession(data) {
  try {
    Object.entries(SA_SESSION_KEYS).forEach(([field, key]) => {
      const v = data?.[field];
      if (v === undefined || v === null) return;
      sessionStorage.setItem(key, String(v));
    });
  } catch { /* storage band ho to login phir bhi chalta rahe */ }
}

/** Logout par ye saari keys hata do. */
export function clearStoredSession() {
  try {
    Object.values(SA_SESSION_KEYS).forEach((key) => sessionStorage.removeItem(key));
  } catch { /* ignore */ }
}

/** sessionStorage me sign-in ke do laazmi tukde (id + token) mojood hain? */
export function hasStoredSession() {
  try {
    return Boolean(
      sessionStorage.getItem(SA_SESSION_KEYS.id)
      && sessionStorage.getItem(SA_SESSION_KEYS.token),
    );
  } catch {
    return false;
  }
}

/**
 * POST /api/Auth/login
 * @param {{userName: string, password: string}} credentials
 * @returns {Promise<{token: string, user: {id, name, email, role}}>}
 * @throws {ApiError} ghalat credentials par server ka apna message, 0 jab
 *                    backend tak pahuncha hi na ja sake.
 */
export async function login({ userName, password }) {
  let res;
  let raw;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.auth.login()}`, {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_Name: String(userName || '').trim(), password }),
    });
    raw = await res.text();
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }

  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* plain-text jawab */ }

  if (!res.ok) {
    throw new ApiError(messageFrom(data, raw, 'Login failed'), res.status);
  }
  /* Band kiya hua account har jagah block. */
  if (data?.isActive === false) {
    throw new ApiError('This account is deactivated. Please contact your administrator.', 403);
  }
  if (!data?.token) {
    throw new ApiError(messageFrom(data, raw, 'Login succeeded but no session token was returned.'), res.status);
  }

  /* Har value sessionStorage me (superadminid / superadminusername /
     superadmintoken waghera) — dekho SA_SESSION_KEYS. */
  storeSession(data);

  /* Response me naam do fields me aata hai (firstName/lastName) aur login id
     `user_Name` me — screen ke liye ek saaf naam bana lete hain. */
  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();
  return {
    token: data.token,
    user: {
      id:       data.id ?? data.userID ?? null,
      name:     fullName || data.displayName || data.user_Name || String(userName || '').trim(),
      userName: data.user_Name || String(userName || '').trim(),
      email:    data.email || '',
      role:     data.isAdmin ? 'Super Admin' : (data.accountType || 'superadmin'),
    },
    raw: data,
  };
}

/**
 * Abhi kaun logged in hai — uski userId.
 * Pehle runtime identity (login par configureSuperAdmin se set hoti hai), warna
 * sessionStorage ka `superadminid`. Reload ke foran baad identity abhi set na
 * hui ho to bhi API ko 0 nahi jata.
 * @returns {number} 0 jab koi session hi na ho
 */
export function currentUserId() {
  const fromCfg = Number(getSuperAdminIdentity().userId);
  if (fromCfg > 0) return fromCfg;
  try { return Number(sessionStorage.getItem(SA_SESSION_KEYS.id)) || 0; }
  catch { return 0; }
}

/* ── Users directory ───────────────────────────────────────────────
   GET /api/Auth/get-all-users
     → { success, count, data: [ { id, firstName, lastName, user_Name,
                                   signUpDateTime, isAdmin } ] }
   Screens ka har "Assigned To" / "Select User" dropdown isi se banta hai:
   dikhta naam hai, jaata `id` hai. */

/** Ek API row → dropdown ke liye saaf shape. */
export function userRowToUi(r) {
  const first = String(r?.firstName ?? '').trim();
  const last  = String(r?.lastName ?? '').trim();
  const login = String(r?.user_Name ?? r?.userName ?? '').trim();
  const full  = [first, last].filter(Boolean).join(' ').trim();
  return {
    id:        Number(r?.id ?? r?.userID) || 0,
    firstName: first,
    lastName:  last,
    userName:  login,
    /* firstName + lastName; dono khali hon to login id — koi naam ghadte nahi. */
    name:      full || login || `User #${Number(r?.id) || 0}`,
    isAdmin:   Boolean(r?.isAdmin),
    signUpDateTime: String(r?.signUpDateTime ?? ''),
    raw: r,
  };
}

/**
 * Saare Super Admin users.
 * @returns {Promise<Array<{id:number,name:string,userName:string}>>}
 */
export async function listUsers() {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.auth.allUsers()}`, {
      headers: { accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (!res.ok) throw new ApiError(`Failed to load users (${res.status})`, res.status);
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  return rows.map(userRowToUi).filter((u) => u.id);
}
