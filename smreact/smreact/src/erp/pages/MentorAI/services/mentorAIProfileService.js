import mentorAiApi, { secureMentorUrl } from './mentorAiApi';

/* ═══════════════════════════════════════════════════════════════════
   Mentor AI — Profile (Postman collection):
     GET  /ai/api/auth/profile/   → current user / branch profile
     PUT  /ai/api/profile/        multipart: name, email, phone, city, state,
                                  logo (file), profile_image (file), description
   Response shape collection me nahi hai — fields defensively padhe jate hain
   (top-level ya nested `profile` / `branch` / `user` / `data`).
   ═══════════════════════════════════════════════════════════════════ */

const pickFrom = (objs, ...keys) => {
  for (const o of objs) {
    if (!o || typeof o !== 'object') continue;
    for (const k of keys) {
      const v = o[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
  }
  return '';
};

export function normalizeProfile(body) {
  const root = body?.data && typeof body.data === 'object' ? body.data : (body || {});
  const layers = [root, root.profile, root.branch, root.user, root.user?.profile];
  return {
    name:         pickFrom(layers, 'name', 'branch_name', 'school_name', 'full_name'),
    email:        pickFrom(layers, 'email'),
    phone:        pickFrom(layers, 'phone', 'phone_number', 'mobile'),
    city:         pickFrom(layers, 'city'),
    state:        pickFrom(layers, 'state'),
    description:  pickFrom(layers, 'description', 'about'),
    logo:         secureMentorUrl(pickFrom(layers, 'logo', 'logo_url')) || '',
    profileImage: secureMentorUrl(pickFrom(layers, 'profile_image', 'profileImage', 'avatar')) || '',
  };
}

export async function getMentorProfile() {
  const res = await mentorAiApi.get('/ai/api/auth/profile/');
  return normalizeProfile(res.data);
}

/* `files` = { logo?: File, profileImage?: File } — sirf wahi files bhejti hai jo user ne chuni. */
export async function updateMentorProfile(values = {}, files = {}) {
  const fd = new FormData();
  ['name', 'email', 'phone', 'city', 'state', 'description'].forEach((k) => fd.append(k, String(values[k] ?? '')));
  if (files.logo instanceof File) fd.append('logo', files.logo, files.logo.name);
  if (files.profileImage instanceof File) fd.append('profile_image', files.profileImage, files.profileImage.name);
  const res = await mentorAiApi.put('/ai/api/profile/', fd, { timeout: 60000 });
  return normalizeProfile(res.data);
}
