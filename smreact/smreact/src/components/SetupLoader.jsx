import React from 'react';

/* ═══════════════════════════════════════════════════════════════════
   SETUP LOADER — Launch Setup ka wahid "abhi aa raha hai" indicator.

   Do jagah lagta hai:
     • App.js — jab tak user ki permissions nahi aatin (warna ek pal ke
       liye SAARE setup tabs dikh jate the, phir sirf granted wala reh
       jata tha).
     • Har setup tab — jab tak uska apna data API se nahi aa jata
       (warna initialData ka khali placeholder row "dummy data" ki
       tarah dikhta tha).

   Yani screen par ya to loader hota hai, ya asli data — beech me na
   ghost rows hain na un tabs ki jhalak jo mile hi nahi.
   ═══════════════════════════════════════════════════════════════════ */

export default function SetupLoader({ label = 'Loading…', minHeight = 220 }) {
  return (
    <>
      <style>{SETUP_LOADER_CSS}</style>
      <div className="setup-loader" style={{ minHeight }} role="status" aria-live="polite">
        <span className="setup-loader-ring" aria-hidden="true" />
        <span className="setup-loader-lbl">{label}</span>
      </div>
    </>
  );
}

const SETUP_LOADER_CSS = `
@keyframes setupLoaderSpin { to { transform: rotate(360deg); } }
.setup-loader {
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;
  padding:36px 20px;
  background:var(--bg-card,#fff); border:1px solid var(--border-light,#E2E8F0);
  border-radius:14px;
}
.setup-loader-ring {
  width:30px; height:30px; border-radius:50%;
  border:3px solid var(--border-light,#E2E8F0);
  border-top-color:var(--brand-primary,#1E40AF);
  animation:setupLoaderSpin .8s linear infinite;
}
.setup-loader-lbl { font-size:13px; font-weight:600; color:var(--text-secondary,#64748B); }
`;
