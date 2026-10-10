// ══════════════════════════════════════════════════════════════════
//  Activity window — ek halka sa "abhi poll karna chahiye ya nahi" switch.
//
//  Chat / Support ke poll (setInterval) hamesha chalte thay — login ke baad
//  poore ERP me har waqt API calls jati rehti thin. Ab har poll is window se
//  poochta hai: active() false ho to tick kuch nahi karta (koi API call nahi).
//
//  - open(ms)  → window ko abhi se `ms` tak khol do (purana waqt bhula kar).
//  - ping(ms)  → "abhi ek message hua" — window ko now+ms tak barha do
//                (sirf tab jab ye pehle se tay waqt se aage ho). Har message
//                (bhejni ho ya aane wali) par call hota hai → 2 min reset.
//  - active()  → kya window abhi khuli hai?
//
//  React state nahi — timestamp ref. Is liye ispar re-render nahi hote; poll
//  tick seedha active() parh leta hai.
// ══════════════════════════════════════════════════════════════════

export function createActivityWindow() {
  let until = 0; // epoch ms — is waqt tak window khuli hai

  return {
    /** Window ko abhi se `ms` tak khol do (naye sire se). */
    open(ms) { until = Date.now() + Number(ms || 0); },
    /** Aakhri message ke baad `ms` tak barha do (sirf aage ki taraf). */
    ping(ms) {
      const next = Date.now() + Number(ms || 0);
      if (next > until) until = next;
    },
    /** Window abhi khuli hai? */
    active() { return Date.now() < until; },
    /** Kitni der (ms) aur khuli rahegi. */
    remaining() { return Math.max(0, until - Date.now()); },
    /** Foran band kar do. */
    close() { until = 0; },
  };
}
