import React, { useEffect, useRef, useState } from 'react';
import * as profileService from './services/mentorAIProfileService';

/* Mentor AI Profile — slide-over panel (header ke "Profile" button se khulta hai).
   Branch ka naam / contact / logo / photo / description dikhata aur update karta hai.
   Existing msai-panel* styles use hote hain; sirf chhoti local CSS neeche hai. */

const PROFILE_CSS = `
.msai-prof-imgs { display:flex; gap:16px; flex-wrap:wrap; }
.msai-prof-img { display:flex; flex-direction:column; align-items:center; gap:8px; }
.msai-prof-img-box { width:84px; height:84px; border-radius:var(--radius-md); border:1.5px dashed var(--border-med); background:var(--bg-muted); display:flex; align-items:center; justify-content:center; overflow:hidden; color:var(--text-muted); font-size:22px; }
.msai-prof-img-box img { width:100%; height:100%; object-fit:cover; }
.msai-prof-img-box--round { border-radius:50%; }
.msai-prof-img-lbl { font:800 11px/1 var(--font-body); color:var(--text-secondary); }
`;

const errMessage = (e) => {
  const d = e?.response?.data;
  const status = e?.response?.status;
  /* Server HTML error page (jaise Django ka "Not Found") seedha dikhana theek nahi. */
  if (typeof d === 'string' && /^\s*<(!doctype|html)/i.test(d)) {
    return status === 404
      ? 'This profile service is not available on the Mentor AI server yet (404).'
      : `The Mentor AI server returned an error${status ? ` (${status})` : ''}.`;
  }
  return (typeof d === 'string' ? d : d?.error || d?.message || d?.detail) || e?.message || 'Something went wrong.';
};

/* GET profile na mile to login ke waqt mili user info se form pehle se bhar do. */
const cachedUserProfile = () => {
  try {
    const raw = localStorage.getItem('mentor_ai_user');
    return raw ? profileService.normalizeProfile(JSON.parse(raw)) : null;
  } catch { return null; }
};

export default function MentorAIProfile({ onClose, toast }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [v, setV] = useState({ name: '', email: '', phone: '', city: '', state: '', description: '' });
  const [imgs, setImgs] = useState({ logo: '', profileImage: '' });          // saved (server) urls
  const [files, setFiles] = useState({ logo: null, profileImage: null });    // newly picked files
  const [previews, setPreviews] = useState({ logo: '', profileImage: '' });  // local blob urls
  const logoRef = useRef(null);
  const photoRef = useRef(null);

  useEffect(() => {
    let alive = true;
    profileService.getMentorProfile().then(p => {
      if (!alive) return;
      setV({ name: p.name, email: p.email, phone: p.phone, city: p.city, state: p.state, description: p.description });
      setImgs({ logo: p.logo, profileImage: p.profileImage });
    }).catch(e => {
      if (!alive) return;
      setError(errMessage(e));
      /* Form band nahi karte: jo login se pata hai wo bhar kar edit/save karne dete hain. */
      const c = cachedUserProfile();
      if (c) {
        setV({ name: c.name, email: c.email, phone: c.phone, city: c.city, state: c.state, description: c.description });
        setImgs({ logo: c.logo, profileImage: c.profileImage });
      }
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => () => { Object.values(previews).forEach(u => u && URL.revokeObjectURL(u)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (key) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast?.('Please choose an image file.'); return; }
    setFiles(f => ({ ...f, [key]: file }));
    setPreviews(p => { if (p[key]) URL.revokeObjectURL(p[key]); return { ...p, [key]: URL.createObjectURL(file) }; });
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const p = await profileService.updateMentorProfile(v, files);
      if (p.logo || p.profileImage) setImgs({ logo: p.logo || imgs.logo, profileImage: p.profileImage || imgs.profileImage });
      setFiles({ logo: null, profileImage: null });
      toast?.('Profile updated');
    } catch (e) { toast?.(errMessage(e)); } finally { setSaving(false); }
  };

  const set = (k) => (e) => setV(prev => ({ ...prev, [k]: e.target.value }));
  const shownLogo = previews.logo || imgs.logo;
  const shownPhoto = previews.profileImage || imgs.profileImage;

  return (
    <div className="msai-panel-overlay" onClick={onClose}>
      <style>{PROFILE_CSS}</style>
      <div className="msai-panel" onClick={e => e.stopPropagation()} role="dialog" aria-label="Mentor AI profile">
        <div className="msai-panel-head">
          <span>Mentor AI Profile</span>
          <button type="button" className="msai-icon-btn" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" aria-hidden="true" /></button>
        </div>
        <div className="msai-panel-body">
          {loading && <div className="msai-empty-state"><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Loading profile…</div>}
          {!loading && error && <div className="msai-tip-card"><i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> Could not load your saved profile — {error}</div>}
          {!loading && (
            <>
              <div className="msai-prof-imgs">
                <div className="msai-prof-img">
                  <div className="msai-prof-img-box">{shownLogo ? <img src={shownLogo} alt="School logo" /> : <i className="fa-solid fa-school" aria-hidden="true" />}</div>
                  <button type="button" className="msai-chip" onClick={() => logoRef.current?.click()}>Change Logo</button>
                  <input ref={logoRef} type="file" accept="image/*" hidden onChange={pick('logo')} />
                </div>
                <div className="msai-prof-img">
                  <div className="msai-prof-img-box msai-prof-img-box--round">{shownPhoto ? <img src={shownPhoto} alt="Profile" /> : <i className="fa-solid fa-user" aria-hidden="true" />}</div>
                  <button type="button" className="msai-chip" onClick={() => photoRef.current?.click()}>Change Photo</button>
                  <input ref={photoRef} type="file" accept="image/*" hidden onChange={pick('profileImage')} />
                </div>
              </div>

              <div className="msai-field"><label>School / Name</label><input type="text" value={v.name} onChange={set('name')} /></div>
              <div className="msai-field"><label>Email</label><input type="email" value={v.email} onChange={set('email')} /></div>
              <div className="msai-field"><label>Phone</label><input type="text" value={v.phone} onChange={set('phone')} /></div>
              <div className="msai-form-grid">
                <div className="msai-field"><label>City</label><input type="text" value={v.city} onChange={set('city')} /></div>
                <div className="msai-field"><label>State</label><input type="text" value={v.state} onChange={set('state')} /></div>
              </div>
              <div className="msai-field"><label>Description</label><textarea rows={4} value={v.description} onChange={set('description')} placeholder="A short note about your school" /></div>

              <button type="button" className="msai-btn-primary" disabled={saving} onClick={save}>
                {saving ? <><i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Saving…</> : <><i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Save Profile</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
