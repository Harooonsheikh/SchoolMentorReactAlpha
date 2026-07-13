import React, { useEffect, useRef, useState } from 'react';
import Tooltip from './Tooltip';
import * as profileService from '../services/profileService';
import useAsync from '../hooks/useAsync';

/* ═══════════════════════════════════════════════════════════════════
   ProfileModal — code-split out of App.js so the My Profile module can
   be lazy-loaded (its CSS still lives in App.js because it ships with
   the shell). Pure UI: data flows through profileService via useAsync.
   ═══════════════════════════════════════════════════════════════════ */
export default function ProfileModal({ open, onClose, toast }) {
  const { data: profile } = useAsync(profileService.getProfile, []);
  const [tab, setTab] = useState('info');
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);   // raw File to upload (null = keep existing)
  const [unsaved, setUnsaved] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Editable form fields — seeded from the fetched profile once it loads. */
  const [form, setForm] = useState({
    fullName: '', displayName: '', email: '', phone: '', cnic: '', language: 'English (UK)',
  });
  useEffect(() => {
    if (!profile) return;
    setForm({
      fullName:    profile.name || '',
      displayName: profile.displayName || profile.name || '',
      email:       profile.email || '',
      phone:       profile.phone || '',
      cnic:        profile.cnic || '',
      language:    profile.language || 'English (UK)',
    });
    setOtpPhone(profile.phone || '');
    if (profile.photo) setAvatarSrc(profile.photo);
    setUnsaved(false);
  }, [profile]);
  const setField = (k, v) => { setForm(f => ({ ...f, [k]: v })); setUnsaved(true); };

  /* Avatar initials from the user's name (falls back to "U"). */
  const initials = (form.fullName || profile?.name || 'U')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'U';

  const [pwdStep, setPwdStep] = useState(1);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState(false);
  const [otpTimer, setOtpTimer] = useState(120);
  const [otpSentTo, setOtpSentTo] = useState('');

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const fileInputRef = useRef(null);
  const otpRefs = useRef([]);

  /* Body scroll lock + Escape close */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', h);
    };
  }, [open, onClose]);

  /* OTP countdown */
  useEffect(() => {
    if (!open || pwdStep !== 2 || otpTimer <= 0) return;
    const id = setInterval(() => setOtpTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [open, pwdStep, otpTimer]);

  const handleAvatarChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('File too large. Max 2MB.', 'error'); return; }
    setAvatarFile(file);
    setUnsaved(true);
    const reader = new FileReader();
    reader.onload = ev => {
      setAvatarSrc(ev.target.result);
      toast('Photo selected — click Save Changes to apply', 'success');
    };
    reader.readAsDataURL(file);
  };
  const removeAvatar = () => {
    setAvatarSrc(null);
    setAvatarFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast('Photo removed', 'info');
  };

  const sendOTP = async () => {
    if (!otpPhone.trim()) { toast('No contact number on file — add one in Personal Info first', 'error'); return; }
    try {
      await profileService.sendPasswordOtp(otpPhone);
    } catch (err) { toast(err.message || 'Could not send OTP', 'error'); return; }
    setOtpSentTo(otpPhone);
    setOtpDigits(['', '', '', '']);
    setOtpError(false);
    setOtpTimer(120);
    setPwdStep(2);
    toast(`OTP sent to ${otpPhone}`, 'success');
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };
  const resendOTP = async () => {
    try {
      await profileService.sendPasswordOtp(otpPhone);
    } catch (err) { toast(err.message || 'Could not resend OTP', 'error'); return; }
    setOtpDigits(['', '', '', '']);
    setOtpError(false);
    setOtpTimer(120);
    toast('New OTP sent', 'success');
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  };
  const onOtpChange = (idx, val) => {
    const digit = (val.match(/\d/) || [''])[0];
    const next = [...otpDigits];
    next[idx] = digit;
    setOtpDigits(next);
    setOtpError(false);
    if (digit && idx < 3) otpRefs.current[idx + 1]?.focus();
  };
  const onOtpKey = (idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      const next = [...otpDigits];
      next[idx - 1] = '';
      setOtpDigits(next);
      otpRefs.current[idx - 1]?.focus();
    }
  };
  const verifyOTP = async () => {
    if (otpDigits.some(d => d === '')) { toast('Please enter all 4 digits', 'error'); return; }
    if (!profileService.verifyPasswordOtp(otpDigits.join(''))) {
      setOtpError(true);
      toast('Incorrect OTP. Please try again.', 'error');
      return;
    }
    toast('OTP verified!', 'success');
    setPwdStep(3);
  };

  const passRules = {
    len: newPass.length >= 6,
    upper: /[A-Z]/.test(newPass),
    num: /[0-9]/.test(newPass),
    special: /[^A-Za-z0-9]/.test(newPass),
  };
  const passScore = Object.values(passRules).filter(Boolean).length;
  const passLevels = [
    { w: '15%', bg: '#EF4444', label: 'Too weak', color: '#EF4444' },
    { w: '40%', bg: '#F59E0B', label: 'Weak', color: '#F59E0B' },
    { w: '65%', bg: '#F59E0B', label: 'Fair', color: '#F59E0B' },
    { w: '85%', bg: '#22C55E', label: 'Strong', color: '#22C55E' },
    { w: '100%', bg: '#16A34A', label: 'Very strong', color: '#16A34A' },
  ];
  const passLvl = passLevels[Math.max(0, passScore - 1)] || passLevels[0];
  const passMatch = confirmPass !== '' && newPass === confirmPass;
  const passMismatch = confirmPass !== '' && newPass !== confirmPass;

  const [changingPass, setChangingPass] = useState(false);
  const saveNewPassword = async () => {
    if (changingPass) return;
    if (!newPass || newPass.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (newPass !== confirmPass) { toast('Passwords do not match', 'error'); return; }
    setChangingPass(true);
    try {
      await profileService.changePassword(newPass);
    } catch (err) {
      toast(err.message || 'Could not update password', 'error');
      setChangingPass(false);
      return;
    }
    setChangingPass(false);
    toast('Password changed successfully!', 'success');
    setPwdStep(4);
  };

  const saveProfile = async () => {
    if (saving) return;
    if (!form.fullName.trim()) { toast('Full Name is required', 'error'); return; }
    if (!form.phone.trim())    { toast('Contact Number is required', 'error'); return; }

    /* API wants first/last separately — split on the first space. */
    const nameParts = form.fullName.trim().split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName  = nameParts.join(' ');

    setSaving(true);
    try {
      await profileService.updateProfile({
        firstName,
        lastName,
        displayName: form.displayName.trim(),
        email:       form.email.trim(),
        phone:       form.phone.trim(),
        cnic:        form.cnic.trim(),
        imageFile:   avatarFile,   // null → photo unchanged
      });
    } catch (err) {
      toast(err.message || 'Could not update profile', 'error');
      setSaving(false);
      return;
    }
    setSaving(false);

    /* Keep the shell (sidebar/header) in sync with the edited display name. */
    if (typeof sessionStorage !== 'undefined' && form.displayName.trim()) {
      sessionStorage.setItem('displayName', form.displayName.trim());
    }
    setAvatarFile(null);   // uploaded — no longer pending
    toast('Profile saved successfully!', 'success');
    setUnsaved(false);
  };

  const otpMins = Math.floor(otpTimer / 60);
  const otpSecs = String(otpTimer % 60).padStart(2, '0');

  const stepClass = n => {
    if (pwdStep === 4) return 'pwd-step done';
    if (n < pwdStep) return 'pwd-step done';
    if (n === pwdStep) return 'pwd-step active';
    return 'pwd-step';
  };
  const lineDone = n => (pwdStep === 4 || n < pwdStep);

  return (
    <div
      className={`prof-overlay${open ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal={open ? 'true' : undefined}
      aria-labelledby="prof-modal-title"
      aria-hidden={open ? undefined : 'true'}
    >
      <style>{PROF_MOBILE_CSS}</style>
      <div className="prof-modal">
        {/* Header */}
        <div className="prof-modal-header">
          <div className="prof-modal-title-row">
            <div className="prof-modal-icon" aria-hidden="true"><i className="fa-solid fa-user-circle"></i></div>
            <div>
              <div className="prof-modal-title" id="prof-modal-title">My Profile</div>
              <div className="prof-modal-sub">Manage your account details &amp; security</div>
            </div>
          </div>
          <Tooltip text="Close profile">
            <button className="prof-close-btn" onClick={onClose} aria-label="Close profile dialog">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        </div>

        {/* Body */}
        <div className="prof-modal-body">
          {/* LEFT */}
          <div className="prof-left">
            <div className="prof-avatar-card">
              <div className="prof-avatar-wrap">
                {avatarSrc ? (
                  <div className="prof-avatar-img">
                    <img src={avatarSrc} alt="Profile" />
                  </div>
                ) : (
                  <div className="prof-avatar-circle">{initials}</div>
                )}
                <Tooltip text="Click to change profile photo">
                  <button
                    type="button"
                    className="prof-avatar-overlay"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Change profile photo"
                  >
                    <i className="fa-solid fa-camera" aria-hidden="true"></i>
                    <span>Change</span>
                  </button>
                </Tooltip>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <div className="prof-avatar-name" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                {profile?.name || '—'}
              </div>
              <div className="prof-avatar-role">
                <span className="prof-role-badge">
                  <i className="fa-solid fa-shield-halved"></i> {profile?.role || 'Administrator'}
                </span>
              </div>
              <div className="prof-avatar-campus">
                <i className="fa-solid fa-location-dot"></i> {profile?.campus || ''}
              </div>
              <div className="prof-avatar-actions">
                <Tooltip text="Upload a profile photo (JPG, PNG or GIF · Max 2MB)">
                  <button className="prof-pic-btn" onClick={() => fileInputRef.current?.click()}>
                    <i className="fa-solid fa-camera"></i> Upload Photo
                  </button>
                </Tooltip>
                {avatarSrc && (
                  <Tooltip text="Remove current profile photo">
                    <button className="prof-pic-btn prof-pic-btn--remove" onClick={removeAvatar}>
                      <i className="fa-solid fa-trash"></i> Remove
                    </button>
                  </Tooltip>
                )}
              </div>
              <div className="prof-pic-hint">JPG, PNG or GIF · Max 2MB</div>
            </div>

            <div className="prof-stats-card">
              <div className="prof-stat-row">
                <i className="fa-solid fa-calendar-days" style={{ color: 'var(--brand-primary)' }}></i>
                <div>
                  <div className="prof-stat-val">{profile?.memberSince || '—'}</div>
                  <div className="prof-stat-lbl">Member since</div>
                </div>
              </div>
              <div className="prof-stat-row">
                <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--success)' }}></i>
                <div>
                  <div className="prof-stat-val">{profile?.lastLogin || '—'}</div>
                  <div className="prof-stat-lbl">Last login</div>
                </div>
              </div>
              <div className="prof-stat-row">
                <i className="fa-solid fa-building-columns" style={{ color: 'var(--warning)' }}></i>
                <div>
                  <div className="prof-stat-val">{profile?.campus || '—'}</div>
                  <div className="prof-stat-lbl">Active campus</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="prof-right">
            <div className="prof-tabs" role="tablist" aria-label="Profile sections">
              <button
                id="prof-tab-info"
                className={`prof-tab${tab === 'info' ? ' active' : ''}`}
                onClick={() => setTab('info')}
                role="tab"
                aria-selected={tab === 'info'}
                aria-controls="prof-panel-info"
                tabIndex={tab === 'info' ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setTab('password'); }
                  else if (e.key === 'Home') { e.preventDefault(); setTab('info'); }
                  else if (e.key === 'End') { e.preventDefault(); setTab('password'); }
                }}
              >
                <i className="fa-solid fa-user" aria-hidden="true"></i> Personal Info
              </button>
              <button
                id="prof-tab-password"
                className={`prof-tab${tab === 'password' ? ' active' : ''}`}
                onClick={() => setTab('password')}
                role="tab"
                aria-selected={tab === 'password'}
                aria-controls="prof-panel-password"
                tabIndex={tab === 'password' ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setTab('info'); }
                  else if (e.key === 'Home') { e.preventDefault(); setTab('info'); }
                  else if (e.key === 'End') { e.preventDefault(); setTab('password'); }
                }}
              >
                <i className="fa-solid fa-lock" aria-hidden="true"></i> Change Password
              </button>
            </div>

            {/* TAB: Personal Info */}
            {tab === 'info' && (
              <div
                className="prof-tab-panel active"
                role="tabpanel"
                id="prof-panel-info"
                aria-labelledby="prof-tab-info"
                tabIndex={0}
              >
                <div className="prof-section-label">Basic Details</div>
                <div className="prof-form-grid">
                  <div className="prof-form-group">
                    <label className="prof-label">Full Name <span className="req-star">*</span></label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-user prof-input-icon"></i>
                      <input className="prof-input" value={form.fullName} placeholder="Full name" onChange={e => setField('fullName', e.target.value)} />
                    </div>
                  </div>
                  <div className="prof-form-group">
                    <label className="prof-label">Display Name</label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-id-badge prof-input-icon"></i>
                      <input className="prof-input" value={form.displayName} placeholder="Display name" onChange={e => setField('displayName', e.target.value)} />
                    </div>
                  </div>
                  <div className="prof-form-group">
                    <label className="prof-label">Email Address</label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-envelope prof-input-icon"></i>
                      <input className="prof-input" type="email" value={form.email} placeholder="Email" onChange={e => setField('email', e.target.value)} />
                    </div>
                  </div>
                  <div className="prof-form-group">
                    <label className="prof-label">Contact Number <span className="req-star">*</span></label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-phone prof-input-icon"></i>
                      <input className="prof-input" value={form.phone} readOnly disabled style={{ opacity: .6, cursor: 'not-allowed' }} placeholder="+92 3XX XXXXXXX" />
                    </div>
                    <div className="prof-field-hint"><i className="fa-solid fa-circle-info"></i> Registered number — used for OTP verification (cannot be edited)</div>
                  </div>
                  <div className="prof-form-group">
                    <label className="prof-label">Role</label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-shield-halved prof-input-icon"></i>
                      <input className="prof-input" value={profile?.role || ''} readOnly style={{ opacity: .6, cursor: 'not-allowed' }} />
                    </div>
                  </div>
                  <div className="prof-form-group">
                    <label className="prof-label">Campus</label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-building-columns prof-input-icon"></i>
                      <input className="prof-input" value={profile?.campus || ''} readOnly style={{ opacity: .6, cursor: 'not-allowed' }} />
                    </div>
                  </div>
                </div>

                <div className="prof-section-label" style={{ marginTop: 20 }}>Contact &amp; Preferences</div>
                <div className="prof-form-grid">
                  <div className="prof-form-group">
                    <label className="prof-label">CNIC / ID Number</label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-id-card prof-input-icon"></i>
                      <input className="prof-input" value={form.cnic} placeholder="35202-XXXXXXX-X" onChange={e => setField('cnic', e.target.value)} />
                    </div>
                  </div>
                  <div className="prof-form-group">
                    <label className="prof-label">Language</label>
                    <div className="prof-input-wrap">
                      <i className="fa-solid fa-globe prof-input-icon"></i>
                      <select className="prof-input" disabled style={{ appearance: 'none', paddingLeft: 36, opacity: .6, cursor: 'not-allowed' }} value={form.language} onChange={e => setField('language', e.target.value)}>
                        <option>English (UK)</option>
                        <option>Urdu</option>
                        <option>English (US)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="prof-footer-row">
                  {unsaved && (
                    <div className="prof-unsaved">
                      <div className="autosave-dot"></div>
                      Unsaved changes
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                    <Tooltip text="Discard changes and close">
                      <button className="prof-btn prof-btn--ghost" onClick={onClose}>Cancel</button>
                    </Tooltip>
                    <Tooltip text="Save changes to your profile">
                      <button
                        className="prof-btn prof-btn--primary"
                        onClick={saveProfile}
                        disabled={saving}
                        style={saving ? { opacity: .6, cursor: 'not-allowed' } : undefined}
                      >
                        <i className={`fa-solid ${saving ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Change Password */}
            {tab === 'password' && (
              <div
                className="prof-tab-panel active"
                role="tabpanel"
                id="prof-panel-password"
                aria-labelledby="prof-tab-password"
                tabIndex={0}
              >
                <div
                  className="pwd-steps"
                  role="group"
                  aria-label={`Password change — step ${pwdStep === 4 ? 'complete' : pwdStep} of 3`}
                >
                  <div className={stepClass(1)}>
                    <div className="pwd-step-num">1</div>
                    <div className="pwd-step-label">Verify Identity</div>
                  </div>
                  <div className={`pwd-step-line${lineDone(1) ? ' done' : ''}`}></div>
                  <div className={stepClass(2)}>
                    <div className="pwd-step-num">2</div>
                    <div className="pwd-step-label">Enter OTP</div>
                  </div>
                  <div className={`pwd-step-line${lineDone(2) ? ' done' : ''}`}></div>
                  <div className={stepClass(3)}>
                    <div className="pwd-step-num">3</div>
                    <div className="pwd-step-label">New Password</div>
                  </div>
                </div>

                {/* STEP 1 */}
                {pwdStep === 1 && (
                  <div className="pwd-panel">
                    <div className="pwd-panel-icon" style={{ background: 'rgba(30,58,138,.08)', color: '#1E40AF' }}>
                      <i className="fa-solid fa-mobile-screen-button"></i>
                    </div>
                    <div className="pwd-panel-title">Verify Your Identity</div>
                    <div className="pwd-panel-sub">
                      We'll send a 4-digit OTP to your registered contact number to confirm it's you.
                    </div>
                    <div className="prof-form-group" style={{ textAlign: 'left', marginTop: 18, width: '100%', maxWidth: 340 }}>
                      <label className="prof-label">Contact Number</label>
                      <div className="prof-input-wrap">
                        <i className="fa-solid fa-phone prof-input-icon"></i>
                        <input
                          className="prof-input"
                          value={otpPhone}
                          readOnly
                          disabled
                          style={{ opacity: .6, cursor: 'not-allowed' }}
                          placeholder="No number on file"
                        />
                      </div>
                      <div className="prof-field-hint"><i className="fa-solid fa-lock"></i> Your registered number from Personal Info — OTP is sent here</div>
                    </div>
                    <Tooltip text="Send a one-time code to this phone number">
                      <button className="pwd-action-btn" onClick={sendOTP}>
                        <i className="fa-solid fa-paper-plane"></i> Send OTP
                      </button>
                    </Tooltip>
                  </div>
                )}

                {/* STEP 2 */}
                {pwdStep === 2 && (
                  <div className="pwd-panel">
                    <div className="pwd-panel-icon" style={{ background: 'rgba(22,163,74,.08)', color: '#16A34A' }}>
                      <i className="fa-solid fa-shield-halved"></i>
                    </div>
                    <div className="pwd-panel-title">Enter OTP</div>
                    <div className="pwd-panel-sub">
                      A 4-digit code was sent to <strong>{otpSentTo}</strong>
                    </div>
                    <div className="otp-boxes" role="group" aria-label="One-time password — 4 digits">
                      {otpDigits.map((d, i) => (
                        <input
                          key={i}
                          ref={el => (otpRefs.current[i] = el)}
                          className={`otp-box${d ? ' filled' : ''}${otpError ? ' error' : ''}`}
                          maxLength={1}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          aria-label={`OTP digit ${i + 1} of 4`}
                          aria-invalid={otpError || undefined}
                          value={d}
                          onChange={e => onOtpChange(i, e.target.value)}
                          onKeyDown={e => onOtpKey(i, e)}
                        />
                      ))}
                    </div>
                    <div className="otp-timer-row">
                      <span className="otp-timer-txt">
                        Code expires in <strong>{otpMins}:{otpSecs}</strong>
                      </span>
                      <Tooltip text={otpTimer > 0 ? 'Wait for the timer to resend' : 'Resend OTP'}>
                        <button className="otp-resend-btn" disabled={otpTimer > 0} onClick={resendOTP}>
                          Resend
                        </button>
                      </Tooltip>
                    </div>
                    {otpError && (
                      <div className="otp-error" role="alert">
                        <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Incorrect OTP. Please try again.
                      </div>
                    )}
                    <Tooltip text="Verify the entered OTP">
                      <button className="pwd-action-btn" onClick={verifyOTP}>
                        <i className="fa-solid fa-check-circle"></i> Verify OTP
                      </button>
                    </Tooltip>
                    <Tooltip text="Go back and change the phone number">
                      <button className="pwd-back-btn" onClick={() => setPwdStep(1)}>
                        <i className="fa-solid fa-arrow-left"></i> Change number
                      </button>
                    </Tooltip>
                  </div>
                )}

                {/* STEP 3 */}
                {pwdStep === 3 && (
                  <div className="pwd-panel">
                    <div className="pwd-panel-icon" style={{ background: 'rgba(22,163,74,.08)', color: '#16A34A' }}>
                      <i className="fa-solid fa-check-circle"></i>
                    </div>
                    <div className="pwd-panel-title">Set New Password</div>
                    <div className="pwd-panel-sub">
                      OTP verified! Choose a strong new password for your account.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18, textAlign: 'left', width: '100%' }}>
                      <div className="prof-form-group">
                        <label className="prof-label">New Password <span className="req-star">*</span></label>
                        <div className="prof-input-wrap">
                          <i className="fa-solid fa-lock prof-input-icon"></i>
                          <input
                            className="prof-input"
                            type={showNewPass ? 'text' : 'password'}
                            value={newPass}
                            onChange={e => setNewPass(e.target.value)}
                            placeholder="Min 6 characters"
                          />
                          <Tooltip text={showNewPass ? 'Hide password' : 'Show password'}>
                            <button
                              className="prof-eye-btn"
                              type="button"
                              onClick={() => setShowNewPass(s => !s)}
                              aria-pressed={showNewPass}
                              aria-label={showNewPass ? 'Hide new password' : 'Show new password'}
                            >
                              <i className={`fa-solid ${showNewPass ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                        </div>
                        {newPass && (
                          <>
                            <div className="pass-strength-bar" aria-hidden="true">
                              <div className="pass-strength-fill" style={{ width: passLvl.w, background: passLvl.bg }}></div>
                            </div>
                            <div className="pass-strength-txt" style={{ color: passLvl.color }} aria-live="polite">
                              Password strength: {passLvl.label}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="prof-form-group">
                        <label className="prof-label">Confirm Password <span className="req-star">*</span></label>
                        <div className="prof-input-wrap">
                          <i className="fa-solid fa-lock prof-input-icon"></i>
                          <input
                            className="prof-input"
                            type={showConfirmPass ? 'text' : 'password'}
                            value={confirmPass}
                            onChange={e => setConfirmPass(e.target.value)}
                            placeholder="Re-enter password"
                          />
                          <Tooltip text={showConfirmPass ? 'Hide password' : 'Show password'}>
                            <button
                              className="prof-eye-btn"
                              type="button"
                              onClick={() => setShowConfirmPass(s => !s)}
                              aria-pressed={showConfirmPass}
                              aria-label={showConfirmPass ? 'Hide password confirmation' : 'Show password confirmation'}
                            >
                              <i className={`fa-solid ${showConfirmPass ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                            </button>
                          </Tooltip>
                        </div>
                        {passMatch && <div className="pass-match-msg ok" role="status" aria-live="polite">✓ Passwords match</div>}
                        {passMismatch && <div className="pass-match-msg err" role="status" aria-live="polite">✗ Passwords do not match</div>}
                      </div>

                      <div className="pass-rules">
                        <div className={`pass-rule${passRules.len ? ' ok' : ''}`}>
                          <i className={`fa-solid ${passRules.len ? 'fa-circle-check' : 'fa-circle'}`}></i> At least 6 characters
                        </div>
                        <div className={`pass-rule${passRules.upper ? ' ok' : ''}`}>
                          <i className={`fa-solid ${passRules.upper ? 'fa-circle-check' : 'fa-circle'}`}></i> One uppercase letter
                        </div>
                        <div className={`pass-rule${passRules.num ? ' ok' : ''}`}>
                          <i className={`fa-solid ${passRules.num ? 'fa-circle-check' : 'fa-circle'}`}></i> One number
                        </div>
                        <div className={`pass-rule${passRules.special ? ' ok' : ''}`}>
                          <i className={`fa-solid ${passRules.special ? 'fa-circle-check' : 'fa-circle'}`}></i> One special character
                        </div>
                      </div>
                    </div>
                    <Tooltip text="Save your new password">
                      <button
                        className="pwd-action-btn"
                        onClick={saveNewPassword}
                        disabled={changingPass}
                        style={{ marginTop: 20, ...(changingPass ? { opacity: .6, cursor: 'not-allowed' } : {}) }}
                      >
                        <i className={`fa-solid ${changingPass ? 'fa-spinner fa-spin' : 'fa-shield-halved'}`}></i> {changingPass ? 'Updating…' : 'Update Password'}
                      </button>
                    </Tooltip>
                    <Tooltip text="Go back to OTP entry">
                      <button className="pwd-back-btn" onClick={() => setPwdStep(2)}>
                        <i className="fa-solid fa-arrow-left"></i> Back
                      </button>
                    </Tooltip>
                  </div>
                )}

                {/* STEP 4 */}
                {pwdStep === 4 && (
                  <div className="pwd-panel" role="status" aria-live="polite">
                    <div className="pwd-success-anim" aria-hidden="true">
                      <i className="fa-solid fa-check"></i>
                    </div>
                    <div className="pwd-panel-title">Password Updated!</div>
                    <div className="pwd-panel-sub">
                      Your password has been changed successfully. You'll use your new password on the next login.
                    </div>
                    <button className="pwd-action-btn" onClick={onClose} style={{ marginTop: 20 }}>
                      <i className="fa-solid fa-home" aria-hidden="true"></i> Back to Dashboard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Mobile responsive overrides — base prof-* CSS lives in App.js. This
   block tightens the modal on phones (≤600px) without touching the
   shared shell stylesheet.
   ═══════════════════════════════════════════════════════════════════ */
const PROF_MOBILE_CSS = `
@media (max-width: 600px) {
  /* Overlay padding so modal isn't flush to screen edges */
  .prof-overlay { padding: 8px; align-items: flex-start; overflow-y: auto; }
  .prof-modal {
    width: 100%;
    max-width: 100%;
    max-height: calc(100vh - 16px);
    border-radius: 14px;
    margin: 0;
  }

  /* Header — stack title-row + close */
  .prof-modal-header {
    padding: 14px 14px;
    gap: 8px;
    flex-wrap: wrap;
  }
  .prof-modal-title-row { gap: 10px; min-width: 0; flex: 1; }
  .prof-modal-icon { width: 36px; height: 36px; font-size: 18px; }
  .prof-modal-title { font-size: 15px; }
  .prof-modal-sub  { font-size: 11px; }

  /* Body grid → single column (left avatar card first, form below) */
  .prof-modal-body {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .prof-left,
  .prof-right { padding: 14px; }
  .prof-left { border-right: none; border-bottom: 1px solid var(--border-light, #E2E8F0); }

  /* Avatar card — keep centered, tighten */
  .prof-avatar-card { gap: 4px; }
  .prof-avatar-wrap,
  .prof-avatar-img,
  .prof-avatar-circle { width: 72px; height: 72px; }
  .prof-avatar-circle { font-size: 22px; }
  .prof-avatar-actions { width: 100%; }
  .prof-pic-btn { width: 100%; justify-content: center; }

  /* Tabs row — horizontal scroll so all 3 tabs stay reachable */
  .prof-tabs {
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
    -ms-overflow-style: none;
    gap: 6px;
    padding: 6px;
  }
  .prof-tabs::-webkit-scrollbar { display: none; }
  .prof-tab {
    flex: 0 0 auto;
    white-space: nowrap;
    padding: 8px 12px;
    font-size: 12px;
  }

  /* Form grid → 1-col */
  .prof-form-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .prof-section-label { font-size: 11px; }
  .prof-label { font-size: 11.5px; }
  .prof-input { font-size: 13px; }

  /* Footer action row — buttons full width */
  .prof-footer-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px;
  }
  .prof-footer-row > * { width: 100%; }
  .prof-footer-row .prof-btn {
    width: 100%;
    justify-content: center;
    height: 40px;
  }
  .prof-unsaved { justify-content: flex-start; }

  /* Password panel + OTP boxes */
  .pwd-steps { gap: 6px; }
  .pwd-step-label { font-size: 10px; }
  .pwd-panel { padding: 18px 14px; }
  .pwd-panel-title { font-size: 15px; }
  .pwd-panel-sub { font-size: 12px; }
  .otp-boxes { gap: 8px; }
  .otp-box { width: 44px; height: 50px; font-size: 20px; }
  .pwd-action-btn { width: 100%; justify-content: center; }
}
@media (max-width: 420px) {
  .prof-modal-title { font-size: 14px; }
  .otp-box { width: 38px; height: 46px; font-size: 18px; }
}
`;
