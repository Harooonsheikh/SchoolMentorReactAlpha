import { buildUrl, resolveMediaUrl } from '../../utils/apiConfig';

const ssGet = (k) => (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(k) : null);

/* "2026-06-03T00:00:00" → "June 2026" (for Member since). */
function monthYear(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/* Jo kuch sessionStorage se khud bana sakte hain — API ka jawab aane se
   pehle, aur request nakaam hone par bhi wahi.

   Pehle yahan mock/profile.js ke naam bhar jate thay: "The Oxford System,
   Lahore Campus", "admin@schoolmentor.app", "Member since May 2024",
   "Last login Today, 1:02 PM". Ye kisi asli user ka data nahi tha, magar
   profile par bilkul asli lagta tha. Ab jo maloom nahi wo khali rehta hai. */
function sessionFallback() {
  const displayName = ssGet('displayName') || ssGet('userName') || '';
  return {
    name:        displayName,
    displayName,
    role:        ssGet('accountType') || '',
    email:       ssGet('email') || '',
    phone:       ssGet('userName') || '',
    campus:      ssGet('branchName') || displayName || '',
    cnic:        '',
    language:    'English (UK)',
    photo:       '',
    memberSince: '',
    lastLogin:   '',
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
    role:        d.designationName || ssGet('accountType') || '',
    email:       d.email || '',
    phone:       d.phone || '',
    campus:      ssGet('branchName') || ssGet('displayName') || d.departmentName || '',
    cnic:        d.cnic || '',
    language:    'English (UK)',
    photo:       resolveMediaUrl(d.empImage),
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

/* localStorage key holding the OTP returned by /api/Auth/sendforchangepassword
   (the signup flow stores its own as 'signup_otp'). */
const PWD_OTP_KEY = 'profile_pwd_otp';

/* Send a password-change OTP to the user's registered number. Uses the dedicated
   /api/Auth/sendforchangepassword endpoint — NOT the signup flow's /api/Auth/send,
   which is for new registrations. The server returns the OTP in the response; we
   stash it in localStorage so verifyPasswordOtp can match against it. */
export async function sendPasswordOtp(phone) {
  if (!phone) throw new Error('No contact number on file');
  const res = await fetch(buildUrl(`/api/Auth/sendforchangepassword?PhoneNumber=${encodeURIComponent(phone)}`), {
    method: 'POST',
    headers: { Accept: '*/*' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(errMsg(json) || 'Could not send OTP');
  }

  /* OTP response me kahin bhi aa sakti hai: apni field me (`otp`), `data` ke
     andar, ya sirf message ke text me ("Your OTP is 1234"). Sirf ek jagah dekhna
     kaafi nahi tha — field na milne par OTP save hi nahi hoti thi aur Step 2 par
     sahi code bhi "Incorrect OTP" deta tha. Is liye pehle explicit fields, phir
     message se 4+ digits nikaal lo. */
  const otp = pickOtp(json);
  /* OTP kahin na mili to aage barhna bekaar hai — verify har baar fail karta aur
     user ko wajah samajh na aati. Purani OTP bhi hata do, warna wo match kar
     sakti thi. */
  if (!otp) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(PWD_OTP_KEY);
    throw new Error('OTP could not be read from the server response');
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(PWD_OTP_KEY, otp);
  return { sent: true, otp, message: json?.message ?? json?.Message, to: phone };
}

/* Server ka error message. ASP.NET validation errors `message` me nahi, `errors`
   object me aate hain ({ errors: { PhoneNumber: ["The PhoneNumber field is
   required."] } }) — sirf `message` dekhne par user ko bay-maani "Could not send
   OTP" milta tha. */
function errMsg(json) {
  if (!json || typeof json !== 'object') return '';
  const direct = json.message || json.Message;
  if (direct) return String(direct);
  const errs = json.errors || json.Errors;
  if (errs && typeof errs === 'object') {
    const first = Object.values(errs).flat().filter(Boolean)[0];
    if (first) return String(first);
  }
  return json.title ? String(json.title) : '';
}

/* Response body se OTP nikaalo — explicit field pehle, warna message ke text se. */
function pickOtp(json) {
  if (!json || typeof json !== 'object') return '';
  const direct = json.otp ?? json.OTP ?? json.Otp
    ?? json.data?.otp ?? json.data?.OTP ?? json.data?.Otp;
  if (direct != null && String(direct).trim() !== '') return String(direct).trim();

  const msg = String(json.message ?? json.Message ?? '');
  const m = msg.match(/\d{4,8}/);          // "Your OTP is 1234"
  return m ? m[0] : '';
}

/* Match the entered code against the OTP saved in localStorage (synchronous).
   Sirf tab true jab koi OTP save ho aur bilkul match kare. */
export function verifyPasswordOtp(code) {
  const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem(PWD_OTP_KEY) : '') || '';
  return saved.trim() !== '' && String(code).trim() === saved.trim();
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
    throw new Error(errMsg(json) || 'Could not update password');
  }
  if (typeof localStorage !== 'undefined') localStorage.removeItem(PWD_OTP_KEY);
  return json?.data ?? json;
}
