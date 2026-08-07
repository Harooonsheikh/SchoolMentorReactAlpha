/* ═══════════════════════════════════════════════════════════════════
   SUPER ADMIN — sign-in screen styles

   Same design language as the school ERP's auth screen (src/styles/auth.css
   in the main app): a split page with a deep-blue story panel on the left and
   a white form card on the right. Tokens are copied from saStyles.js so the
   login and the shell stay visually identical, including dark mode — the
   `data-theme="dark"` attribute is set on the same `.sa-auth` wrapper.

   Everything is scoped under `.sa-auth` so it cannot leak into the shell.
   ═══════════════════════════════════════════════════════════════════ */

export const SA_AUTH_CSS = `
.sa-auth{
  --brand:#1E3A8A; --brand-mid:#2563EB; --brand-dark:#1E40AF; --brand-light:#DBEAFE;
  --bg:#F0F4FF; --card:#FFFFFF; --muted:#EFF6FF; --inp:#FFFFFF;
  --t1:#0F172A; --t2:#1E3A5F; --tm:#64748B;
  --success:#16A34A; --warn:#D97706; --err:#DC2626; --info:#0284C7;
  --bl:#BFDBFE; --bm:#93C5FD;
  --s-sm:0 2px 6px rgba(30,58,138,.18),0 1px 2px rgba(0,0,0,.05);
  --s-md:0 4px 14px rgba(30,58,138,.20);
  --s-lg:0 10px 30px rgba(30,58,138,.22),0 4px 8px rgba(0,0,0,.07);
  --r-sm:6px; --r-md:10px; --r-lg:14px; --r-xl:20px; --r-f:9999px;
  --font:'Plus Jakarta Sans',sans-serif;
  --tr:all .2s cubic-bezier(.4,0,.2,1);

  font-family:var(--font);
  color:var(--t1);
  background:var(--bg);
  min-height:100vh;
  display:grid;
  grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);
  overflow-x:hidden;
  -webkit-font-smoothing:antialiased;
}
.sa-auth[data-theme="dark"]{
  --bg:#080D1A; --card:#0E1628; --muted:#131F38; --inp:#0E1628;
  --t1:#E2E8F8; --t2:#B8C8E8; --tm:#6B82A8;
  --brand:#3B82F6; --brand-mid:#3B82F6; --brand-light:#1E3A6A;
  --bl:#1C2E50; --bm:#243858;
}
.sa-auth *,.sa-auth *::before,.sa-auth *::after{box-sizing:border-box;margin:0;padding:0}
.sa-auth button{font-family:var(--font);cursor:pointer}
.sa-auth input{font-family:var(--font)}
.sa-auth a{color:inherit}

@media (max-width:980px){
  .sa-auth{grid-template-columns:1fr}
}
@media (prefers-reduced-motion:reduce){
  .sa-auth *,.sa-auth *::before,.sa-auth *::after{
    animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}
}

/* ═════════ LEFT — STORY PANEL ═════════ */
.sa-auth .sa-story{
  position:relative;
  background:
    radial-gradient(760px 560px at 8% -8%, rgba(255,255,255,.10), transparent 60%),
    radial-gradient(700px 620px at 100% 100%, rgba(37,99,235,.55), transparent 55%),
    linear-gradient(160deg,#142B6E 0%,#1E3A8A 42%,#1D4ED8 100%);
  color:#fff;
  padding:30px 48px 24px;
  display:flex;
  flex-direction:column;
  overflow:hidden;
  min-height:100vh;
}
.sa-auth[data-theme="dark"] .sa-story{
  background:
    radial-gradient(760px 560px at 8% -8%, rgba(255,255,255,.06), transparent 60%),
    radial-gradient(700px 620px at 100% 100%, rgba(37,99,235,.30), transparent 55%),
    linear-gradient(160deg,#060B16 0%,#0D1B3E 45%,#14275C 100%);
}
@media (max-width:980px){
  .sa-auth .sa-story{padding:34px 24px 30px;min-height:0}
}
/* faint grid, masked so it fades out toward the edges */
.sa-auth .sa-story::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background-image:
    linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);
  background-size:42px 42px;
  -webkit-mask-image:radial-gradient(ellipse 900px 700px at 30% 20%,#000 0%,transparent 70%);
  mask-image:radial-gradient(ellipse 900px 700px at 30% 20%,#000 0%,transparent 70%);
}
.sa-auth .sa-blob{position:absolute;border-radius:50%;filter:blur(2px);pointer-events:none}
.sa-auth .sa-blob-1{
  width:340px;height:340px;right:-90px;top:-100px;
  background:radial-gradient(circle at 30% 30%,rgba(255,255,255,.16),rgba(255,255,255,0) 70%);
  animation:saBlob 14s ease-in-out infinite;
}
.sa-auth .sa-blob-2{
  width:260px;height:260px;left:-70px;bottom:6%;
  background:radial-gradient(circle at 30% 30%,rgba(147,197,253,.22),rgba(255,255,255,0) 70%);
  animation:saBlob 18s ease-in-out infinite reverse;
}
@keyframes saBlob{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-14px,18px) scale(1.06)}}
.sa-auth .sa-spark{
  position:absolute;font-size:15px;color:rgba(255,255,255,.16);pointer-events:none;
  animation:saFloat 9s ease-in-out infinite;
}
@keyframes saFloat{0%,100%{transform:translateY(0);opacity:.16}50%{transform:translateY(-14px);opacity:.34}}

.sa-auth .sa-story-in{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;gap:26px}

/* ── brand lockup (real logo + text wordmark) ──
   Same construction as the ERP auth screen: the mark is the SchoolMentor
   graduation-cap PNG, the wordmark is live text so it stays sharp at any size.
   On the blue story panel the lockup sits in a white badge (the logo is a blue
   gradient and would disappear against the panel); on the form card it sits
   directly on the background. */
.sa-auth .sa-lockup{display:inline-flex;align-items:center;gap:11px}
.sa-auth .sa-brand-icon{display:block;height:38px;width:auto;flex:none}
.sa-auth .sa-lockup-txt{display:flex;flex-direction:column;justify-content:center;line-height:1}
.sa-auth .sa-lockup-name{font-size:16px;letter-spacing:-.02em;white-space:nowrap;color:#1F2937}
.sa-auth .sa-lockup-name b{font-weight:800}
.sa-auth .sa-lockup-name span{font-weight:500;color:#6B7280}
.sa-auth .sa-lockup-tag{
  margin-top:4px;font-size:8.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  white-space:nowrap;color:var(--brand-mid);
}

/* left panel: white badge so the logo reads against the dark blue */
.sa-auth .sa-logo-badge{
  display:inline-flex;align-items:center;gap:9px;align-self:flex-start;
  background:#fff;border-radius:var(--r-md);padding:7px 13px;
  box-shadow:0 6px 18px rgba(0,0,0,.18);
}
.sa-auth .sa-logo-badge .sa-brand-icon{height:30px}
.sa-auth .sa-logo-badge .sa-lockup-name{font-size:13.5px}
.sa-auth .sa-logo-badge .sa-lockup-tag{font-size:7px;margin-top:3px;color:#1E40AF}

/* hero */
.sa-auth .sa-eyebrow{
  display:inline-flex;align-items:center;gap:8px;align-self:flex-start;
  padding:6px 13px;border-radius:var(--r-f);
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.20);
  font-size:11px;font-weight:700;letter-spacing:.3px;
}
.sa-auth .sa-eyebrow i{font-size:8px;color:#4ADE80}
.sa-auth .sa-headline{
  font-size:clamp(26px,2.6vw,36px);font-weight:800;line-height:1.16;letter-spacing:-.02em;margin-top:14px;
}
.sa-auth .sa-hl{
  background:linear-gradient(90deg,#BFDBFE,#93C5FD);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
}
.sa-auth .sa-sub{font-size:13.5px;line-height:1.65;opacity:.82;margin-top:12px;max-width:52ch}

/* capability rail */
.sa-auth .sa-rail-head{
  font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;opacity:.6;margin-bottom:14px;
}
.sa-auth .sa-rail{position:relative;padding-left:6px;display:flex;flex-direction:column;gap:18px}
.sa-auth .sa-rail-line{position:absolute;left:22px;top:12px;bottom:12px;width:2px;background:rgba(255,255,255,.14);border-radius:2px}
.sa-auth .sa-item{display:flex;gap:15px;position:relative}
.sa-auth .sa-node{
  width:38px;height:38px;border-radius:11px;flex-shrink:0;z-index:1;
  display:flex;align-items:center;justify-content:center;font-size:14px;
  background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);
  backdrop-filter:blur(4px);
}
.sa-auth .sa-item-title{font-size:13.5px;font-weight:700}
.sa-auth .sa-item-desc{font-size:12px;line-height:1.55;opacity:.72;margin-top:3px;max-width:46ch}
.sa-auth .sa-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.sa-auth .sa-chips span{
  font-size:10px;font-weight:600;padding:3px 9px;border-radius:var(--r-f);
  background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);
}

/* footer note */
.sa-auth .sa-story-foot{
  margin-top:auto;padding-top:20px;border-top:1px solid rgba(255,255,255,.14);
  display:flex;align-items:center;gap:11px;font-size:11.5px;opacity:.76;line-height:1.5;
}
.sa-auth .sa-story-foot i{font-size:13px;opacity:.9}

/* ═════════ RIGHT — FORM PANEL ═════════ */
.sa-auth .sa-formside{
  display:flex;align-items:center;justify-content:center;position:relative;
  padding:40px 32px;
  background:radial-gradient(560px 420px at 90% -10%,rgba(37,99,235,.06),transparent 60%),var(--bg);
}
.sa-auth .sa-card{width:100%;max-width:430px;opacity:0;animation:saFadeUp .6s .15s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes saFadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

/* theme toggle, mirrors the shell's topbar button */
.sa-auth .sa-theme-btn{
  position:absolute;top:22px;right:24px;
  width:36px;height:36px;border-radius:var(--r-f);
  border:1.5px solid var(--bl);background:var(--card);color:var(--tm);
  display:flex;align-items:center;justify-content:center;font-size:14px;transition:var(--tr);
}
.sa-auth .sa-theme-btn:hover{border-color:var(--brand-mid);color:var(--brand-mid)}

.sa-auth .sa-card-badge{display:inline-flex;gap:13px;margin-bottom:24px}
.sa-auth .sa-card-badge .sa-brand-icon{height:52px}
.sa-auth .sa-card-badge .sa-lockup-name{font-size:21px}
.sa-auth .sa-card-badge .sa-lockup-tag{font-size:10px;letter-spacing:.16em}
/* the card sits on --card, so the wordmark follows the theme here */
.sa-auth .sa-card .sa-lockup-name{color:var(--t1)}
.sa-auth .sa-card .sa-lockup-name span{color:var(--tm)}

.sa-auth .sa-welcome-title{font-size:27px;font-weight:800;letter-spacing:-.01em;color:var(--t1)}
.sa-auth .sa-welcome-sub{font-size:13.5px;color:var(--tm);margin-top:7px;line-height:1.55}
.sa-auth .sa-form{margin-top:26px}

/* error box */
.sa-auth .sa-err-box{
  display:flex;align-items:flex-start;gap:9px;
  background:rgba(220,38,38,.07);border:1px solid rgba(220,38,38,.28);color:var(--err);
  border-radius:var(--r-md);padding:11px 13px;font-size:12.5px;font-weight:600;line-height:1.5;
  margin-bottom:18px;animation:saShake .3s cubic-bezier(.36,.07,.19,.97);
}
.sa-auth .sa-err-box i{font-size:13px;margin-top:1px;flex-shrink:0}
@keyframes saShake{10%,90%{transform:translateX(-1px)}30%,70%{transform:translateX(2px)}50%{transform:translateX(-2px)}}

/* fields */
.sa-auth .sa-label{display:block;font-size:12.5px;font-weight:700;color:var(--t2);letter-spacing:.2px;margin-bottom:7px}
.sa-auth .sa-input-wrap{position:relative;display:flex;align-items:center;margin-bottom:16px}
.sa-auth .sa-input-icon{
  position:absolute;left:15px;top:50%;transform:translateY(-50%);
  color:var(--tm);font-size:14px;pointer-events:none;transition:var(--tr);display:flex;
}
.sa-auth .sa-input{
  width:100%;height:46px;
  border:1.5px solid var(--bl);border-radius:var(--r-md);
  background:var(--inp);padding:0 44px;
  font-size:14px;color:var(--t1);outline:none;transition:var(--tr);
}
.sa-auth .sa-input::placeholder{color:#A9BBD6}
.sa-auth[data-theme="dark"] .sa-input::placeholder{color:#4A5F85}
.sa-auth .sa-input:focus{border-color:var(--brand-mid);box-shadow:0 0 0 4px rgba(37,99,235,.12)}
.sa-auth .sa-input-wrap:focus-within .sa-input-icon{color:var(--brand-mid)}
.sa-auth .sa-input:disabled{background:var(--muted);color:var(--tm);cursor:not-allowed}
.sa-auth .sa-eye-btn{
  position:absolute;right:13px;top:50%;transform:translateY(-50%);
  background:none;border:none;color:var(--tm);font-size:14px;padding:4px;display:flex;transition:var(--tr);
}
.sa-auth .sa-eye-btn:hover{color:var(--brand-mid)}

.sa-auth .sa-form-meta{display:flex;align-items:center;justify-content:space-between;margin:-2px 0 20px}
.sa-auth .sa-remember{display:flex;align-items:center;gap:7px;font-size:12.5px;color:var(--tm);font-weight:500;cursor:pointer}
.sa-auth .sa-remember input{accent-color:var(--brand-mid);cursor:pointer}
.sa-auth .sa-forgot{font-size:12.5px;font-weight:700;color:var(--brand-mid);background:none;border:none;padding:0}
.sa-auth .sa-forgot:hover{text-decoration:underline}

/* primary button */
.sa-auth .sa-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:9px;
  width:100%;height:47px;border:none;border-radius:var(--r-md);
  font-size:14px;font-weight:700;color:#fff;transition:var(--tr);
  background:linear-gradient(135deg,#1E40AF,#1E3A8A);
  box-shadow:0 4px 14px rgba(30,58,138,.28);
}
.sa-auth .sa-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 22px rgba(30,58,138,.38)}
.sa-auth .sa-btn:active:not(:disabled){transform:translateY(0)}
.sa-auth .sa-btn:disabled{opacity:.7;cursor:not-allowed;box-shadow:none}
.sa-auth .sa-btn i{transition:transform .25s ease}
.sa-auth .sa-btn:hover:not(:disabled) i.fa-arrow-right{transform:translateX(3px)}
.sa-auth .sa-spin{animation:saSpin .8s linear infinite}
@keyframes saSpin{to{transform:rotate(360deg)}}

/* security notice */
.sa-auth .sa-secure{
  display:flex;align-items:flex-start;gap:10px;margin-top:22px;
  background:var(--muted);border:1px solid var(--bl);border-radius:var(--r-md);
  padding:12px 14px;font-size:12px;color:var(--t2);line-height:1.55;
}
.sa-auth .sa-secure i{color:var(--success);font-size:13px;margin-top:1px;flex-shrink:0}
.sa-auth .sa-foot-note{font-size:11.5px;color:var(--tm);text-align:center;margin-top:20px;line-height:1.6}
`;

export default SA_AUTH_CSS;
