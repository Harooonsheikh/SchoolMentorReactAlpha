import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PAY_SCHOOLS, INITIAL_PAY_SETUP, RECEIVING_METHODS,
  monthlyCharge, pkr, kfmt, fmtDateLong, fmtDateShort, todayISO, deriveRow, trialInfo,
} from './paymentData';
import { paymentsApi, schoolProgressApi, schoolPermissionsApi } from './api';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOLS PAYMENT (Payment Status) — Super Admin module

   Four tabs: Payment Setup · Challans · Receiving · Reports.
   Setup defines a billing formula per school; challans bill it; receiving
   records payments; reports roll everything up (summary / outstanding /
   received / challan) with PDF export.

   Teeno tabs LIVE hain (AHM_School_Payments — see api/services/payments), aur
   har tab SIRF apni API chalata hai — mount par chaaron nahi:
     • mount         → branch directory (branch-report) hi
     • Payment Setup → GET /summary?branchId=&type= (per branch) → payStore;
       Set Up / Edit ka Save → POST /manage (ADD pehli baar, phir UPDATE)
     • Challans      → /manage_payment_ledger, action GET; Generate / Delete
       usi route par ADD | UPDATE | DELETE
     • Receiving     → /manage_payment_receiving, action GET; Add Payment /
       Delete usi route par ADD | UPDATE | DELETE
     • Reports       → apna endpoint nahi; challan + receiving stores se banti
   API na chale to bundled demo rows (see ./paymentData).
   ═══════════════════════════════════════════════════════════════════ */

/* ── Challan ka mahina ────────────────────────────────────────────────
   ERP ke fee challans ka wahi usool: har challan EK mahine ka hota hai,
   aur list us mahine ki maangi jati hai (get-by-month?month=&year=).
   Mahina challan ki DUE DATE se hi tay hota hai — do jagah bharna nahi
   parta aur dono kabhi alag nahi ho sakte. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const thisPeriod = () => { const n = new Date(); return { month: n.getMonth() + 1, year: n.getFullYear() }; };
const periodLabel = (p) => MONTHS[(Number(p && p.month) || 1) - 1] + ' ' + ((p && p.year) || '');
/* Us mahine ki wo tareekh jo default due date banti hai (10 tareekh). */
const defaultDueFor = (p) => {
  const yr = (p && p.year) || thisPeriod().year;
  const mo = String(Number(p && p.month) || 1).padStart(2, '0');
  return yr + '-' + mo + '-10';
};
/* Issue date ka default: chune hue mahine ke andar hi rehna chahiye (mahina
   isi se banta hai). Aaj ka din usi mahine me ho to aaj, warna us mahine ki
   pehli tareekh. Pehle hamesha "aaj" hota tha, is liye August khula ho aur
   September chal raha ho to challan chup-chaap September ka ban jata. */
const defaultIssueFor = (p) => {
  const today = todayISO();
  if (dateInPeriod(today, p)) return today;
  const yr = (p && p.year) || thisPeriod().year;
  const mo = String(Number(p && p.month) || 1).padStart(2, '0');
  return yr + '-' + mo + '-01';
};
/* Kya ye tareekh usi mahine ki hai? Month due date se nikalta hai, is liye
   dono ka mail khana zaroori hai — warna challan galat mahine me chala jata. */
/* Saal ki list — abhi wala saal beech me, ek pichhla aur ek agla. Jo saal
   pehle se chuna hua ho wo hamesha list me rehta hai. */
const yearChoices = (selected) => {
  const now = thisPeriod().year;
  const set = new Set([now - 1, now, now + 1, Number(selected) || now]);
  return [...set].sort((a, b) => a - b);
};

const dateInPeriod = (iso, p) => {
  const d = String(iso || '');
  if (d.length < 7 || !(p && p.month)) return false;
  return Number(d.slice(5, 7)) === Number(p.month) && Number(d.slice(0, 4)) === Number(p.year);
};

const TABS = [
  { id: 'setup',     name: 'Payment Setup', icon: 'fa-gear' },
  { id: 'challans',  name: 'Challans',      icon: 'fa-file-invoice' },
  { id: 'receiving', name: 'Receiving',     icon: 'fa-hand-holding-dollar' },
  { id: 'report',    name: 'Reports',       icon: 'fa-chart-bar' },
];

/* branch-report ki row → wohi school shape jo yeh screen padhti hai. */
const branchToPaySchool = (b) => ({
  id: b.id,
  name: b.name,
  principal: b.principal || '',
  contact: b.contact || '',
  students: b.students || 0,
  initials: b.initials || 'SM',
  schoolCode: String(b.id).padStart(6, '0'),
});

