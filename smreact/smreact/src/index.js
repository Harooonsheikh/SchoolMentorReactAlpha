import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

/* ─── Cross-app logout (FROM the Chain Portal) ───
   Chain portal se logout hone par wo ERP ko `#logout` ke sath yahan bhejta hai
   (dono alag origin → aik doosre ki storage seedhe nahi chhoo sakte). ERP apna
   session clear kar ke login screen dikha deta hai. #sm handoff se PEHLE chalna
   chahiye taake logout ko galti se handoff na samjha jaye. */
;(() => {
  if (!/[#&]logout(\b|=)/.test(window.location.hash)) return;
  try { sessionStorage.clear(); } catch (e) { /* noop */ }
  try { window.history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* noop */ }
})();

/* ─── Session handoff FROM the Chain Portal "Switch to View" ───
   Chain portal (alag origin: dev :3002, prod chain.schoolmentor.ai) network
   session + target branchID ko URL ke HASH me bhejta hai: #sm=<encoded json>.
   Hash server ko nahi jata; ise React mount se PEHLE padh kar sessionStorage me
   daal dete hain aur URL se turant hata dete hain (token address bar/history me
   na rahe). Ye ERP ka "handoff-in" hai — ERP se chain ki taraf jaane wale
   handoff ka ulta (dekhein LoginScreen ka CHAIN_DASHBOARD_URL redirect).

   • token network ka hi hota hai — wahi token branch ke ERP reads ke liye chalta
     hai (chain portal khud isi token se har school ka branch data padhta hai).
   • net_accountType='network' → ERP View-Only mode (dekhein apiConfig
     isViewOnlyAccount + ViewOnlyGuard): chain admin school ka data dekh sakta
     hai magar likh/badal nahi sakta — chain portal ka "View Only Mode" wahi.
   • sm_from_chain='1' → Dashboard par "Back to Chain" button (sirf chain se
     aaye hue ko dikhta hai, seedhe login karne wale school head ko nahi).
   • launchSetup='1' → ERP seedha khule (Launch Setup skip). */
;(() => {
  const hash = window.location.hash;
  const m = /[#&]sm=([^&]+)/.exec(hash);
  try {
    if (!m) return;
    const p = JSON.parse(decodeURIComponent(m[1]));
    if (p && p.token && p.branchID) {
      /* Pichhle school-login ka bacha session pehle saaf — warna nayi branch ke
         sath purani keys mix ho jati hain. */
      ['token', 'branchID', 'UserID', 'employee_ID', 'accountType', 'displayName',
        'userName', 'launchSetup', 'sm_chain_branch', 'moduleState',
      ].forEach((k) => { try { sessionStorage.removeItem(k); } catch (e) { /* noop */ } });

      sessionStorage.setItem('token', p.token);
      sessionStorage.setItem('branchID', String(p.branchID));
      sessionStorage.setItem('launchSetup', '1');
      sessionStorage.setItem('net_accountType', 'network');   // → View-Only
      sessionStorage.setItem('sm_from_chain', '1');           // → Back to Chain button
      if (p.accountType) sessionStorage.setItem('accountType', p.accountType);
      if (p.displayName) sessionStorage.setItem('displayName', p.displayName);
      if (p.userName)    sessionStorage.setItem('userName', p.userName);
      if (p.id != null)  sessionStorage.setItem('UserID', String(p.id));
      if (p.employee_ID) sessionStorage.setItem('employee_ID', String(p.employee_ID));
    }
  } catch (e) {
    /* malformed handoff — chhod do, ERP apna login screen dikha dega */
  } finally {
    /* URL har soorat me saaf — token address bar/history me na bache. */
    if (m) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
})();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
