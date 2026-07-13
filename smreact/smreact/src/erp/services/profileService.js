import { mockProfile } from '../mock/profile';
import { buildUrl } from '../../utils/apiConfig';

const ssGet = (k) => (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(k) : null);

/* "2026-06-03T00:00:00" → "June 2026" (for Member since). */
function monthYear(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/* Whatever we can build from sessionStorage alone — used before the API resolves
   and as the fallback if the request fails. */
function sessionFallback() {
  const displayName = ssGet('displayName') || ssGet('userName') || '';
  return {
    name:        displayName || mockProfile.name,
    displayName,
    role:        ssGet('accountType') || mockProfile.role,
    email:       ssGet('email') || '',
    phone:       ssGet('userName') || '',
    campus:      ssGet('branchName') || displayName || '',
    cnic:        '',
    language:    'English (UK)',
    photo:       '',
    memberSince: mockProfile.memberSince,
    lastLogin:   mockProfile.lastLogin,
  };
}

/* Fetch the logged-in user's full employee record and map it to the profile
   form. The login user id lives in sessionStorage as 'UserID' (set at login);
   GET /api/HR/get-employee-by-loginuser/{loginUserId} resolves it to the
   employee. Campus name isn't in the record (only branchID), so it keeps the
   school/display name from login. Falls back to the session-only profile if the
   id is missing or the call fails. */
export async function getProfile() {
  const loginUserId = ssGet('UserID');
  const fallback = sessionFallback();
  if (!loginUserId) return fallback;

  let json = null;
  try {
    const res = await fetch(buildUrl(`/api/HR/get-employee-by-loginuser/${loginUserId}`), { headers: { Accept: '*/*' } });
    json = await res.json().catch(() => null);
    if (!res.ok) return fallback;
  } catch {
    return fallback;
  }
  const d = json?.data;
  if (!d || typeof d !== 'object') return fallback;

  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ').trim();
  return {
    employeeId:  d.id,
    name:        fullName || fallback.name,
    displayName: fullName || fallback.displayName,
    role:        d.designationName || ssGet('accountType') || mockProfile.role,
    email:       d.email || '',
    phone:       d.phone || '',
    campus:      ssGet('branchName') || ssGet('displayName') || d.departmentName || '',
    cnic:        d.cnic || '',
    language:    'English (UK)',
    photo:       d.empImage || '',
    memberSince: monthYear(d.dateOfJoining) || fallback.memberSince,
    lastLogin:   fallback.lastLogin,
  };
}

/* Update the logged-in user's profile. multipart/form-data PUT to
   /api/HR/update-employee-profile — loginUserId is the sessionStorage 'UserID'.
   `imageFile` (a File from the photo picker) is optional; omit it to leave the
   current photo unchanged. Full Name is split into first/last on the caller. */
export async function updateProfile(payload = {}) {
  const loginUserId = ssGet('UserID') || 0;
  const fd = new FormData();
  fd.append('loginUserId', String(loginUserId));
  fd.append('firstName',   payload.firstName || '');
  fd.append('lastName',    payload.lastName || '');
  fd.append('displayName', payload.displayName || '');
  fd.append('email',       payload.email || '');
  fd.append('cnic',        payload.cnic || '');
  fd.append('phone',       payload.phone || '');
  if (payload.imageFile) fd.append('EmpImageFile', payload.imageFile);

  const res = await fetch(buildUrl('/api/HR/update-employee-profile'), {
    method: 'PUT',
    headers: { Accept: '*/*' },   // NOTE: no Content-Type — the browser sets the multipart boundary
    body: fd,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error((json && (json.message || json.title)) || 'Could not update profile');
  }
  return json?.data ?? json;
}

/* localStorage key holding the OTP returned by /api/Auth/send, mirroring the
   signup flow (which stores it as 'signup_otp'). */
const PWD_OTP_KEY = 'profile_pwd_otp';

/* Send a password-change OTP to the user's registered number — same endpoint the
   signup flow uses. The server returns the OTP in the response; we stash it in
   localStorage so verifyPasswordOtp can match against it. */
export async function sendPasswordOtp(phone) {
  if (!phone) throw new Error('No contact number on file');
  const res = await fetch(buildUrl(`/api/Auth/send?PhoneNumber=${encodeURIComponent(phone)}`), {
    method: 'POST',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error((json && json.message) || 'Could not send OTP');
  }
  if (json?.otp != null && typeof localStorage !== 'undefined') {
    localStorage.setItem(PWD_OTP_KEY, String(json.otp));
  }
  return { sent: true, message: json?.message, to: phone };
}

/* Match the entered code against the OTP saved in localStorage (synchronous). */
export function verifyPasswordOtp(code) {
  const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem(PWD_OTP_KEY) : '') || '';
  return saved !== '' && String(code) === String(saved);
}

/* Update the logged-in user's password. PUT /api/HR/update-password with the
   sessionStorage 'UserID'. Clears the stored OTP on success. */
export async function changePassword(newPassword) {
  const userID = Number(ssGet('UserID')) || 0;
  const res = await fetch(buildUrl('/api/HR/update-password'), {
    method: 'PUT',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify({ userID, newPassword }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error((json && (json.message || json.title)) || 'Could not update password');
  }
  if (typeof localStorage !== 'undefined') localStorage.removeItem(PWD_OTP_KEY);
  return json?.data ?? json;
}