export default function SchoolPayment({ toast }) {
  const [tab, setTab] = useState('setup');
  const [schools, setSchools] = useState([]);
  const [payStore, setPayStore] = useState({});
  const [chStore, setChStore] = useState({});
  const [recvStore, setRecvStore] = useState({});
  /* { [branchId]: pichhle mahine ka baqaya } — Receiving tab ka Total Dues. */
  const [prevDuesStore, setPrevDuesStore] = useState({});
  /* { [branchId]: { bankName, accountTitle, accountNo, branchName, iban, note } }
     — challan slip ke "Payment Method" block ke liye. */
  const [bankStore, setBankStore] = useState({});
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* toast prop har render par naya function ho sakta hai — loader ko dobara
     chalane se rokne ke liye ref me rakha hai (wahi tareeqa SchoolStatus ka). */
  const toastRef = useRef(toast);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  /* ── Loading — har tab SIRF apni API chalata hai ─────────────────────
     Screen khulte hi sirf branch directory aati hai (branch-report), taake
     branchID bilkul wahi jaye jo backend samajhta hai. Uske baad jo tab khula
     ho bas usi ki call jati hai:
       Payment Setup → GET  /summary?branchId=&type=
       Challans      → POST /manage_payment_ledger      (action: GET)
       Receiving     → POST /manage_payment_receiving   (action: GET)
     Har tab ka data ek hi baar aata hai (loadedRef) — dobara switch karne par
     koi nayi call nahi, is liye intezar bhi nahi. API na chale to bundled demo
     data — screen kabhi khali nahi rehti. */
  /* Kis mahine ke challans dekhe ja rahe hain. ERP wala usool: mahina hi
     challan ki bunyaad hai, is liye Challans tab ka poora data isi par
     chalta hai — mahina badla to us mahine ki list dobara aati hai. */
  const [period, setPeriod] = useState(thisPeriod);

  const loadedRef = useRef({ setup: false, challans: false, receiving: false, banks: false });
  const inflightRef = useRef({});
  /* payStore ka mirror — ensureChallans ko setups turant chahiye hote hain
     (setState ka naya value usi tick me nahi milta). */
  const payRef = useRef({});
  const [tabBusy, setTabBusy] = useState({ setup: false, challans: false, receiving: false, banks: false });

  useEffect(() => { payRef.current = payStore; }, [payStore]);

  /* Ek key ka kaam sirf EK baar; chal raha ho to doosra caller usi promise par
     wait karta hai (React ke double-effect par bhi ek hi call jati hai).

     `stamp` batata hai ke jo call chal rahi hai wo KIS cheez ki hai —
     challans aur receiving par yeh chuna hua MAHINA hai (setup / banks par
     mahina lagta hi nahi, is liye wahan khali).

     Yeh laazmi hai: pehle sirf "koi call chal rahi hai?" dekha jata tha. August
     ki call abhi chal rahi ho aur user September kar de, to naya caller USI
     August wali call par lag jata tha — September ka kaam kabhi chalta hi nahi
     tha, August ka jawab September ki table me bhar jata, aur loadedRef "load ho
     chuka" mark kar deta, is liye dobara koi call bhi nahi jati thi. Wahi wajah
     thi ke August ki receiving delete karne ke baad bhi September par wahi
     Total Dues aur Received Amount dikhte rehte thay.

     Ab stamp alag ho to purani call chhor kar nayi chalti hai, aur purani ka
     jawab (jo ab kisi aur mahine ka hai) chup-chaap phenk diya jata hai. */
  const runOnce = useCallback((key, work, errMsg, stamp = '') => {
    if (loadedRef.current[key]) return Promise.resolve();
    const running = inflightRef.current[key];
    if (running && running.stamp === stamp) return running.job;
    setTabBusy((prev) => ({ ...prev, [key]: true }));
    /* `entry` hi is call ki shanakht hai — har jagah pehle yeh dekha jata hai
       ke abhi bhi yehi taaza call hai, warna uska jawab bekaar hai. */
    const entry = { stamp };
    const mine = () => inflightRef.current[key] === entry;
    entry.job = work()
      .then(() => { if (mine()) loadedRef.current[key] = true; })
      .catch((err) => { if (mine()) toastRef.current?.(err?.message || errMsg, 'warn'); })
      .finally(() => {
        if (!mine()) return;
        inflightRef.current[key] = null;
        setTabBusy((prev) => ({ ...prev, [key]: false }));
      });
    inflightRef.current[key] = entry;
    return entry.job;
  }, []);

  /* Payment Setup tab → har branch ka GET /summary */
  const ensureSetups = useCallback(async (rows) => {
    await runOnce('setup', async () => {
      const setups = await paymentsApi.listPaymentSummaries(rows.map((s) => s.id));
      payRef.current = setups;
      setPayStore(setups);
    }, 'Could not load payment setups');
    return payRef.current;
  }, [runOnce]);

  /* Challans tab → ledger GET. Ledger row par sirf totalAmount hota hai;
     monthly / previous-dues ka split setup se nikalta hai, is liye setups
     pehle — pehle se load hon to koi nayi call nahi jati. */
  /* Mahina badalte hi pichhle mahine ka data sach nahi raha — cache khol
     kar us naye mahine ki list mangwate hain. */
  const challanPeriodRef = useRef(null);
  const ensureChallans = useCallback(async (rows) => {
    const key = `${period.year}-${period.month}`;
    if (challanPeriodRef.current !== key) {
      challanPeriodRef.current = key;
      loadedRef.current.challans = false;
      setChStore({});
    }
    if (loadedRef.current.challans) return;
    const setups = await ensureSetups(rows);
    await runOnce('challans', async () => {
      const fresh = await paymentsApi.listChallans(rows, setups, period);
      /* Jawab aane tak mahina badal gaya ho to yeh rows us naye mahine ki
         nahi hain — store me daalna sirf ghalat aadad dikhata hai. */
      if (challanPeriodRef.current !== key) return;
      setChStore(fresh);
    }, 'Could not load challans', key);
  }, [ensureSetups, runOnce, period]);

  /* Receiving tab → receiving GET.
     Sirf receiving kaafi nahi: table ka "Total Dues" aur "Prev Month
     Remaining" challan se aate hain, monthly setup se, aur Add Payment save
     karte waqt schoolPaymentID / paymentLedgerID bhi unhi rows ki id hoti hai.
     Is liye user seedha Receiving par aaye tab bhi setup + challan pehle —
     jo pehle se load ho chuke hon un par koi nayi call nahi jati. */
  /* Challans ki tarah receiving bhi mahine ki cheez hai — mahina badla to
     us mahine ke record dobara aate hain. */
  const recvPeriodRef = useRef(null);
  const ensureReceivings = useCallback(async (rows) => {
    const key = `${period.year}-${period.month}`;
    if (recvPeriodRef.current !== key) {
      recvPeriodRef.current = key;
      loadedRef.current.receiving = false;
      setRecvStore({});
      setPrevDuesStore({});
    }
    if (loadedRef.current.receiving) return;
    await ensureChallans(rows);
    await runOnce('receiving', async () => {
      const setups = payRef.current || {};
      const [recvs, prevDues] = await Promise.all([
        paymentsApi.listReceivings(rows.map((x) => x.id), period),
        /* "Total Dues" column ke liye — pichhle mahine ka bacha hua. */
        paymentsApi.listPreviousDues(rows, setups, period).catch(() => ({})),
      ]);
      /* Challans wali baat yahan bhi: mahina badal chuka ho to yeh August ka
         jawab hai, September ki table ka nahi. */
      if (recvPeriodRef.current !== key) return;
      setRecvStore(recvs);
      setPrevDuesStore(prevDues);
    }, 'Could not load receiving records', key);
  }, [ensureChallans, runOnce, period]);

  /* Challan slip ka Download → branch ki apni bank details.
     Yeh AHM_School_Payments par nahi hain (us model me koi bank column hi
     nahi), balke School Permissions wali get-branches-with-permissions par
     aati hain — ek hi call sab branches ke liye, aur wo bhi tabhi jab pehli
     slip khule. */
  const ensureBanks = useCallback(() => runOnce('banks', async () => {
    setBankStore(await schoolPermissionsApi.listBranchBanks());
  }, 'Could not load bank details'), [runOnce]);

  /* Mount par sirf branch directory — koi payment API nahi. */
  const load = useCallback(async () => {
    setLoading(true);
    let rows = [];
    try {
      const { launch, erp, inactive } = await schoolProgressApi.listSchoolProgress();
      const seen = new Set();
      rows = [...launch, ...erp, ...inactive]
        .filter((b) => b.id && !seen.has(b.id) && seen.add(b.id))
        .map(branchToPaySchool);
    } catch (err) {
      toastRef.current?.(err?.message || 'Could not load schools — showing sample data', 'warn');
    }
    if (!rows.length) {
      /* Demo mode — in ids ka backend par koi record nahi, is liye teeno tabs
         "load ho chuke" mark hain aur koi payment API nahi chalti. */
      loadedRef.current = { setup: true, challans: true, receiving: true, banks: true };
      payRef.current = INITIAL_PAY_SETUP;
      setSchools(PAY_SCHOOLS);
      setPayStore(INITIAL_PAY_SETUP);
      setLoading(false);
      return;
    }
    setSchools(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Tab khulte hi usi tab ki API. Reports ka apna endpoint nahi — wo challan +
     receiving stores par banti hai (jo pehle se load hon wo skip ho jate hain). */
  useEffect(() => {
    if (!schools.length) return;
    if (tab === 'setup') ensureSetups(schools);
    else if (tab === 'challans') ensureChallans(schools);
    else if (tab === 'receiving') ensureReceivings(schools);
    else if (tab === 'report') { ensureChallans(schools); ensureReceivings(schools); }
  }, [tab, schools, ensureSetups, ensureChallans, ensureReceivings]);

  /* Stats (header) */
  const stats = useMemo(() => {
    const total = schools.length;
    const done = schools.filter((s) => payStore[s.id]).length;
    const revenue = schools.reduce((sum, s) => sum + setupMonthly(s, payStore[s.id]), 0);
    return { total, done, pending: total - done, revenue };
  }, [schools, payStore]);

  /* ── Setup ── POST /manage, phir usi branch ka taaza summary payStore me. */
  const saveSetup = async (id, setup) => {
    const s = schools.find((x) => x.id === id);
    setSaving(true);
    try {
      const saved = await paymentsApi.savePaymentSetup({
        branchId: id, setup, school: s, id: payStore[id]?.id || 0,
      });
      setPayStore((prev) => ({ ...prev, [id]: saved }));
      setModal(null);
      toast?.(`Payment setup saved for ${s ? s.name : 'school'}`, 'success');
    } catch (err) {
      toast?.(err?.message || 'Could not save payment setup', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Challans ── POST /manage_payment_ledger (ADD pehli baar, phir UPDATE). */
  const generateChallan = async (id, { dueDate, prevDues, issueDate }) => {
    const s = schools.find((x) => x.id === id);
    const setup = payStore[id];
    const monthly = setupMonthly(s, setup);
    
    setSaving(true);
    try {
      const saved = await paymentsApi.saveChallan({
        branchId: id, school: s, setup, dueDate,
        /* Issue date ab user chunta hai (API par `creationDate`); na chuni
           gayi ho to aaj ki tareekh. */
        total: monthly + prevDues, issueDate: issueDate || todayISO(),
        /* id sirf tab jata hai jab ISI mahine ka challan pehle se ho — tab
           wo UPDATE hai. Naye mahine ka challan hamesha naya record hai. */
        id: chStore[id]?.id || 0,
      });
      setChStore((prev) => ({ ...prev, [id]: saved }));
      setModal(null);
      toast?.(`Challan generated for ${s.name}`, 'success');
    } catch (err) {
      toast?.(err?.message || 'Could not generate challan', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Bulk generate ──────────────────────────────────────────────────
     Har chuni hui branch ka apna ledger row banta hai, yani har branch ke
     liye alag POST /manage_payment_ledger.

     Ek waqt me sirf CONCURRENCY calls: pehle saari branches ek saath
     chhori jati thin, aur ab har branch par TEEN request lagti hain
     (pichhle mahine ka challan + receiving, phir save) — 50 branches par
     150+ requests ek dam. Server un me se bohat si gira deta tha aur wo
     branch chup-chaap "failed" gin li jati thi. Thodi thodi bhejne se har
     branch ki call waqai poori hoti hai.

     Nakaami ab chhupti bhi nahi: kis branch par kya hua, wo saath rakha
     jata hai aur toast me pehli wajah dikha di jati hai (warna sirf
     "12 failed" likha aata tha aur wajah kahin nahi hoti thi). */
  const BULK_CONCURRENCY = 5;

  const bulkGenerate = async (ids, dueDate, issueDate) => {
    setSaving(true);
    const saved = {};
    const failures = [];
    let cursor = 0;

    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor]; cursor += 1;
        const s = schools.find((x) => x.id === id);
        const setup = payStore[id];
        /* Setup ke baghair koi raqam hi nahi — challan banta hi nahi. */
        if (!s || !setup) {
          failures.push({ name: s?.name || `Branch #${id}`, why: 'no payment setup' });
          continue;
        }
        try {
          /* Wahi hisaab jo ek-ek challan par hai: pichhle mahine ka bacha
             hua is challan me jud kar aata hai. */
          // eslint-disable-next-line no-await-in-loop
          const carry = await paymentsApi.getPreviousDues(id, s, setup, period).catch(() => 0);
          // eslint-disable-next-line no-await-in-loop
          saved[id] = await paymentsApi.saveChallan({
            branchId: id, school: s, setup, dueDate,
            total: setupMonthly(s, setup) + carry, issueDate: issueDate || todayISO(),
            id: chStore[id]?.id || 0,
          });
        } catch (err) {
          failures.push({ name: s.name, why: err?.message || 'request failed' });
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, ids.length) }, worker),
    );

    setChStore((prev) => ({ ...prev, ...saved }));
    setSaving(false);
    setModal(null);

    const done = Object.keys(saved).length;
    if (!done) {
      toast?.(failures[0] ? `Could not generate any challans — ${failures[0].why}` : 'Could not generate any challans', 'error');
      return;
    }
    const word = `${done} school${done !== 1 ? 's' : ''}`;
    if (!failures.length) {
      toast?.(`Challans generated for ${word}`, 'success');
      return;
    }
    toast?.(`Challans generated for ${word} · ${failures.length} failed (${failures[0].name}: ${failures[0].why})`, 'warn');
  };
   const deleteChallan = async (id) => {
    const rowId = chStore[id]?.id || 0;
    /* Challan par receiving bani ho to DB usay hatane hi nahi deti (foreign
       key FK_NetworkSchoolPayment_Receiving_PaymentLedgerID). DELETE bhej kar
       SQL ka error paana bekaar hai — pehle dekh lete hain.

       Challans tab par recvStore load hi nahi hota (har tab apni API chalata
       hai), is liye sirf store dekhna kaafi nahi — us mahine ka record yahin
       utha lete hain.

       AHEM: pehle yahan paymentsApi.getReceiving(id) chalta tha, jo sirf
       branch id leta hai aur us branch ka AAKHRI record deta hai — mahine ki
       koi tameez nahi. Nateeja: August ki receiving delete karne ke baad bhi
       ye September wala record utha laata tha, guard chal jata tha, aur
       August ka challan kabhi delete hota hi nahi tha. listReceivings period
       leta hai, is liye ab sirf USI mahine ka record dekha jata hai. */
    let hasReceiving = Boolean(recvStore[id]?.id);
    if (!hasReceiving) {
      try {
        const recv = (await paymentsApi.listReceivings([id], period))?.[id];
        /* Doosra pehra: FK ledger id par hai, is liye receiving ISI challan ke
           khilaf honi chahiye. Kisi aur mahine ke ledger se juda record rasta
           nahi rok sakta. API ye id expose na kare to sirf period wali shart
           chalti hai. */
        /* receivingRowToUi is field ko `paymentLedgerId` (chhota d) banati hai
           — pehle yahan `paymentLedgerID` likha tha, jo kabhi milta hi nahi
           tha, is liye ye doosra pehra chup-chaap band pada rehta tha. */
        const linkedTo = Number(recv?.paymentLedgerId ?? recv?.challanId ?? 0);
        hasReceiving = Boolean(recv?.id)
          && (!linkedTo || !rowId || linkedTo === Number(rowId));
      } catch (err) {
        /* Pata na chal sake to rukte nahi — API ka apna jawab (friendlyError
           se guzra hua) khud bata dega ke receiving pehle hatani hai. */
      }
    }
    if (hasReceiving) {
      setModal(null);
      toast?.(`This challan has a receiving record for ${periodLabel(period)}. Delete that receiving record first, then delete the challan.`, 'warn');
      return;
    }
    try {
      if (rowId) await paymentsApi.deleteChallan({ branchId: id, id: rowId });
      setChStore((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setModal(null); toast?.('Challan deleted', 'info');
    } catch (err) {
      toast?.(err?.message || 'Could not delete challan', 'error');
    }
  };

  /* ── Receiving ── POST /manage_payment_receiving (ADD pehli baar, phir UPDATE).
     Payment Via ab `paymentVia` column me save hota hai. API har branch ka
     sirf AAKHRI record rakhti hai, is liye purani history (jo screen par thi)
     nayi API row ke aage laga di jati hai. */
  const saveReceiving = async (id, rec) => {
    const s = schools.find((x) => x.id === id);
    const prevHistory = recvStore[id]?.history || [];
    setSaving(true);
    try {
      const saved = await paymentsApi.saveReceiving({
        branchId: id, rec,
        setupId: payStore[id]?.id || 0,
        challanId: chStore[id]?.id || 0,
        id: recvStore[id]?.id || 0,
        /* Record us mahine ka hai jiska challan bhara ja raha hai — payment
           ki tareekh ka mahina isse alag ho sakta hai. */
        period,
      });
      setRecvStore((prev) => ({ ...prev, [id]: {
        ...saved,
        /* Save ke baad API se padha hua `paymentVia` hi sach hai; kisi purane
           record par khali ho to jo abhi chuna gaya wo dikh jata hai. */
        via: saved.via || rec.via || '',
        history: [...prevHistory, { amount: rec.receivedAmount, via: rec.via, date: rec.date }],
      } }));
      setModal(null);
      toast?.(`Payment recorded for ${s ? s.name : 'school'}`, 'success');
    } catch (err) {
      toast?.(err?.message || 'Could not record payment', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteReceiving = async (id) => {
    const rowId = recvStore[id]?.id || 0;
    try {
      if (rowId) await paymentsApi.deleteReceiving({ branchId: id, id: rowId });
      setRecvStore((prev) => { const n = { ...prev }; delete n[id]; return n; });
      setModal(null); toast?.('Receiving record deleted', 'info');
    } catch (err) {
      toast?.(err?.message || 'Could not delete receiving record', 'error');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-credit-card" /></div>
          <div>
            <div className="page-title">Schools Payment</div>
            <div className="page-sub">Manage payment setup, challan generation, fee receiving, and financial reports for all schools.</div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-icon"><i className="fa-solid fa-school" /></div><div className="stat-val">{stats.total}</div><div className="stat-lbl">Total Schools</div></div>
        <div className="stat-card s-green"><div className="stat-icon"><i className="fa-solid fa-circle-check" /></div><div className="stat-val">{stats.done}</div><div className="stat-lbl">Setup Done</div></div>
        <div className="stat-card s-warn"><div className="stat-icon"><i className="fa-solid fa-hourglass-half" /></div><div className="stat-val">{stats.pending}</div><div className="stat-lbl">Pending Setup</div></div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--info)' }}><div className="stat-icon" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)' }}><i className="fa-solid fa-money-bill-wave" /></div><div className="stat-val">{(stats.revenue / 1000).toFixed(1)}</div><div className="stat-lbl">Monthly Revenue (K)</div></div>
      </div>

      <div className="pay-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`pay-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}><i className={`fa-solid ${t.icon}`} /> {t.name}</button>
        ))}
      </div>

      {tab === 'setup' && <SetupTab schools={schools} payStore={payStore} loading={loading || tabBusy.setup} onEdit={(s) => setModal({ type: 'setup', school: s })} />}
      {tab === 'challans' && (
        <ChallansTab schools={schools} payStore={payStore} chStore={chStore} loading={loading || tabBusy.setup || tabBusy.challans}
          period={period} onPeriod={setPeriod}
          onGenerate={(s) => setModal({ type: 'genChallan', school: s })}
          onDownload={(s) => { ensureBanks(); setModal({ type: 'slip', school: s }); }}
          onDelete={(s) => setModal({ type: 'delChallan', school: s })}
          onBulk={() => setModal({ type: 'bulk' })} />
      )}
      {tab === 'receiving' && (
        <ReceivingTab schools={schools} payStore={payStore} chStore={chStore} recvStore={recvStore} prevDuesStore={prevDuesStore} loading={loading || tabBusy.setup || tabBusy.challans || tabBusy.receiving}
          period={period} onPeriod={setPeriod}
          onReceive={(s) => setModal({ type: 'receive', school: s })}
          onDelete={(s) => setModal({ type: 'delRecv', school: s })}
          toast={toast} />
      )}
      {tab === 'report' && <ReportTab schools={schools} payStore={payStore} chStore={chStore} recvStore={recvStore} period={period} onPeriod={setPeriod} loading={loading || tabBusy.setup || tabBusy.challans || tabBusy.receiving} />}

      {/* ── MODALS ── */}
      {modal?.type === 'setup' && <SetupModal school={modal.school} setup={payStore[modal.school.id]} saving={saving} onClose={() => setModal(null)} onSave={saveSetup} toast={toast} />}
      {modal?.type === 'genChallan' && <GenChallanModal school={modal.school} setup={payStore[modal.school.id]} challan={chStore[modal.school.id]} period={period} saving={saving} onClose={() => setModal(null)} onGenerate={generateChallan} toast={toast} />}
      {modal?.type === 'bulk' && <BulkChallanModal schools={schools} payStore={payStore} period={period} saving={saving} onClose={() => setModal(null)} onGenerate={bulkGenerate} toast={toast} />}
      {modal?.type === 'slip' && <SlipModal school={modal.school} setup={payStore[modal.school.id]} challan={chStore[modal.school.id]} bank={bankStore[modal.school.id]} bankBusy={tabBusy.banks} onClose={() => setModal(null)} />}
      {modal?.type === 'delChallan' && <ConfirmDel title="Delete Challan?" sub="This will permanently delete the generated challan for this school. If a payment receiving is recorded against it, delete that receiving record first." confirmText="Delete Challan" onConfirm={() => deleteChallan(modal.school.id)} onClose={() => setModal(null)} />}
      {modal?.type === 'receive' && <ReceiveModal school={modal.school} setup={payStore[modal.school.id]} challan={chStore[modal.school.id]} prevRecv={recvStore[modal.school.id]} period={period} saving={saving} onClose={() => setModal(null)} onSave={saveReceiving} toast={toast} />}
      {modal?.type === 'delRecv' && <ConfirmDel title="Delete Receiving Record?" sub={`This will permanently delete the payment receiving record for "${modal.school.name}". This action cannot be undone.`} confirmText="Delete" onConfirm={() => deleteReceiving(modal.school.id)} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ── shared bits ── */

/* Monthly bill. Summary API apna hisaab `totalAmount` me deti hai — jab wo
   maujood ho wahi dikhta hai (screen aur DB kabhi alag na batayein), warna
   formula se nikala jata hai (demo rows / abhi type ho raha setup). */
const setupMonthly = (school, setup) => {
  const fromApi = Number(setup?.totalAmount);
  return fromApi > 0 ? fromApi : monthlyCharge(school, setup);
};

/* "2026-08-18T00:41:53.23" → "18 August 2026" (khali/kharab par ''). */
const fmtStamp = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : fmtDateLong(d.toISOString().slice(0, 10));
};

function FormulaBadge({ setup }) {
  if (!setup) return <span className="badge b-gray" style={{ fontSize: 9.5 }}>—</span>;
  return setup.formula === 'lumpsum'
    ? <span className="badge b-blue"><i className="fa-solid fa-money-bill-wave" style={{ fontSize: 8 }} /> Lump Sum</span>
    : <span className="badge b-green"><i className="fa-solid fa-user-graduate" style={{ fontSize: 8 }} /> Per Student</span>;
}
/* Free trial ka haal. Pehle yahan sirf "30d trial" likha aata tha — yeh
   batata hi nahi tha ke muddat guzar chuki hai. Ab teen soortein hain:
   khatam ho chuka (kis din), chal raha hai (kitne din baqi), aur wo naya
   setup jo abhi API se aaya hi nahi (sirf muddat maloom). */
function TrialCell({ trial }) {
  if (!trial) return <span style={{ color: 'var(--tm)' }}>—</span>;

  if (trial.daysLeft == null) {
    return (
      <span className="badge b-blue" style={{ fontSize: 9.5 }}>
        <i className="fa-solid fa-gift" style={{ fontSize: 8 }} /> {trial.days}d trial
      </span>
    );
  }

  if (trial.ended) {
    return (
      <>
        <span className="badge b-red" style={{ fontSize: 9.5 }}>
          <i className="fa-solid fa-hourglass-end" style={{ fontSize: 8 }} /> Trial ended
        </span>
        <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}>
          {trial.days}d · ended {trial.endLabel}
        </div>
      </>
    );
  }

  /* Aakhri hafte me rang badal jata hai taake nazar me aa jaye. */
  const cls = trial.daysLeft <= 7 ? 'b-warn' : 'b-blue';
  return (
    <>
      <span className={`badge ${cls}`} style={{ fontSize: 9.5 }}>
        <i className="fa-solid fa-gift" style={{ fontSize: 8 }} /> {trial.daysLeft}d left
      </span>
      <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}>
        {trial.days}d · ends {trial.endLabel}
      </div>
    </>
  );
}
function LoadingRow({ cols, msg = 'Loading…' }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 24, display: 'block', margin: '0 auto 12px', color: 'var(--brand)' }} /><div style={{ fontSize: 13, fontWeight: 700 }}>{msg}</div></td></tr>;
}
function NoResults({ cols, msg = 'No schools found' }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: 44, color: 'var(--tm)' }}><i className="fa-solid fa-magnifying-glass" style={{ fontSize: 28, display: 'block', margin: '0 auto 12px', opacity: 0.3 }} /><div style={{ fontSize: 14, fontWeight: 700 }}>{msg}</div></td></tr>;
}
function CardHeader({ icon, title, sub, children }) {
  return (
    <div className="card-header">
      <div><div className="card-title"><i className={`fa-solid ${icon}`} /> {title}</div><div className="card-sub">{sub}</div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}
function Search({ value, onChange, placeholder, width = 220 }) {
  return (
    <div className="search-box" style={{ width }}>
      <i className="fa-solid fa-magnifying-glass" />
      <input className="search-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

/* ═══════════════════════ SETUP TAB ═══════════════════════ */
function SetupTab({ schools, payStore, loading, onEdit }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState({});
  const list = schools.filter((s) => {
    const m = s.name.toLowerCase().includes(q.toLowerCase()) || (s.principal || '').toLowerCase().includes(q.toLowerCase());
    if (!m) return false;
    if (filter === 'done' && !payStore[s.id]) return false;
    if (filter === 'pending' && payStore[s.id]) return false;
    /* 50+ schools me nazar se dhoondna mushkil hai, is liye khatam ho chuke
       trials ki apni chhanni. */
    if (filter === 'trial-ended') {
      const t = trialInfo(payStore[s.id]);
      if (!t || !t.ended) return false;
    }
    if (filter === 'trial-active') {
      const t = trialInfo(payStore[s.id]);
      if (!t || t.ended || t.daysLeft == null) return false;
    }
    return true;
  });
  return (
    <div className="ss-panel">
      <div className="section-card">
        <CardHeader icon="fa-gear" title="Payment Setup" sub="Configure billing formula (Lump Sum or Per Student) for each school.">
          <Search value={q} onChange={setQ} placeholder="Search schools…" />
          <select className="f-input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 150, height: 38 }}>
            <option value="">All Status</option><option value="done">Setup Done</option><option value="pending">Pending</option>
            <option value="trial-active">Trial Running</option><option value="trial-ended">Trial Ended</option>
          </select>
        </CardHeader>
        <div className="tbl-wrap">
          <table className="psetup-table">
            <thead><tr><th style={{ width: 44 }}>#</th><th>Branch Name</th><th style={{ width: 130 }}>Formula</th><th style={{ width: 110 }}>Free Trial</th><th style={{ width: 120, textAlign: 'center' }}>Monthly Charge</th><th style={{ width: 110, textAlign: 'center' }}>Status</th><th style={{ width: 80, textAlign: 'center' }}>Action</th><th style={{ width: 60, textAlign: 'center' }}>Details</th></tr></thead>
            <tbody>
              {loading ? <LoadingRow cols={8} msg="Loading payment setups…" />
                : list.length === 0 ? <NoResults cols={8} /> : list.map((s, i) => {
                const setup = payStore[s.id];
                const monthly = setupMonthly(s, setup);
                const trial = trialInfo(setup);
                return (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                      <td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{s.principal} · {s.contact}</div></td>
                      <td><FormulaBadge setup={setup} /></td>
                      <td><TrialCell trial={trial} /></td>
                      <td style={{ textAlign: 'center' }}>{setup ? <><span style={{ fontWeight: 800, color: 'var(--t1)' }}>{pkr(monthly)}</span><div style={{ fontSize: 10, color: 'var(--tm)' }}>{setup.formula === 'perstudent' ? `${setup.perStudentRate} × ${setup.studentCount || s.students} students` : '/ month'}</div></> : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{setup ? <span className="badge ps-badge-setup"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Set Up</span> : <span className="badge ps-badge-pending"><i className="fa-solid fa-hourglass-half" style={{ fontSize: 8 }} /> Pending</span>}</td>
                      <td style={{ textAlign: 'center' }}><button className={`ps-action-btn${setup ? ' is-edit' : ' is-setup'}`} onClick={() => onEdit(s)}><i className={`fa-solid fa-${setup ? 'pen' : 'plus'}`} /> {setup ? 'Edit' : 'Set Up'}</button></td>
                      <td style={{ textAlign: 'center' }}><button className="det-btn" data-tip="Toggle details" onClick={() => setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }))}><i className="fa-solid fa-chevron-down" /></button></td>
                    </tr>
                    {expanded[s.id] && (
                      <tr className="psetup-expand-row"><td colSpan={8}>
                        <div className="psetup-detail-box open">{setup ? (() => {
                          const annual = monthly * 12;
                          /* Yeh chaar seedha summary API se aate hain — jab
                             record live ho tabhi dikhte hain. */
                          const updated = fmtStamp(setup.modifiedAt || setup.createdAt);
                          return (
                            <div className="psetup-detail-grid">
                              <div className="psetup-detail-card"><div className="pdc-lbl">Formula</div><div className="pdc-val" style={{ fontSize: 13 }}>{setup.formula === 'lumpsum' ? 'Lump Sum' : 'Per Student'}</div></div>
                              <div className="psetup-detail-card"><div className="pdc-lbl">Monthly Bill</div><div className="pdc-val">{pkr(monthly)}</div>{setup.formula === 'perstudent' && <div className="pdc-sub">{setup.perStudentRate} × {setup.studentCount || s.students} students</div>}</div>
                              <div className="psetup-detail-card"><div className="pdc-lbl">Annual Revenue</div><div className="pdc-val">{pkr(annual)}</div><div className="pdc-sub">projected</div></div>
                              <div className="psetup-detail-card">
                                <div className="pdc-lbl">Free Trial</div>
                                <div className="pdc-val" style={{ fontSize: 13, color: trial && trial.ended ? 'var(--err)' : undefined }}>
                                  {!trial ? 'None' : trial.ended ? 'Ended' : `${trial.days} days`}
                                </div>
                                {trial && trial.daysLeft != null && (
                                  <div className="pdc-sub">{trial.ended ? `${trial.days}d · ended ${trial.endLabel}` : `${trial.daysLeft} days left · ends ${trial.endLabel}`}</div>
                                )}
                              </div>
                              <div className="psetup-detail-card"><div className="pdc-lbl">Total Students</div><div className="pdc-val" style={{ fontSize: 13 }}>{setup.studentCount || s.students || 0}</div></div>
                              <div className="psetup-detail-card"><div className="pdc-lbl">Previous Amount</div><div className="pdc-val" style={{ fontSize: 13 }}>{pkr(setup.previousAmount || 0)}</div></div>
                              <div className="psetup-detail-card"><div className="pdc-lbl">Setup ID</div><div className="pdc-val" style={{ fontSize: 13 }}>{setup.id ? `#${setup.id}` : '—'}</div>{setup.type && <div className="pdc-sub">{setup.type}</div>}</div>
                              <div className="psetup-detail-card"><div className="pdc-lbl">Last Updated</div><div className="pdc-val" style={{ fontSize: 13 }}>{updated || '—'}</div></div>
                              {setup.notes && <div className="psetup-detail-card" style={{ gridColumn: 'span 4', textAlign: 'left' }}><div className="pdc-lbl">Notes</div><div style={{ fontSize: 12.5, color: 'var(--t2)', marginTop: 4 }}>{setup.notes}</div></div>}
                            </div>
                          );
                        })() : <div style={{ textAlign: 'center', padding: 16, color: 'var(--tm)', fontSize: 13 }}><i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />No payment setup configured yet. Click Set Up to begin.</div>}</div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ CHALLANS TAB ═══════════════════════ */
function ChallansTab({ schools, payStore, chStore, loading, onGenerate, onDownload, onDelete, onBulk, period, onPeriod }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const list = schools.filter((s) => {
    const m = s.name.toLowerCase().includes(q.toLowerCase()) || (s.principal || '').toLowerCase().includes(q.toLowerCase());
    if (!m) return false;
    if (filter === 'generated' && !chStore[s.id]) return false;
    if (filter === 'pending' && chStore[s.id]) return false;
    return true;
  });
  return (
    <div className="ss-panel">
      <div className="section-card">
        <CardHeader icon="fa-file-invoice" title="Challans" sub="Generate, download, and delete fee challans for each school.">
          {/* Sab ek hi lakeer me: mahina + saal (poori tab isi par chalti
              hai), talash, chhanni, aur bulk. */}
          <select className="f-input" style={{ width: 132, height: 38 }}
            value={period.month}
            onChange={(e) => onPeriod({ ...period, month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="f-input" style={{ width: 92, height: 38 }}
            value={period.year}
            onChange={(e) => onPeriod({ ...period, year: Number(e.target.value) })}>
            {yearChoices(period.year).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Search value={q} onChange={setQ} placeholder="Search schools…" />
          <select className="f-input" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 150, height: 38 }}>
            <option value="">All Schools</option><option value="generated">Challan Generated</option><option value="pending">Not Generated</option>
          </select>
          <button className="btn-primary" onClick={onBulk}><i className="fa-solid fa-bolt" /> Generate in Bulk</button>
        </CardHeader>
        <div className="tbl-wrap">
          <table className="ch-table">
            <thead><tr><th style={{ width: 44 }}>#</th><th>Branch Name</th><th style={{ width: 110 }}>Formula</th><th style={{ width: 120, textAlign: 'center' }}>Monthly Amount</th><th style={{ width: 130, textAlign: 'center' }}>Challan Status</th><th style={{ width: 200, textAlign: 'center' }}>Actions</th></tr></thead>
            <tbody>
              {loading ? <LoadingRow cols={6} msg="Loading challans…" />
                : list.length === 0 ? <NoResults cols={6} /> : list.map((s, i) => {
                const setup = payStore[s.id]; const challan = chStore[s.id]; const monthly = setupMonthly(s, setup);
                return (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                    <td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{s.principal}</div></td>
                    <td><FormulaBadge setup={setup} /></td>
                    <td style={{ textAlign: 'center' }}>{setup ? <><div style={{ fontWeight: 800, color: 'var(--t1)' }}>{pkr(monthly)}</div><div style={{ fontSize: 10, color: 'var(--tm)' }}>/ month</div></> : <span style={{ color: 'var(--tm)', fontSize: 12 }}>—</span>}</td>
                    <td style={{ textAlign: 'center' }}>{challan ? <div><span className="badge b-green"><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Generated</span><div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 3 }}>Due: {challan.dueDate || '—'}</div></div> : <span className="badge b-gray"><i className="fa-solid fa-clock" style={{ fontSize: 8 }} /> Not Generated</span>}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="ch-actions" style={{ justifyContent: 'center' }}>
                        {/* Jis mahine ka challan pehle se ban chuka hai us par
                            Generate band. Har mahine ka ek hi challan hota hai;
                            pehle ye button khula rehta tha aur dobara dabane par
                            usi row ka UPDATE chal jata tha — jo aksar ghalti se
                            hota tha. Badalna ho to pehle challan delete karein. */}
                        <button
                          className="ch-btn ch-btn-gen"
                          disabled={!setup || !!challan}
                          data-tip={!setup
                            ? 'Set up payment first'
                            : challan ? `Challan already generated for ${periodLabel(period)}` : ''}
                          onClick={() => onGenerate(s)}
                        >
                          <i className="fa-solid fa-file-invoice-dollar" /> Generate
                        </button>
                        <button className="ch-btn ch-btn-dl" disabled={!challan} data-tip={!challan ? 'Generate challan first' : ''} onClick={() => onDownload(s)}><i className="fa-solid fa-download" /> Download</button>
                        <button className="ch-btn ch-btn-del" disabled={!challan} data-tip={challan ? 'Delete challan' : 'No challan to delete'} data-tip-pos="left" onClick={() => onDelete(s)}><i className="fa-solid fa-trash-can" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ RECEIVING TAB ═══════════════════════ */
function ReceivingTab({ schools, payStore, chStore, recvStore, prevDuesStore = {}, loading, onReceive, onDelete, toast, period, onPeriod }) {
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState({});
  const list = schools.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()) || (s.principal || '').toLowerCase().includes(q.toLowerCase()));
  const Dues = ({ v }) => v === 0 ? <span className="dues-zero">0</span> : v > 0 ? <span className="dues-pos">{v.toLocaleString()}</span> : <span className="dues-neg">{v.toLocaleString()}</span>;
  return (
    <div className="ss-panel">
      <div className="section-card">
        <CardHeader icon="fa-hand-holding-dollar" title="Receiving" sub={`Fee receiving for ${periodLabel(period)} — discounts, remaining dues and payment history.`}>
          {/* Wahi mahina jo Challans tab par chuna hua hai: receiving usi
              mahine ke challan ke khilaf hoti hai, is liye dono ek hi
              period par chalte hain. */}
          <select className="f-input" style={{ width: 132, height: 38 }}
            value={period.month}
            onChange={(e) => onPeriod({ ...period, month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="f-input" style={{ width: 92, height: 38 }}
            value={period.year}
            onChange={(e) => onPeriod({ ...period, year: Number(e.target.value) })}>
            {yearChoices(period.year).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Search value={q} onChange={setQ} placeholder="Search schools…" width={200} />
        </CardHeader>
        <div className="tbl-wrap">
          <table className="recv-table">
            {/* ── Columns ka matlab ─────────────────────────────────────
                Total Dues      — PICHHLE mahine ka bacha hua baqaya
                                  (August khula ho to July ka, September
                                  khula ho to August ka). Is mahine ka
                                  challan bana ho ya na bana ho, ye phir
                                  bhi dikhta hai.
                Current Month   — is mahine ka apna charge
                Received Amount — is mahine jitna paisa mila
                Total Payable   — pichhla baqaya + is mahine ka charge   */}
            <thead><tr><th style={{ width: 44 }}>#</th><th>Branch Name</th><th style={{ width: 120, textAlign: 'center' }}>Total Dues</th><th style={{ width: 125, textAlign: 'center' }}>Current Month</th><th style={{ width: 135, textAlign: 'center' }}>Received Amount</th><th style={{ width: 125, textAlign: 'center' }}>Total Payable</th><th style={{ width: 90, textAlign: 'center' }}>Download</th><th style={{ width: 80, textAlign: 'center' }}>Delete</th><th style={{ width: 110, textAlign: 'center' }}>Receiving</th><th style={{ width: 60, textAlign: 'center' }}>Detail</th></tr></thead>
            <tbody>
              {loading ? <LoadingRow cols={10} msg="Loading receiving records…" />
                : list.length === 0 ? <NoResults cols={10} /> : list.map((s, i) => {
                const setup = payStore[s.id]; const challan = chStore[s.id]; const recv = recvStore[s.id];
                const monthly = setup ? setupMonthly(s, setup) : 0;
                /* Challan hi na bana ho to kuch payable hai hi nahi — na total,
                   na remaining. Pehle yahan setup ka mahaana charge gir jata
                   tha, is liye un schools ke saamne bhi dues likhe aate thay
                   jinka challan generate hi nahi hua tha. */
                /* Pichhle mahine ka baqaya — API se, us mahine ke apne
                   challan + receiving se nikala hua (listPreviousDues).
                   Pehle ye is mahine ke challan ke `prevDues` se aata tha,
                   is liye jis mahine ka challan abhi bana hi na ho uska
                   Total Dues khali dikhta tha — halanke pichhla baqaya
                   maujood hota tha. */
                const totalDues = Number(prevDuesStore[s.id]) || 0;
                const currentMonth = challan ? (challan.monthly || 0) : 0;
                /* Total Payable = pichhla baqaya + is mahine ka charge.
                   Challan bana ho to wahi uska total hai; na bana ho to
                   bhi ginti dikhai ja sakti hai taake pata rahe kitna
                   banega. */
                const totalPayable = challan ? challan.total : totalDues;
                const receivingDues = recv ? (recv.receivedAmount || 0) : 0;
                const discount = recv ? (recv.discount || 0) : 0;
                const remainingDues = recv ? (recv.remainingAmount || 0) : totalPayable;
                /* ── Receiving ki halat — wahi teen soortein jo ERP ke Fee
                      module me hain (components/Fee.jsx → fee-recv-acts):
                        challan hi nahi   → kuch receive nahi ho sakta
                        koi receiving nahi → "Receiving"
                        adhi receiving     → "Receive More" (baqi raqam ke liye)
                        poori ho chuki     → button band
                      Pehle yahan sirf "recv hai ya nahi" dekha jata tha, is
                      liye adhi receiving ke baad bhi button band ho jata tha
                      aur bacha hua paisa liya hi nahi ja sakta tha. */
                const fullyReceived = !!recv && remainingDues <= 0;
                const partlyReceived = !!recv && remainingDues > 0;
                return (
                  <React.Fragment key={s.id}>
                    <tr>
                      <td style={{ color: 'var(--tm)', fontWeight: 700 }}>{i + 1}</td>
                      <td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 2 }}>{s.principal}</div></td>
                      {/* Total Dues — pichhle mahine ka bacha hua baqaya. */}
                      <td style={{ textAlign: 'center' }}><Dues v={totalDues} /></td>
                      {/* Current Month — is mahine ka apna charge. */}
                      <td style={{ textAlign: 'center' }}><Dues v={currentMonth} /></td>
                      {/* Received Amount — is mahine jitna mila; rely di
                          gayi ho to neeche "disc" bhi. */}
                      <td style={{ textAlign: 'center' }}>{recv ? (
                        <>
                          <span style={{ color: 'var(--success)', fontWeight: 800 }}>{receivingDues.toLocaleString()}</span>
                          {discount > 0 && (
                            <div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}>disc {discount.toLocaleString()}</div>
                          )}
                        </>
                      ) : <span className="dues-zero">—</span>}</td>
                      {/* Total Payable — pichhla baqaya + is mahine ka charge. */}
                      <td style={{ textAlign: 'center' }}><Dues v={totalPayable} /></td>
                      <td style={{ textAlign: 'center' }}><button className="recv-btn-dl" disabled={!recv} data-tip={!recv ? 'No receiving record' : ''} onClick={() => recv && downloadRecvSlip(s, recv)}><i className="fa-solid fa-download" /> Download</button></td>
                      <td style={{ textAlign: 'center' }}><button className="recv-btn-del" disabled={!recv} data-tip={!recv ? 'No record to delete' : ''} onClick={() => onDelete(s)}><i className="fa-solid fa-trash-can" /> Delete</button></td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="recv-btn-recv"
                          disabled={!challan || fullyReceived}
                          data-tip={!challan
                            ? `No challan generated for ${periodLabel(period)}`
                            : fullyReceived
                              ? `Payment already received for ${periodLabel(period)}`
                              : partlyReceived ? 'Receive the remaining balance' : ''}
                          onClick={() => onReceive(s)}
                        >
                          <i className={`fa-solid ${partlyReceived ? 'fa-plus' : 'fa-hand-holding-dollar'}`} />
                          {partlyReceived ? ' Receive More' : ' Receiving'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'center' }}><button className="det-btn" data-tip="Toggle details" onClick={() => setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }))}><i className="fa-solid fa-chevron-down" /></button></td>
                    </tr>
                    {expanded[s.id] && (
                      <tr className="recv-expand-row"><td colSpan={10}>
                        {/* Detail box ko POORA payable chahiye (prev + current),
                            sirf purana baqaya nahi — warna Net Payable aur
                            Remaining ghalat nikalte hain. */}
                        <div className="recv-detail-box open"><RecvDetail s={s} monthly={monthly} totalDues={totalPayable} recv={recv} /></div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function RecvDetail({ s, monthly, totalDues, recv }) {
  const discount = recv ? (recv.discount || 0) : 0;
  const netPayable = recv ? (recv.netPayable || 0) : totalDues;
  const received = recv ? (recv.receivedAmount || 0) : 0;
  const remaining = recv ? (recv.remainingAmount || 0) : totalDues;
  return (
    <>
      <div className="recv-detail-grid">
        <div className="recv-dc"><div className="recv-dc-lbl">Monthly Charge</div><div className="recv-dc-val">{pkr(monthly)}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Discount</div><div className="recv-dc-val">{discount > 0 ? pkr(discount) : '—'}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Net Payable</div><div className="recv-dc-val">{pkr(netPayable)}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Payment Paid</div><div className="recv-dc-val" style={{ color: 'var(--success)' }}>{pkr(received)}</div></div>
        <div className="recv-dc"><div className="recv-dc-lbl">Remaining</div><div className="recv-dc-val" style={{ color: remaining > 0 ? 'var(--err)' : 'var(--success)' }}>{pkr(remaining)}</div></div>
      </div>
      {recv && <div style={{ marginBottom: 8 }}><span className="badge b-green" style={{ fontSize: 11 }}><i className="fa-solid fa-circle-check" style={{ fontSize: 8 }} /> Payment Via: {recv.via || '—'}</span> <span className="badge b-blue" style={{ fontSize: 11, marginLeft: 4 }}><i className="fa-regular fa-calendar" style={{ fontSize: 8 }} /> {recv.date || '—'}</span></div>}
      {recv && recv.history && recv.history.length > 0 && (
        <div style={{ borderTop: '1.5px solid var(--bl)', paddingTop: 10, marginTop: 4 }}>
          <div className="recv-history-title"><i className="fa-solid fa-clock-rotate-left" /> Payment History</div>
          {recv.history.map((h, j) => (
            <div className="recv-hist-item" key={j}><div className="recv-hist-dot" /><div className="recv-hist-amount">{pkr(h.amount)}</div><div className="recv-hist-via">{h.via || '—'}</div><div className="recv-hist-date">{h.date || '—'}</div></div>
          ))}
        </div>
      )}
      {!recv && <div style={{ textAlign: 'center', color: 'var(--tm)', fontSize: 12.5, padding: '8px 0' }}><i className="fa-solid fa-circle-info" style={{ marginRight: 6 }} />No receiving record yet. Click <strong>Receiving</strong> to record a payment.</div>}
    </>
  );
}

/* ═══════════════════════ REPORT TAB ═══════════════════════ */
const RPT_SUBTABS = [
  { id: 'summary', name: 'Summary', icon: 'fa-table-list' },
  { id: 'outstanding', name: 'Outstanding', icon: 'fa-triangle-exclamation' },
  { id: 'received', name: 'Received', icon: 'fa-circle-check' },
  { id: 'challan', name: 'Challan', icon: 'fa-file-invoice-dollar' },
];
function RptStatusBadge({ status }) {
  const map = { paid: ['rpt-paid', 'Paid'], partial: ['rpt-partial', 'Partial'], unpaid: ['rpt-unpaid', 'Unpaid'], 'no-challan': ['rpt-pending', 'No Challan'] };
  const [cls, lbl] = map[status] || ['rpt-pending', 'No Setup'];
  return <span className={cls}>{lbl}</span>;
}
function ReportTab({ schools, payStore, chStore, recvStore, loading, period, onPeriod }) {
  const [sub, setSub] = useState('summary');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const rows = useMemo(() => schools.map((s) => {
    const setup = payStore[s.id]; const challan = chStore[s.id]; const recv = recvStore[s.id];
    const d = deriveRow(s, setup, challan, recv);
    return { s, setup, challan, recv, ...d, lastPayDate: recv ? recv.date : null };
  }), [schools, payStore, chStore, recvStore]);

  const overview = useMemo(() => {
    let payable = 0, received = 0, outstanding = 0, paid = 0, unpaid = 0;
    rows.forEach((r) => { payable += r.payable; received += r.received; outstanding += r.outstanding; if (r.received >= r.payable && r.payable > 0) paid++; else if (r.payable > 0) unpaid++; });
    return { total: schools.length, payable, received, outstanding, paid, unpaid };
  }, [rows, schools]);

  const filtered = rows.filter(({ s, status: st }) => {
    const m = s.name.toLowerCase().includes(q.toLowerCase()) || (s.principal || '').toLowerCase().includes(q.toLowerCase());
    if (!m) return false;
    if (status && st !== status) return false;
    return true;
  });

  /* Reports ka apna endpoint nahi — yeh teeno stores (setup / challan /
     receiving) par banti hai. Un me se koi abhi aa raha ho to zero-bhare
     tiles dikhana jhoot hoga, is liye tab tak spinner. */
  if (loading) {
    return (
      <div className="ss-panel">
        <div className="section-card">
          <div className="rpt-loading">
            <i className="fa-solid fa-circle-notch fa-spin" />
            <div>Loading reports…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ss-panel sa-print-area">
      <div className="rpt-stat-grid">
        <div className="rpt-stat"><div className="rpt-stat-val">{overview.total}</div><div className="rpt-stat-lbl">Total Schools</div></div>
        <div className="rpt-stat s-info"><div className="rpt-stat-val" style={{ fontSize: 14 }}>PKR {kfmt(overview.payable)}</div><div className="rpt-stat-lbl">Total Payable</div></div>
        <div className="rpt-stat s-green"><div className="rpt-stat-val" style={{ fontSize: 14 }}>PKR {kfmt(overview.received)}</div><div className="rpt-stat-lbl">Total Received</div></div>
        <div className="rpt-stat s-red"><div className="rpt-stat-val" style={{ fontSize: 14 }}>PKR {kfmt(overview.outstanding)}</div><div className="rpt-stat-lbl">Outstanding</div></div>
        <div className="rpt-stat s-green"><div className="rpt-stat-val">{overview.paid}</div><div className="rpt-stat-lbl">Paid Schools</div></div>
        <div className="rpt-stat s-warn"><div className="rpt-stat-val">{overview.unpaid}</div><div className="rpt-stat-lbl">Unpaid / Partial</div></div>
      </div>

      <div className="section-card">
        <div className="rpt-filter-bar sa-no-print">
          <div className="f-field-grow"><Search value={q} onChange={setQ} placeholder="Search by school name…" width="100%" /></div>
          {/* Report bhi usi mahine ki hai jo Challans/Receiving par khula hai. */}
          <div className="f-field"><select className="f-input" style={{ height: 38, width: 132 }}
            value={period.month} onChange={(e) => onPeriod({ ...period, month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select></div>
          <div className="f-field"><select className="f-input" style={{ height: 38, width: 92 }}
            value={period.year} onChange={(e) => onPeriod({ ...period, year: Number(e.target.value) })}>
            {yearChoices(period.year).map((y) => <option key={y} value={y}>{y}</option>)}
          </select></div>
          <div className="f-field"><select className="f-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 38, width: 150 }}><option value="">All Statuses</option><option value="paid">Paid</option><option value="partial">Partial</option><option value="unpaid">Unpaid</option><option value="no-challan">No Challan</option><option value="no-setup">No Setup</option></select></div>
          <button className="btn-secondary" style={{ height: 38 }} onClick={() => { setQ(''); setStatus(''); }}><i className="fa-solid fa-rotate-left" /> Reset</button>
          <button className="rpt-pdf-btn" onClick={() => window.print()}><i className="fa-solid fa-file-pdf" /> Download PDF</button>
        </div>

        <div style={{ padding: '14px 18px 0' }}>
          <div className="rpt-subtabs">
            {RPT_SUBTABS.map((t) => <button key={t.id} className={`rpt-stab${sub === t.id ? ' active' : ''}`} onClick={() => setSub(t.id)}><i className={`fa-solid ${t.icon}`} /> {t.name}</button>)}
          </div>
        </div>

        {sub === 'summary' && <SummaryReport rows={filtered} />}
        {sub === 'outstanding' && <OutstandingReport rows={filtered.filter((r) => r.outstanding > 0 || r.status === 'unpaid' || r.status === 'partial')} />}
        {sub === 'received' && <ReceivedReport rows={filtered.filter((r) => r.received > 0)} />}
        {sub === 'challan' && <ChallanReport rows={filtered.filter((r) => r.challan)} />}
      </div>
    </div>
  );
}
function ReportTable({ head, children, foot }) {
  return <div className="tbl-wrap"><table className="rpt-table"><thead><tr>{head}</tr></thead><tbody>{children}</tbody>{foot && <tfoot>{foot}</tfoot>}</table></div>;
}
function EmptyReport({ cols, msg }) {
  return <tr><td colSpan={cols} style={{ textAlign: 'center', padding: 40, color: 'var(--tm)' }}><i className="fa-solid fa-chart-bar" style={{ fontSize: 28, opacity: 0.2, display: 'block', margin: '0 auto 10px' }} /><div style={{ fontSize: 13, fontWeight: 700 }}>{msg}</div></td></tr>;
}
function SummaryReport({ rows }) {
  const tot = rows.reduce((a, r) => ({ payable: a.payable + r.payable, received: a.received + r.received, outstanding: a.outstanding + r.outstanding }), { payable: 0, received: 0, outstanding: 0 });
  return (
    <ReportTable
      head={<><th style={{ width: 40 }}>#</th><th>School Name</th><th style={{ width: 110 }}>Formula</th><th style={{ width: 120, textAlign: 'right' }}>Total Payable</th><th style={{ width: 120, textAlign: 'right' }}>Total Received</th><th style={{ width: 120, textAlign: 'right' }}>Outstanding</th><th style={{ width: 100, textAlign: 'center' }}>Status</th><th style={{ width: 100 }}>Last Payment</th></>}
      foot={rows.length ? <tr className="rpt-totals-row"><td colSpan={3} style={{ fontWeight: 800, color: 'var(--brand)', padding: '10px 13px' }}>TOTALS</td><td style={{ textAlign: 'right', padding: '10px 13px' }}>{pkr(tot.payable)}</td><td style={{ textAlign: 'right', padding: '10px 13px', color: 'var(--success)' }}>{pkr(tot.received)}</td><td style={{ textAlign: 'right', padding: '10px 13px', color: 'var(--err)' }}>{pkr(tot.outstanding)}</td><td colSpan={2} /></tr> : null}>
      {rows.length === 0 ? <EmptyReport cols={8} msg="No data found" /> : rows.map(({ s, setup, status, payable, received, outstanding, lastPayDate }, i) => (
        <tr key={s.id}>
          <td>{i + 1}</td>
          <td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div><div style={{ fontSize: 10.5, color: 'var(--tm)' }}>{s.principal}</div></td>
          <td><FormulaBadge setup={setup} /></td>
          <td style={{ textAlign: 'right', fontWeight: 700 }}>{pkr(payable)}</td>
          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{pkr(received)}</td>
          <td style={{ textAlign: 'right', fontWeight: 700, color: outstanding > 0 ? 'var(--err)' : 'var(--success)' }}>{pkr(outstanding)}</td>
          <td style={{ textAlign: 'center' }}><RptStatusBadge status={status} /></td>
          <td>{lastPayDate || <span style={{ color: 'var(--tm)' }}>—</span>}</td>
        </tr>
      ))}
    </ReportTable>
  );
}
function OutstandingReport({ rows }) {
  return (
    <ReportTable head={<><th style={{ width: 40 }}>#</th><th>School Name</th><th>Owner / Contact</th><th style={{ width: 120, textAlign: 'right' }}>Due Amount</th><th style={{ width: 120 }}>Due Period</th><th style={{ width: 90, textAlign: 'center' }}>Status</th></>}>
      {rows.length === 0 ? <EmptyReport cols={6} msg="No outstanding payments found" /> : rows.map(({ s, outstanding, challan, status }, i) => (
        <tr key={s.id}>
          <td>{i + 1}</td><td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div></td>
          <td>{s.principal || '—'}<br /><span style={{ fontSize: 11, color: 'var(--tm)' }}>{s.contact}</span></td>
          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--err)' }}>{pkr(outstanding)}</td>
          <td>{challan ? challan.dueDate : '—'}</td>
          <td style={{ textAlign: 'center' }}><RptStatusBadge status={status} /></td>
        </tr>
      ))}
    </ReportTable>
  );
}
function ReceivedReport({ rows }) {
  return (
    <ReportTable head={<><th style={{ width: 40 }}>#</th><th>School Name</th><th style={{ width: 120, textAlign: 'right' }}>Amount Received</th><th style={{ width: 100 }}>Payment Date</th><th style={{ width: 160 }}>Payment Method</th><th style={{ width: 120, textAlign: 'right' }}>Remaining</th></>}>
      {rows.length === 0 ? <EmptyReport cols={6} msg="No received payments found" /> : rows.map(({ s, recv, received, outstanding }, i) => (
        <tr key={s.id}>
          <td>{i + 1}</td><td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div></td>
          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--success)' }}>{pkr(received)}</td>
          <td>{recv ? recv.date : '—'}</td><td>{(recv && recv.via) || '—'}</td>
          <td style={{ textAlign: 'right', fontWeight: 700, color: outstanding > 0 ? 'var(--err)' : 'var(--success)' }}>{pkr(outstanding)}</td>
        </tr>
      ))}
    </ReportTable>
  );
}
function ChallanReport({ rows }) {
  return (
    <ReportTable head={<><th style={{ width: 40 }}>#</th><th>School Name</th><th style={{ width: 100 }}>Formula</th><th style={{ width: 120, textAlign: 'right' }}>Challan Amount</th><th style={{ width: 120, textAlign: 'right' }}>Previous Dues</th><th style={{ width: 120, textAlign: 'right' }}>Total</th><th style={{ width: 100 }}>Due Date</th><th style={{ width: 100, textAlign: 'center' }}>Status</th></>}>
      {rows.length === 0 ? <EmptyReport cols={8} msg="No challans generated yet" /> : rows.map(({ s, setup, challan, status }, i) => (
        <tr key={s.id}>
          <td>{i + 1}</td><td><div style={{ fontWeight: 700, color: 'var(--t1)' }}>{s.name}</div></td>
          <td><FormulaBadge setup={setup} /></td>
          <td style={{ textAlign: 'right', fontWeight: 700 }}>{pkr(challan.monthly)}</td>
          <td style={{ textAlign: 'right' }}>{pkr(challan.prevDues)}</td>
          <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--brand)' }}>{pkr(challan.total)}</td>
          <td>{challan.dueDate}</td>
          <td style={{ textAlign: 'center' }}><RptStatusBadge status={status} /></td>
        </tr>
      ))}
    </ReportTable>
  );
}

/* ═══════════════════════ MODALS ═══════════════════════ */
function Switch({ checked, onChange }) {
  return <label className="sw"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><div className="sw-track" /><div className="sw-thumb" /></label>;
}
function Ov({ cls, children, onClose, wrap, wrapStyle }) {
  return <div className={`${cls} open`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className={wrap} style={wrapStyle}>{children}</div></div>;
}

/* Modal ke sar par saved record ka khulasa — seedha summary API se. */
function SetupSummaryStrip({ school, summary, loading }) {
  if (loading) {
    return (
      <div className="pay-setup-summary" style={{ color: 'var(--tm)', fontSize: 12.5, fontWeight: 600 }}>
        <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 6, color: 'var(--brand)' }} /> Loading saved setup…
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="pay-setup-summary" style={{ color: 'var(--tm)', fontSize: 12.5, fontWeight: 600 }}>
        <i className="fa-solid fa-circle-info" style={{ marginRight: 6, color: 'var(--brand)' }} /> No setup saved for this branch yet — fill the form below and save.
      </div>
    );
  }
  const updated = fmtStamp(summary.modifiedAt || summary.createdAt);
  /* Trial ki muddat setup ke banne ke din se ginti hai — dekho
     paymentData.trialInfo. */
  const trial = trialInfo(summary);
  const cell = (lbl, val, sub) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--tm)', letterSpacing: '.5px', textTransform: 'uppercase' }}>{lbl}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--t1)', marginTop: 2 }}>{val}</div>
      {sub ? <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
  return (
    <div className="pay-setup-summary">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', letterSpacing: '.6px', textTransform: 'uppercase' }}>
          <i className="fa-solid fa-receipt" /> Saved Setup
        </span>
        <span className="badge b-green" style={{ fontSize: 9.5 }}>#{summary.id} · {summary.type}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 12 }}>
        {cell('Formula', summary.formula === 'lumpsum' ? 'Lump Sum' : 'Per Student',
          summary.formula === 'perstudent' ? `rate ${summary.perStudentRate}` : null)}
        {cell('Monthly Bill', pkr(setupMonthly(school, summary)))}
        {cell('Students', summary.studentCount || school.students || 0)}
        {cell(
          'Free Trial',
          !trial ? 'None' : trial.ended ? 'Ended' : `${trial.days} days`,
          trial && trial.daysLeft != null
            ? (trial.ended
              ? `${trial.days}d · ended ${trial.endLabel}`
              : `${trial.daysLeft} days left · ends ${trial.endLabel}`)
            : null,
        )}
        {cell('Last Updated', updated || '—')}
      </div>
    </div>
  );
}

function SetupModal({ school: s, setup: existing, saving, onClose, onSave, toast }) {
  const init = existing || { formula: 'lumpsum', freeTrial: false, trialDays: '', lumpAmount: '', perStudentRate: '', studentCount: s.students || 0, notes: '' };
  const [f, setF] = useState({ ...init });
  const [summary, setSummary] = useState(existing || null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  /* Form sirf tab tak API se bharta hai jab tak user ne khud kuch na chhua ho —
     slow response beech me typing na kha jaye. */
  const dirty = useRef(false);
  const set = (k, v) => { dirty.current = true; setF((p) => ({ ...p, [k]: v })); };

  /* Modal khulte hi usi branch ka TAAZA summary: GET /summary?branchId=&type=.
     payStore purana ho sakta hai (kisi aur ne backend par badla ho), aur upar
     ki strip isi record se banti hai. */
  useEffect(() => {
    let alive = true;
    setLoadingSummary(true);
    paymentsApi.getPaymentSummary(s.id)
      .then((live) => {
        if (!alive || !live) return;
        setSummary(live);
        if (!dirty.current) setF({ ...live });
      })
      .catch(() => { /* strip optional — form phir bhi bhara ja sakta hai */ })
      .finally(() => { if (alive) setLoadingSummary(false); });
    return () => { alive = false; };
  }, [s.id]);

  const preview = (parseFloat(f.perStudentRate) || 0) * (parseInt(f.studentCount, 10) || 0);
  const save = () => {
    if (saving) return;
    if (f.formula === 'lumpsum' && !f.lumpAmount) { toast?.('Please enter the monthly lump sum amount', 'warn'); return; }
    if (f.formula === 'perstudent' && !f.perStudentRate) { toast?.('Please enter the per student rate', 'warn'); return; }
    if (f.freeTrial && !f.trialDays) { toast?.('Please enter trial duration in days', 'warn'); return; }
    /* id saath jata hai — mojood ho to UPDATE, warna ADD (branchID+type unique). */
    onSave(s.id, { ...f, id: summary?.id || 0, notes: (f.notes || '').trim() });
  };
  return (
    <Ov cls="pay-ov" onClose={onClose} wrap="pay-modal">
      <div className="pay-modal-hdr">
        <div className="pay-modal-av">{s.initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}><div className="pay-modal-title">{s.name}</div><div className="pay-modal-sub">{s.principal}{s.contact ? ` · ${s.contact}` : ''}</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="bottom" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="pay-modal-body">
        <SetupSummaryStrip school={s} summary={summary} loading={loadingSummary} />
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--brand)', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 10 }}><i className="fa-solid fa-calculator" /> Billing Formula</div>
          <div className="pay-formula-grid">
            <div className={`pay-formula-card${f.formula === 'lumpsum' ? ' selected' : ''}`} onClick={() => set('formula', 'lumpsum')}>
              <div className="pay-fc-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-money-bill-wave" /></div>
              <div className="pay-fc-title">Lump Sum / Month</div><div className="pay-fc-desc">Charge a fixed flat amount per month regardless of student count.</div>
            </div>
            <div className={`pay-formula-card${f.formula === 'perstudent' ? ' selected' : ''}`} onClick={() => set('formula', 'perstudent')}>
              <div className="pay-fc-icon" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)' }}><i className="fa-solid fa-user-graduate" /></div>
              <div className="pay-fc-title">Per Student / Month</div><div className="pay-fc-desc">Charge a fixed rate multiplied by number of active students each month.</div>
            </div>
          </div>
        </div>
        <div className="pay-toggle-row">
          <div><div className="pay-toggle-label"><i className="fa-solid fa-gift" style={{ color: 'var(--brand)', marginRight: 5 }} /> Free Trial</div><div className="pay-toggle-sub">If enabled, no payment is charged during the trial period.</div></div>
          <Switch checked={f.freeTrial} onChange={(v) => set('freeTrial', v)} />
        </div>
        {f.freeTrial && <div className="pay-field"><label><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)', marginRight: 4 }} /> Trial Duration (days)</label><input className="pay-input" type="number" value={f.trialDays} onChange={(e) => set('trialDays', e.target.value)} placeholder="e.g. 30" /></div>}
        {f.formula === 'lumpsum' ? (
          <div className="pay-formula-panel active">
            <div className="pay-info-box"><i className="fa-solid fa-circle-info" /><p>The school will be charged a fixed <strong>monthly lump sum amount</strong>, independent of how many students are enrolled.</p></div>
            <div className="pay-field"><label><i className="fa-solid fa-money-bill" style={{ color: 'var(--brand)', marginRight: 4 }} /> Monthly Amount (PKR)</label><input className="pay-input" type="number" value={f.lumpAmount} onChange={(e) => set('lumpAmount', e.target.value)} placeholder="e.g. 5000" /></div>
          </div>
        ) : (
          <div className="pay-formula-panel active">
            <div className="pay-info-box"><i className="fa-solid fa-circle-info" /><p>The school will be charged <strong>per active student per month</strong>. Total bill = Rate × Student Count.</p></div>
            <div className="pay-input-row">
              <div className="pay-field" style={{ marginBottom: 0 }}><label><i className="fa-solid fa-tag" style={{ color: 'var(--brand)', marginRight: 4 }} /> Rate per Student (PKR)</label><input className="pay-input" type="number" value={f.perStudentRate} onChange={(e) => set('perStudentRate', e.target.value)} placeholder="e.g. 50" /></div>
              <div className="pay-field" style={{ marginBottom: 0 }}><label><i className="fa-solid fa-users" style={{ color: 'var(--brand)', marginRight: 4 }} /> Current Students</label><input className="pay-input" type="number" value={f.studentCount} onChange={(e) => set('studentCount', e.target.value)} placeholder="Auto-filled" /></div>
            </div>
            {(preview > 0) && <div style={{ marginTop: 14, background: 'var(--muted)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={{ fontSize: 12, color: 'var(--tm)', fontWeight: 600 }}>Estimated Monthly Bill</div><div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)' }}>PKR {preview.toLocaleString()}</div></div>}
          </div>
        )}
        <div className="pay-field" style={{ marginTop: 16, marginBottom: 0 }}><label><i className="fa-regular fa-note-sticky" style={{ color: 'var(--brand)', marginRight: 4 }} /> Notes (optional)</label><textarea className="pay-input" rows={2} style={{ height: 'auto', padding: '10px 14px', resize: 'vertical' }} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Add any billing notes or special instructions…" /></div>
      </div>
      <div className="pay-modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`} /> {saving ? 'Saving…' : 'Save Setup'}
        </button>
      </div>
    </Ov>
  );
}

function GenChallanModal({ school: s, setup, challan, period, saving, onClose, onGenerate, toast }) {
  const monthly = setupMonthly(s, setup);
  /* Isi mahine ka challan pehle se ho to wahi due date / previous dues
     prefill hote hain — dobara Generate karna usi row ka UPDATE hai.
     Warna default us chune hue mahine ki 10 tareekh (pehle yahan hamesha
     "aaj + 7 din" tha, jo agle mahine me bhi gir sakta tha aur challan
     galat mahine ka ban jata). */
  /* Issue date = challan kis din jari hua. API par ye `creationDate` hai.
     Pehle ye hamesha chup-chaap "aaj" chala jata tha aur user badal hi nahi
     sakta tha; ab wo chunta hai (default aaj). */
  const [issueDate, setIssueDate] = useState(challan?.issueDateRaw || defaultIssueFor(period));
  const [dueDate, setDueDate] = useState(challan?.dueDateRaw || defaultDueFor(period));
  const [prevDues, setPrevDues] = useState(challan?.prevDues ? String(challan.prevDues) : '');
  const prev = parseFloat(prevDues) || 0;

  /* Pichhle mahine ka bacha hua khud bhar deta hai — August ka challan bana,
     50 receive hue, to September ka challan kholte hi Previous Dues me wahi
     baqaya (challan − receiving) aa jata hai. Pehle ye khana khali rehta tha
     aur user ko khud yaad rakh kar likhna parta tha.

     Sirf NAYE challan par: isi mahine ka challan pehle se ho to us par jo
     likha gaya tha wahi sach hai, uthaya nahi jata. Khana editable rehta
     hai — koi rely ya adjustment ho to badla ja sakta hai. */
  const [carried, setCarried] = useState(null);   // { amount, from } | null
  const [carryBusy, setCarryBusy] = useState(!challan);
  useEffect(() => {
    if (challan) { setCarryBusy(false); return undefined; }
    let alive = true;
    setCarryBusy(true);
    paymentsApi.getPreviousDues(s.id, s, setup, period)
      .then((amount) => {
        if (!alive) return;
        setCarried({ amount, from: periodLabel(paymentsApi.previousPeriod(period)) });
        if (amount > 0) setPrevDues(String(amount));
      })
      .catch(() => { /* na mile to khana khali — user khud likh sakta hai */ })
      .finally(() => { if (alive) setCarryBusy(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.id, period.month, period.year]);
  return (
    <Ov cls="ch-gen-ov" onClose={onClose} wrap="ch-gen-modal">
      <div className="ch-gen-hdr">
        <div className="ch-gen-hdr-icon"><i className="fa-solid fa-file-invoice-dollar" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><div className="ch-gen-title">Generate Challan · {periodLabel(period)}</div><div className="ch-gen-sub">{s.name}</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="bottom" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="ch-gen-body">
        <div className="ch-gen-info">
          <div className="ch-gen-info-row"><span className="ch-gen-info-lbl">Formula</span><span className="ch-gen-info-val">{setup.formula === 'lumpsum' ? 'Lump Sum / Month' : `Per Student (${setup.perStudentRate} × ${setup.studentCount || s.students || 0} students)`}</span></div>
          <div className="ch-gen-info-row"><span className="ch-gen-info-lbl">Students</span><span className="ch-gen-info-val">{setup.studentCount || s.students || 0}</span></div>
          <div className="ch-gen-info-row"><span className="ch-gen-info-lbl">Previous Dues</span><span className="ch-gen-info-val" style={{ color: 'var(--err)', fontWeight: 800 }}>{pkr(prev)}</span></div>
        </div>
        <div className="ch-gen-amount-preview"><div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Estimated Challan Amount</div><div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}>Current month charges</div></div><div style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand)' }}>{pkr(monthly)}</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="ch-gen-field">
            <label><i className="fa-regular fa-calendar-plus" style={{ color: 'var(--brand)', marginRight: 4 }} /> Issue Date</label>
            <input className="ch-gen-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="ch-gen-field">
            <label><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)', marginRight: 4 }} /> Due Date</label>
            <input className="ch-gen-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="ch-gen-field">
          <label><i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--warn)', marginRight: 4 }} /> Previous Dues (PKR)</label>
          <input className="ch-gen-input" type="number" value={prevDues} onChange={(e) => setPrevDues(e.target.value)} placeholder="0" />
          <div style={{ fontSize: 10.5, color: 'var(--tm)', marginTop: 4 }}>
            {carryBusy
              ? <><i className="fa-solid fa-circle-notch fa-spin" /> Checking last month…</>
              : carried
                ? (carried.amount > 0
                  ? `Carried forward from ${carried.from} — you can change it.`
                  : `Nothing outstanding from ${carried.from}.`)
                : null}
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg,rgba(30,58,138,.08),rgba(30,64,175,.04))', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Total Net Payable</div><div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 1 }}>Current charges + previous dues</div></div><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{pkr(monthly + prev)}</div></div>
      </div>
      <div className="ch-gen-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Close</button>
        <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)', boxShadow: '0 4px 14px rgba(22,163,74,.28)' }} disabled={saving}
          onClick={() => {
            if (saving) return;
            if (!issueDate) { toast?.('Please select an issue date', 'warn'); return; }
            if (!dueDate) { toast?.('Please select a due date', 'warn'); return; }
            /* Challan KIS mahine ka hai, ye ISSUE DATE se tay hota hai (backend
               ka bhi yahi usool). Is liye issue date usi mahine ki honi chahiye
               jo screen par khula hai — warna challan kisi aur mahine me chala
               jata hai aur wahan pehle se maujood challan se takra jata hai. */
            if (!dateInPeriod(issueDate, period)) {
              toast?.(`Issue date must fall inside ${periodLabel(period)}`, 'warn');
              return;
            }
            /* Us mahine ka challan pehle se ho to yehi baat pehle bata do —
               API par jaakar "already exists" lene ki zaroorat nahi. */
            if (challan) {
              toast?.(`Challan already generated for ${periodLabel(period)}`, 'warn');
              return;
            }
            /* Challan jari hone se pehle wajib nahi ho sakta. Due date agle
               mahine ki ho sakti hai (aksar hoti hai) — us par koi rok nahi. */
            if (issueDate > dueDate) {
              toast?.('Issue date cannot be after the due date', 'warn');
              return;
            }
            onGenerate(s.id, { dueDate, issueDate, prevDues: prev });
          }}>
          <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-file-invoice-dollar'}`} /> {saving ? 'Generating…' : challan ? 'Update Challan' : 'Generate Challan'}
        </button>
      </div>
    </Ov>
  );
}

function BulkChallanModal({ schools, payStore, period, saving, onClose, onGenerate, toast }) {
  const [selected, setSelected] = useState(new Set());
  const [issueDate, setIssueDate] = useState(defaultIssueFor(period));
  const [dueDate, setDueDate] = useState(defaultDueFor(period));
  const [search, setSearch] = useState('');
  const [ddOpen, setDdOpen] = useState(false);
  const withSetup = schools.filter((s) => payStore[s.id]);
  const opts = withSetup.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));
  const noSetupCount = schools.length - withSetup.length;
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  /* Sirf mahaana charge ka jor — har school ka pichhla baqaya generate ke
     waqt uske apne record se nikal kar jur jata hai, is liye asal total is
     se zyada ho sakta hai. Neeche wali lakeer yehi batati hai. */
  const total = [...selected].reduce((sum, id) => { const s = schools.find((x) => x.id === id); return sum + setupMonthly(s, payStore[id]); }, 0);
  return (
    <Ov cls="ch-bulk-ov" onClose={onClose} wrap="ch-bulk-modal">
      <div className="ch-bulk-hdr">
        <div className="ch-bulk-hdr-icon"><i className="fa-solid fa-bolt" /></div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>Bulk Challan Generate</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>Generating challans for <strong>{periodLabel(period)}</strong> — select the branches.</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="bottom" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="ch-bulk-body">
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}><i className="fa-solid fa-school" style={{ color: 'var(--brand)', marginRight: 4 }} /> Select Branches</label>
          <div className="ch-branch-selector">
            <div className="ch-tags">
              {[...selected].map((id) => { const s = schools.find((x) => x.id === id); return s ? <span className="ch-tag" key={id}>{s.name}<span className="ch-tag-x" data-tip="Remove" onClick={() => toggle(id)}>×</span></span> : null; })}
            </div>
            <input className="ch-branch-input" value={search} onChange={(e) => { setSearch(e.target.value); setDdOpen(true); }} onFocus={() => setDdOpen(true)} placeholder="Select Branches…" />
          </div>
          {ddOpen && (
            <div className="ch-dropdown open">
              {opts.length === 0 ? <div className="ch-dropdown-item">No schools with setup</div> : (() => {
                const allSelected = opts.length > 0 && opts.every((s) => selected.has(s.id));
                const toggleAll = () => setSelected((prev) => {
                  const n = new Set(prev);
                  if (allSelected) opts.forEach((s) => n.delete(s.id));
                  else opts.forEach((s) => n.add(s.id));
                  return n;
                });
                return (
                  <>
                    <div className="ch-dropdown-item ch-dropdown-all" onClick={toggleAll}>
                      <i className={`fa-${allSelected ? 'solid fa-square-check' : 'regular fa-square'}`} /> Select All ({opts.length})
                    </div>
                    {opts.map((s) => (
                      <div className={`ch-dropdown-item${selected.has(s.id) ? ' selected' : ''}`} key={s.id} onClick={() => toggle(s.id)}>
                        <i className={`fa-${selected.has(s.id) ? 'solid fa-square-check' : 'regular fa-square'}`} /> {s.name}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--tm)', marginTop: 4 }}>
            {selected.size} of {withSetup.length} branches selected
            {/* Jin branches ka payment setup hi nahi, un ka challan ban hi
                nahi sakta (koi raqam nahi hoti). Pehle wo chup-chaap list se
                gayab thin, is liye "Select All" ke bawajood kuch branches
                chhoot jati thin aur wajah kahin likhi nahi hoti thi. */}
            {noSetupCount > 0 && (
              <span style={{ color: 'var(--warn)' }}>
                {' · '}{noSetupCount} branch{noSetupCount !== 1 ? 'es have' : ' has'} no payment setup and cannot be billed
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn-sm" style={{ height: 30, fontSize: 11 }} onClick={() => setSelected(new Set(withSetup.map((s) => s.id)))}><i className="fa-solid fa-check-double" /> Select All</button>
          <button className="btn-sm" style={{ height: 30, fontSize: 11, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setSelected(new Set())}><i className="fa-solid fa-xmark" /> Clear All</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="ch-gen-field">
            <label><i className="fa-regular fa-calendar-plus" style={{ color: 'var(--brand)', marginRight: 4 }} /> Issue Date for All Challans</label>
            <input className="ch-gen-input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div className="ch-gen-field">
            <label><i className="fa-regular fa-calendar" style={{ color: 'var(--brand)', marginRight: 4 }} /> Due Date for All Challans</label>
            <input className="ch-gen-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div style={{ background: 'var(--muted)', border: '1.5px solid var(--bl)', borderRadius: 'var(--r-md)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><div style={{ fontSize: 12, color: 'var(--tm)', fontWeight: 600 }}>Total Estimated Revenue</div><div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 2 }}>Monthly charges only — each school's previous dues are added automatically.</div></div><div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)' }}>{pkr(total)}</div></div>
      </div>
      <div className="ch-bulk-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Cancel</button>
        <button className="btn-primary" disabled={saving}
          onClick={() => {
            if (saving) return;
            if (selected.size === 0) { toast?.('Select at least one branch', 'warn'); return; }
            if (!issueDate) { toast?.('Select an issue date', 'warn'); return; }
            if (!dueDate) { toast?.('Select a due date', 'warn'); return; }
            /* Wahi shart jo ek-ek challan par hai: mahina issue date se banta
               hai, is liye issue date usi mahine ki honi chahiye. */
            if (!dateInPeriod(issueDate, period)) {
              toast?.(`Issue date must fall inside ${periodLabel(period)}`, 'warn');
              return;
            }
            if (issueDate > dueDate) {
              toast?.('Issue date cannot be after the due date', 'warn');
              return;
            }
            onGenerate([...selected], dueDate, issueDate);
          }}>
          <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-bolt'}`} /> {saving ? 'Generating…' : 'Generate for Selected'}
        </button>
      </div>
    </Ov>
  );
}

function SlipModal({ school: s, setup, challan, bank, bankBusy, onClose }) {
  if (!challan) return null;
  /* Bank details branch ke apne record se aati hain; jis branch ne bhari hi
     nahi, us par grid ki jagah ek saaf note. */
  const b = bank || {};
  const hasBank = Boolean(b.bankName || b.accountTitle || b.accountNo || b.iban || b.branchName);
  return (
    <Ov cls="ch-slip-ov" onClose={onClose} wrap="ch-slip-wrap">
      <div className="ch-slip-toolbar sa-no-print">
        <div className="ch-slip-toolbar-title"><i className="fa-solid fa-file-invoice-dollar" /> Challan Slip Preview</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" style={{ height: 34, fontSize: 12 }} onClick={() => window.print()}><i className="fa-solid fa-print" /> Print / Download PDF</button>
          <button className="pm-close" data-tip="Close" data-tip-pos="bottom" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
      </div>
      <div className="ch-slip-paper sa-print-area">
        <div className="ch-slip-band" />
        <div className="ch-slip-header">
          <div className="ch-slip-logo-area"><div className="ch-slip-logo-circle">{s.initials}</div><div><div className="ch-slip-school-name">{s.name}</div><div className="ch-slip-school-city">{s.principal}</div><div className="ch-slip-school-addr">School Mentor App Pvt Ltd</div></div></div>
          <div className="ch-slip-title-area"><div className="ch-slip-doc-title">Challan Slip</div><div className="ch-slip-doc-sub">Branch Phone: {s.contact || '—'}</div></div>
        </div>
        <div className="ch-slip-info">
          <div className="ch-slip-info-row"><div className="ch-slip-info-key">Owner Name</div><div className="ch-slip-info-val">{s.principal || '—'}</div></div>
          <div className="ch-slip-info-row"><div className="ch-slip-info-key">Issue Date</div><div className="ch-slip-info-val">{challan.issueDate}</div></div>
          <div className="ch-slip-info-row"><div className="ch-slip-info-key">Due Date</div><div className="ch-slip-info-val">{challan.dueDate}</div></div>
        </div>
        <div className="ch-slip-calc">
          <div className="ch-slip-calc-left">
            <div className="ch-slip-calc-title"><i className="fa-solid fa-calculator" /> {setup.formula === 'lumpsum' ? 'Lump Sum' : 'Per Student'} Calculation</div>
            {setup.formula === 'lumpsum' ? (
              <div className="ch-slip-calc-row"><div className="ch-slip-calc-key">Monthly Lump Sum</div><div className="ch-slip-calc-val highlight">PKR {challan.monthly.toLocaleString()}</div></div>
            ) : (
              <>
                <div className="ch-slip-calc-row"><div className="ch-slip-calc-key">Rate / Student</div><div className="ch-slip-calc-val">PKR {challan.perStudentRate.toLocaleString()}</div></div>
                <div className="ch-slip-calc-row"><div className="ch-slip-calc-key">Students</div><div className="ch-slip-calc-val">{challan.studentCount}</div></div>
                <div className="ch-slip-calc-row"><div className="ch-slip-calc-key">Monthly Charge</div><div className="ch-slip-calc-val highlight">PKR {challan.monthly.toLocaleString()}</div></div>
              </>
            )}
          </div>
          <div className="ch-slip-calc-right">
            <div className="ch-slip-calc-title"><i className="fa-solid fa-wallet" /> Net Payable</div>
            <div className="ch-slip-calc-row"><div className="ch-slip-net-key">Previous Dues</div><div className="ch-slip-net-val" style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{challan.prevDues.toLocaleString()}</div></div>
            <div className="ch-slip-calc-row"><div className="ch-slip-net-key">Net Payable</div><div className="ch-slip-net-val" style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>Current Month Charges + Previous Dues</div></div>
            <div className="ch-slip-calc-row" style={{ borderBottom: 'none' }}><div className="ch-slip-net-key" style={{ background: '#0284C7' }}>Total Net Payable</div><div className="ch-slip-net-val" style={{ fontSize: 20, fontWeight: 800, color: '#0284C7' }}>{challan.total.toLocaleString()}</div></div>
          </div>
        </div>
        <div className="ch-slip-bank">
          <div className="ch-slip-bank-title"><i className="fa-solid fa-building-columns" /> Payment Method — Bank Transfer</div>
          {bankBusy && !hasBank ? (
            <div className="ch-slip-bank-empty"><i className="fa-solid fa-circle-notch fa-spin" /> Loading bank details…</div>
          ) : hasBank ? (
            <div className="ch-slip-bank-grid">
              <div className="ch-slip-bank-row"><div className="ch-slip-bank-key">Bank Name</div><div className="ch-slip-bank-val">{b.bankName || '—'}</div></div>
              <div className="ch-slip-bank-row"><div className="ch-slip-bank-key">A/C Title</div><div className="ch-slip-bank-val">{b.accountTitle || '—'}</div></div>
              <div className="ch-slip-bank-row"><div className="ch-slip-bank-key">A/C No</div><div className="ch-slip-bank-val">{b.accountNo || '—'}</div></div>
              <div className="ch-slip-bank-row"><div className="ch-slip-bank-key">Bank Branch</div><div className="ch-slip-bank-val">{b.branchName || '—'}</div></div>
              <div className="ch-slip-bank-row" style={{ gridColumn: 'span 2' }}><div className="ch-slip-bank-key">IBAN</div><div className="ch-slip-bank-val">{b.iban || '—'}</div></div>
              {b.note && <div className="ch-slip-bank-row" style={{ gridColumn: 'span 2' }}><div className="ch-slip-bank-key">Note</div><div className="ch-slip-bank-val">{b.note}</div></div>}
            </div>
          ) : (
            <div className="ch-slip-bank-empty"><i className="fa-solid fa-circle-info" /> No bank details saved for this school — add them on the branch profile (School Permissions).</div>
          )}
        </div>
        <div className="ch-slip-instructions"><div className="ch-slip-instr-title"><i className="fa-solid fa-circle-info" /> Payment Instructions</div><div className="ch-slip-instr-text">Please pay your bill on or before the due date using the methods mentioned above. Late payment may result in service disruption. For queries, contact School Mentor support.</div></div>
        <div className="ch-slip-bottom-band" />
      </div>
    </Ov>
  );
}

function ReceiveModal({ school: s, setup, challan, prevRecv, period, saving, onClose, onSave, toast }) {
  /* Payable wahi jo challan par likha hai; challan na ho to kuch payable
     nahi (wahi qaida jo Receiving table aur Reports par hai). Setup ka
     mahaana charge yahan ab nahi aata — wo bill nahi, sirf formula hai. */
  const totalDues = challan ? challan.total : 0;
  /* Pichhle mahine ka bacha hua — challan me joda gaya previous dues. */
  const prevRemaining = challan ? (challan.prevDues || 0) : 0;
  /* Pehle se record ho to wahi values prefill — dobara save karna usi row ka
     UPDATE hai (currentBranchID + type unique hai), naya record nahi. */
  const [discount, setDiscount] = useState(prevRecv?.discount ? String(prevRecv.discount) : '');
  const [received, setReceived] = useState(prevRecv?.receivedAmount ? String(prevRecv.receivedAmount) : '');
  const [via, setVia] = useState(prevRecv?.via || RECEIVING_METHODS[0]);
  const [date, setDate] = useState(prevRecv?.dateRaw || todayISO());
  const net = Math.max(0, totalDues - (parseFloat(discount) || 0));
  const remaining = net - (parseFloat(received) || 0);
  const save = () => {
    if (saving) return;
    if (!received) { toast?.('Please enter the received amount', 'warn'); return; }
    if (!date) { toast?.('Please select a payment date', 'warn'); return; }
    onSave(s.id, {
      discount: parseFloat(discount) || 0, netPayable: net,
      receivedAmount: parseFloat(received) || 0, remainingAmount: remaining,
      payableAmount: totalDues, via, dateRaw: date, date: fmtDateShort(date),
    });
  };
  return (
    <Ov cls="recv-ov" onClose={onClose} wrap="recv-modal">
      <div className="recv-modal-hdr">
        <div className="recv-modal-icon"><i className="fa-solid fa-hand-holding-dollar" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14, fontWeight: 800, color: 'var(--t1)' }}>Payment Receiving · {periodLabel(period)}</div><div style={{ fontSize: 11.5, color: 'var(--tm)', marginTop: 2 }}>{s.name}</div></div>
        <button className="pm-close" data-tip="Close" data-tip-pos="bottom" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
      </div>
      <div className="recv-modal-body">
        <div className="recv-summary-card">
          <div className="recv-summary-row"><span className="recv-summary-lbl">Previous Month Remaining Amount</span><span className="recv-summary-val">{pkr(prevRemaining)}</span></div>
          <div className="recv-summary-row"><span className="recv-summary-lbl">Total Payable Amount</span><span className="recv-summary-val">{pkr(totalDues)}</span></div>
        </div>
        <div className="recv-field"><label><i className="fa-solid fa-percent" style={{ color: '#0284C7', marginRight: 4 }} /> Discount (PKR)</label><input className="recv-input" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></div>
        <div className="recv-input-2col">
          <div className="recv-field"><label><i className="fa-solid fa-calculator" style={{ color: '#0284C7', marginRight: 4 }} /> Net Payable</label><input className="recv-input" type="number" value={net} readOnly /></div>
          <div className="recv-field"><label><i className="fa-solid fa-money-bill-wave" style={{ color: '#0284C7', marginRight: 4 }} /> Received Amount</label><input className="recv-input" type="number" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0" /></div>
        </div>
        <div className="recv-field"><label><i className="fa-solid fa-building-columns" style={{ color: '#0284C7', marginRight: 4 }} /> Payment Via</label><select className="recv-input" style={{ cursor: 'pointer' }} value={via} onChange={(e) => setVia(e.target.value)}>{RECEIVING_METHODS.map((m) => <option key={m}>{m}</option>)}</select></div>
        <div className="recv-field"><label><i className="fa-regular fa-calendar" style={{ color: '#0284C7', marginRight: 4 }} /> Payment Receiving Date</label><input className="recv-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="recv-remaining-live"><div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Remaining Amount</div><div style={{ fontSize: 10, color: 'var(--tm)', marginTop: 1 }}>Net Payable − Received Amount</div></div><div style={{ fontSize: 22, fontWeight: 800, color: remaining > 0 ? 'var(--err)' : remaining < 0 ? 'var(--success)' : 'var(--tm)' }}>{pkr(remaining)}</div></div>
      </div>
      <div className="recv-modal-foot">
        <button className="btn-secondary" onClick={onClose} disabled={saving}><i className="fa-solid fa-xmark" /> Close</button>
        <button className="btn-primary" style={{ background: 'linear-gradient(135deg,#0369A1,#0284C7)', boxShadow: '0 4px 14px rgba(3,105,161,.28)' }} onClick={save} disabled={saving}>
          <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-circle-check'}`} /> {saving ? 'Saving…' : prevRecv ? 'Update Payment' : 'Add Payment'}
        </button>
      </div>
    </Ov>
  );
}

function ConfirmDel({ title, sub, confirmText, onConfirm, onClose }) {
  return (
    <Ov cls="ch-del-ov" onClose={onClose} wrap="ch-del-modal">
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><i className="fa-solid fa-trash-can" /></div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20, lineHeight: 1.6 }}>{sub}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> {confirmText}</button></div>
    </Ov>
  );
}

/* Open a printable receiving slip in a new window. */
function downloadRecvSlip(s, recv) {
  const w = window.open('', '_blank');
  if (!w) return;
  /* "Total Payable Amount" ki lakeer par pehle netPayable chhap jata tha —
     yani discount kaat kar wali raqam. Slip is se apne aap ko kaat rahi thi:
     120 payable, 20 discount, phir bhi upar 100 likha aata (aur 100 − 20 ka
     hisaab kahin milta nahi tha). Ab poori zanjeer chhapti hai:
       Total Payable − Discount = Net Payable − Paid = Remaining
     Purane record par payableAmount 0 ho sakta hai (us waqt save hi nahi
     hota tha), is liye wahan net + discount se wapas bana lete hain. */
  const discount = Number(recv.discount) || 0;
  const netPayable = Number(recv.netPayable) || 0;
  const payable = Number(recv.payableAmount) || (netPayable + discount);
  w.document.write(`<!DOCTYPE html><html><head><title>Receiving Slip - ${s.name}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,sans-serif}body{background:#f5f5f5;padding:24px}
  .slip{background:#fff;border-radius:12px;max-width:600px;margin:0 auto;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.1)}
  .band{background:linear-gradient(135deg,#0369A1,#0284C7);height:8px}.hdr{padding:22px 28px 18px;border-bottom:2px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center}
  .school-name{font-size:18px;font-weight:800;color:#0F172A}.slip-title{font-size:20px;font-weight:800;color:#0284C7;text-align:right}
  .body{padding:22px 28px}.row{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-radius:8px;margin-bottom:8px;background:#f8fafc;border:1px solid #e5e7eb}
  .lbl{font-size:12.5px;color:#64748B;font-weight:600}.val{font-size:13px;font-weight:800;color:#0F172A}
  .val-blue{background:#0369A1;color:#fff;border-radius:99px;padding:3px 12px;font-size:12px;font-weight:700}.val-green{background:#15803d;color:#fff;border-radius:99px;padding:3px 12px;font-size:12px;font-weight:700}
  .bottom-band{background:#0369A1;height:6px}.footer{text-align:center;padding:14px;font-size:11px;color:#94a3b8}</style></head><body>
  <div class="slip"><div class="band"></div>
  <div class="hdr"><div><div class="school-name">${s.name}</div><div style="font-size:11px;color:#64748B;margin-top:2px">${s.principal || ''}${s.contact ? ' · ' + s.contact : ''}</div></div>
  <div><div class="slip-title">Receiving Slip</div><div style="font-size:11px;color:#64748B;text-align:right;margin-top:3px">School Mentor App Pvt Ltd</div></div></div>
  <div class="body">
  <div class="row"><span class="lbl">Total Payable Amount</span><span class="val-blue">${payable.toLocaleString()}</span></div>
  <div class="row"><span class="lbl">Discount</span><span class="val">${discount.toLocaleString()}</span></div>
  <div class="row"><span class="lbl">Net Payable</span><span class="val">${netPayable.toLocaleString()}</span></div>
  <div class="row"><span class="lbl">Payment Paid</span><span class="val-green">${(recv.receivedAmount || 0).toLocaleString()}</span></div>
  <div class="row"><span class="lbl">Remaining Amount</span><span class="val" style="color:${(recv.remainingAmount || 0) > 0 ? '#DC2626' : '#16A34A'}">${(recv.remainingAmount || 0).toLocaleString()}</span></div>
  <div class="row"><span class="lbl">Payment Via</span><span class="val-blue">${recv.via || '—'}</span></div>
  <div class="row"><span class="lbl">Payment Receiving Date</span><span class="val-blue">${recv.date || '—'}</span></div>
  </div><div class="bottom-band"></div><div class="footer">© 2026 School Mentor App Pvt Ltd · schoolmentor.app</div></div></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
}
