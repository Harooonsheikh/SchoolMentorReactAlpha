/* ════════════════════════════════════════════════════════════════════
   Schools Payment service.

   PAYMENT SETUP ab LIVE hai — SchoolMentorSuperAdminAPI ka AHM_School_Payments
   controller. Challans / Receiving / Reports abhi demo store par hain (neeche
   `resolve()` wale stubs), un ke live routes endpoints.js me mojood hain magar
   UI se wired nahi.

     POST .../api/AHM_School_Payments/manage
       body: { action, id, branchID, isLumpSum, freeTrial, duration, amount,
               notes, type, networkID, totalStudents, totalAmount,
               previousAmount, percentage, createdBy, createdAt, modifiedBy,
               modifiedAt, details: [] }
       → { success, message, data: { id } }          (UPDATE me rowsAffected bhi)

     GET  .../api/AHM_School_Payments/summary?branchId=&type=
       → { success, message, data: { ...wohi record... } }

   Live check se chaar baatein — inhi par yeh service bani hai:
     • Actions sirf INSERT | ADD | UPDATE | DELETE hain (get/upsert nahi):
       "Invalid @Action value. Use INSERT, ADD, UPDATE, or DELETE."
       Padhna hamesha summary se hota hai, manage se nahi.
     • ADD/INSERT (branchID + type) par UNIQUE hai — record maujood ho to
       "A payment record for this BranchID and Type already exists." Is liye
       save karte waqt id ho to UPDATE, warna ADD.
     • `Type` aur `Notes` model par [Required] hain — inhe kabhi null mat
       bhejna (khali string chal jati hai); chhoota to 400 aata hai.
     • summary me `type` query LAAZMI hai (khali bheja to 400) aur record na
       mile to 404 { success:false } — is liye getSetup() null return karti hai.
   ════════════════════════════════════════════════════════════════════ */
import { ApiError, buildQuery } from '../client';
import { SA_ADMIN_API_BASE, getSuperAdminToken } from '../config';
import EP from '../endpoints';
import { currentUserId } from './auth';
import { monthlyCharge, fmtDateLong, fmtDateShort, todayISO } from '../../paymentData';

/* ═══════════════════ PAYMENT SETUP (live) ═══════════════════ */

/* `type` branchID ke saath mil kar record ki unique key banata hai, aur wahi
   lafz summary ki query me wapas jata hai. Super Admin ki yeh screen har
   BRANCH ko bill karti hai (network-level billing alag record hoga), is liye
   'admin' bheja jata hai. Backend agar koi aur lafz use kare to sirf yeh line badlein —
   save aur read dono isi constant se chalte hain. */
export const PAYMENT_TYPE = 'admin';

/* API sirf yeh chaar actions manti hai. */
export const PAYMENT_ACTIONS = { insert: 'INSERT', add: 'ADD', update: 'UPDATE', delete: 'DELETE' };

/* ── API ka paighaam → wo baat jo user ke kaam ki ho ──
   Teeno tables ek zanjeer me bandhe hain:
       payment setup  ←  challan (ledger)  ←  receiving
   Upar wala record tab tak nahi mitta jab tak neeche wala mojood hai — DB
   ki foreign key rok deti hai. Us soorat me API poora SQL error wapas
   karti hai:
     "Error in ManageNetworkSchoolPaymentLedgerAsync: The DELETE statement
      conflicted with the REFERENCE constraint
      FK_NetworkSchoolPayment_Receiving_PaymentLedgerID …"
   Toast me yeh daalna bekaar hai — user ko constraint ka naam nahi, yeh
   jaanna hai ke pehle kya hataana parega. Constraint ke naam se wahi bata
   dete hain. Jo paighaam pehchana na jaye wo jyun ka tyun aage jata hai;
   chupana nuqsan-deh hoga. (Wahi mapping Chain-Schools-Frontend
   src/api/schoolPaymentsApi.js me bhi hai — dono jagah ek jaisa jumla.) */
function friendlyError(raw, label) {
  const msg = String(raw || '').trim();
  if (!msg) return `Could not ${label}`;

  /* Us mahine ka challan pehle se maujood hai — backend ki unique key
     (BranchID + Type + month) par. Ye ghalti nahi, sirf ittila hai, is liye
     saada jumla; DB ki zubaan screen par nahi jani chahiye. */
  if (/ledger entry.*already exists|already exists.*and month/i.test(msg)) {
    return 'Challan already generated for this month.';
  }
  /* Wahi baat receiving ki taraf. */
  if (/receiving entry.*already exists/i.test(msg)) {
    return 'Payment already received for this month.';
  }
  if (/Receiving_PaymentLedgerID/i.test(msg)) {
    return 'This challan has a receiving record against it. Delete the receiving record first, then delete the challan.';
  }
  if (/Ledger_PaymentID/i.test(msg)) {
    return 'This school has a challan against its payment setup. Delete the challan first, then delete the setup.';
  }
  /* Koi aur FK — asal naam nahi jaante, magar wajah wahi hai. */
  if (/REFERENCE constraint|FOREIGN KEY|conflicted with the DELETE/i.test(msg)) {
    return 'This record is linked to other payment records. Remove those first, then try again.';
  }

  /* API har paighaam ke aage apni method ka naam laga deti hai
     ("Error in ManageNetworkSchoolPaymentAsync: …") — wo user ke liye shor
     hai, hata dete hain. */
  const cut = msg.indexOf('Async: ');
  const clean = (cut > 0 && msg.startsWith('Error in ')) ? msg.slice(cut + 'Async: '.length) : msg;
  return clean.trim() || `Could not ${label}`;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const bool = (v) => v === true || v === 1 || String(v).toLowerCase() === 'true';

/**
 * Ek API record → wohi setup shape jo SchoolPayment ka payStore rakhta hai
 * (formula / lumpAmount / perStudentRate / studentCount / freeTrial / trialDays
 * / notes), plus save-back ke liye `id` aur API ka apna `totalAmount`.
 */
export function summaryToSetup(r) {
  if (!r) return null;
  const isLump = bool(r.isLumpSum);
  const amount = num(r.amount);
  return {
    id: num(r.id),
    branchId: num(r.branchID),
    formula: isLump ? 'lumpsum' : 'perstudent',
    lumpAmount: isLump ? String(amount) : '',
    perStudentRate: isLump ? '' : String(amount),
    studentCount: String(num(r.totalStudents)),
    freeTrial: bool(r.freeTrial),
    trialDays: num(r.duration) ? String(num(r.duration)) : '',
    notes: r.notes || '',
    /* API ka apna hisaab — card/modal isi ko "Monthly Bill" dikhate hain jab
       maujood ho, taake screen aur backend kabhi alag na batayein. */
    totalAmount: num(r.totalAmount),
    previousAmount: num(r.previousAmount),
    type: r.type || PAYMENT_TYPE,
    createdAt: r.createdAt || '',
    modifiedAt: r.modifiedAt || '',
    raw: r,
  };
}

/**
 * Screen ka setup → manage ka request body.
 * `school` sirf student count ke fallback ke liye chahiye.
 */
export function setupToBody({ action, id = 0, branchId, setup, school }) {
  const isLump = setup.formula === 'lumpsum';
  const amount = isLump ? num(setup.lumpAmount) : num(setup.perStudentRate);
  const students = num(setup.studentCount || school?.students || 0);
  const me = currentUserId();
  return {
    action,
    id: num(id),
    branchID: num(branchId),
    isLumpSum: isLump,
    freeTrial: Boolean(setup.freeTrial),
    duration: setup.freeTrial ? num(setup.trialDays) : 0,
    /* API par `amount` int64 hai — lumpsum ka monthly amount ya per-student rate. */
    amount: Math.round(amount),
    notes: setup.notes || '',            // [Required] — null kabhi nahi
    type: PAYMENT_TYPE,                  // [Required]
    networkID: num(setup.networkId),
    totalStudents: students,
    /* double — poore mahine ka bill (lumpsum = amount, per-student = rate × students). */
    totalAmount: monthlyCharge(school || { students }, setup),
    previousAmount: num(setup.previousAmount),
    percentage: Boolean(setup.percentage),
    createdBy: me,
    modifiedBy: me,
    /* per-class fee heads — is screen par abhi koi head nahi, so khali. */
    details: Array.isArray(setup.details) ? setup.details : [],
  };
}

/* Shared fetch → JSON. 404 (record hi nahi) ko caller null me badal leta hai. */
async function getJson(url, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(url, {
      headers: { accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  if (res.status === 404) return null;                 // "No payment record found"
  if (!res.ok) throw new ApiError(`Failed to load ${label} (${res.status})`, res.status);
  return res.json().catch(() => null);
}

async function manageAction(body, label) {
  const token = getSuperAdminToken();
  let res;
  try {
    res = await fetch(`${SA_ADMIN_API_BASE}${EP.payments.manage()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError(networkErr.message || 'Network error', 0);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new ApiError(friendlyError(json && (json.message || json.title || json.Message), label), res.status);
  }
  return json;
}

/**
 * Ek branch ka saved Payment Setup.
 * @returns {Promise<Object|null>} mapped setup, ya null jab koi record na ho.
 */
export async function getPaymentSummary(branchId, type = PAYMENT_TYPE) {
  if (!num(branchId)) return null;
  const url = `${SA_ADMIN_API_BASE}${EP.payments.summary()}`
    + buildQuery({ branchId: num(branchId), type });
  const body = await getJson(url, 'payment summary');
  if (!body || body.success === false) return null;
  return summaryToSetup(body.data || body);
}

/**
 * Kai branches ke setups ek saath (sab calls parallel) — Payment Setup tab
 * khulte hi table/cards isi se bharte hain.
 * @returns {Promise<Object>} { [branchId]: setup }  (jin ka record nahi, wo ghayab)
 */
export async function listPaymentSummaries(branchIds = [], type = PAYMENT_TYPE) {
  const ids = [...new Set(branchIds.map(Number).filter(Boolean))];
  const rows = await Promise.all(ids.map((id) => getPaymentSummary(id, type).catch(() => null)));
  const out = {};
  ids.forEach((id, i) => { if (rows[i]) out[id] = rows[i]; });
  return out;
}

/**
 * Setup modal ka Save — pehli baar ADD, dobara UPDATE (branchID+type unique hai).
 * @returns {Promise<Object>} taaza mapped setup (save ke baad summary se padha hua)
 */
export async function savePaymentSetup({ branchId, setup, school, id = 0 } = {}) {
  const rowId = num(id || setup?.id);
  const isEdit = rowId > 0;
  await manageAction(
    setupToBody({
      action: isEdit ? PAYMENT_ACTIONS.update : PAYMENT_ACTIONS.add,
      id: rowId, branchId, setup, school,
    }),
    isEdit ? 'update this payment setup' : 'save this payment setup',
  );
  /* Save ke baad wahi record wapas padho — id / totalAmount / modifiedAt sab
     backend ke hisaab se aa jate hain, screen aur DB kabhi alag nahi hote. */
  const fresh = await getPaymentSummary(branchId).catch(() => null);
  return fresh || { ...setup, id: rowId, branchId: num(branchId) };
}

/** Setup record hatao (screen par abhi koi delete button nahi — API ke liye taiyaar). */
export function deletePaymentSetup({ branchId, id }) {
  return manageAction(
    {
      action: PAYMENT_ACTIONS.delete,
      id: num(id), branchID: num(branchId),
      type: PAYMENT_TYPE, notes: '',
      createdBy: currentUserId(), modifiedBy: currentUserId(),
    },
    'delete this payment setup',
  );
}

/* ═══════════════════ CHALLANS — payment ledger (live) ═══════════════════
   POST .../api/AHM_School_Payments/manage_payment_ledger
     body: { action, id, paymentID, branchID, dueDate, creationDate,
             challanType, credit, debit, networkID, totalAmount, type,
             createdBy, createdAt, modifiedBy, modifiedAt }

   Live check se:
     • Actions: GET | INSERT | ADD | UPDATE | DELETE (setup se ek zyada — yahan
       GET chalta hai, aur wahi list deta hai: { data: [ ...rows ] }).
     • GET branchID par filter karta hai (0 bheja to khali list).
     • Row (branchID + type) par UNIQUE hai — challanType alag ho tab bhi
       doosra ADD "already exists" deta hai. Yani har branch ka EK challan,
       theek wahi jo screen dikhati hai (generate / download / delete).
     • `Type` aur `ChallanType` dono [Required] hain.
     • UPDATE createdBy ko haath nahi lagata (wo INSERT par hi set hota hai).
   ═══════════════════════════════════════════════════════════════════ */

/* Ledger ka apna discriminator. Screen sirf mahaana challan banati hai; koi
   aur cycle chahiye to bas yeh line badle. */
export const CHALLAN_TYPE = 'Monthly';

/* Ledger/Receiving dono par yeh paanch actions hain (setup par GET nahi hai). */
export const LEDGER_ACTIONS = { get: 'GET', insert: 'INSERT', add: 'ADD', update: 'UPDATE', delete: 'DELETE' };

/* ── Challan ka mahina ───────────────────────────────────────────────
   ERP ke fee challans ka usool: har challan EK mahine ka hota hai. Wahan
   row par `month` (1-based) + `year` likhe jate hain aur list
   GET /api/BranchLedger/get-by-month?branchId=&month=&year= se aati hai
   (dekho MdlAHM_Branch_Ledger — swagger par tasdeeq shuda).

   Yahan bhi wahi chalta hai: mahina challan ki DUE DATE se aata hai, taake
   ek hi jagah se tay ho aur user ko do cheezein na bharni parein. */
export const periodOf = (dateLike) => {
  const d = isoDay(dateLike);
  if (!d) { const n = new Date(); return { month: n.getMonth() + 1, year: n.getFullYear() }; }
  return { month: Number(d.slice(5, 7)), year: Number(d.slice(0, 4)) };
};

/* Isse pichhla mahina (January se pehle December, aur saal ek kam). */
export const previousPeriod = (p) => {
  const now = periodOf(null);
  const m = Number(p?.month) || now.month;
  const y = Number(p?.year) || now.year;
  return m <= 1 ? { month: 12, year: y - 1 } : { month: m - 1, year: y };
};

/* Do periods barabar hain? (koi ek na ho to "haan" — filter lagta hi nahi.) */
const samePeriod = (a, b) => {
  if (!a || !b || !a.month || !b.month) return true;
  return Number(a.month) === Number(b.month) && Number(a.year) === Number(b.year);
};

/* "2026-09-01T00:00:00" → "2026-09-01" (khali/kharab par ''). */
const isoDay = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/* Ek POST, sirf `action` badalta hai — ledger aur receiving dono ke liye. */
function actionPoster(pathFn, label) {
  return async function post(body, what) {
    const token = getSuperAdminToken();
    let res;
    try {
      res = await fetch(`${SA_ADMIN_API_BASE}${pathFn()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: '*/*',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      throw new ApiError(networkErr.message || 'Network error', 0);
    }
    const json = await res.json().catch(() => null);
    if (!res.ok || (json && json.success === false)) {
      throw new ApiError(friendlyError(json && (json.message || json.title || json.Message), what || label), res.status);
    }
    return json;
  };
}

const ledgerPost = actionPoster(() => EP.payments.ledgerAction(), 'manage this challan');
const receivingPost = actionPoster(() => EP.payments.receivingAction(), 'manage this receiving record');

/**
 * Ek ledger row → wohi challan shape jo Challans/Slip screen padhte hain.
 *
 * Ledger monthly aur previous dues ALAG store nahi karta — sirf `totalAmount`.
 * Is liye monthly setup se aata hai aur previous dues wahan se nikale jate hain
 * (total − monthly). Challan banne ke baad agar setup ka amount badla jaye to
 * yeh split shift ho jayega; total hamesha wahi rehta hai jo challan par tha.
 */
export function ledgerRowToChallan(r, school, setup) {
  const total = num(r?.totalAmount ?? r?.debit);
  const monthly = setup ? monthlyCharge(school, setup) : total;
  const dueRaw = isoDay(r?.dueDate);
  const issueRaw = isoDay(r?.creationDate);
  /* Mahina issue date se; kisi bohat purani row par wo na ho to due date se
     (aakhri chara), warna mojooda mahina. */
  const rowPeriod = periodOf(issueRaw || dueRaw);
  return {
    id: num(r?.id),
    schoolId: num(r?.branchID),
    paymentId: num(r?.paymentID),
    formula: setup?.formula || 'lumpsum',
    monthly,
    prevDues: Math.max(0, total - monthly),
    total,
    dueDate: dueRaw ? fmtDateLong(dueRaw) : '',
    dueDateRaw: dueRaw,
    /* Issue date = API ka `creationDate`. Dikhane ke liye lamba format, aur
       `issueDateRaw` (YYYY-MM-DD) taake edit par date input me wapas bhara
       ja sake — bilkul dueDate/dueDateRaw ki tarah. */
    issueDate: fmtDateLong(issueRaw || todayISO()),
    issueDateRaw: issueRaw,
    challanType: r?.challanType || CHALLAN_TYPE,
    /* Challan KIS mahine ka hai.
       Row par month/year aayein to wahi. Warna ISSUE DATE (creationDate) se —
       due date se NAHI.

       Ye ek asli kharabi thi: 21 August ko jari kiya gaya challan jiski due
       date 10 September ho, backend August ka ginta hai magar yahan due date
       ki wajah se September ban jata tha. Nateeja — August ki list me wo
       challan dikhta hi nahi tha, Generate ka button khula rehta tha, aur
       dabate hi API "already exists" keh deti thi. Ab dono taraf ek hi qaida
       (dekho challanToBody). */
    month: num(r?.month) || rowPeriod.month,
    year: num(r?.year) || rowPeriod.year,
    studentCount: parseInt(setup?.studentCount || school?.students || 0, 10) || 0,
    perStudentRate: parseFloat(setup?.perStudentRate || 0) || 0,
    lumpAmount: parseFloat(setup?.lumpAmount || 0) || 0,
    credit: num(r?.credit),
    debit: num(r?.debit),
    raw: r,
  };
}

function challanToBody({ action, id = 0, branchId, paymentId = 0, dueDate, issueDate, total }) {
  const me = currentUserId();
  /* Mahina ISSUE DATE se — creationDate se, due date se nahi.
     Backend bhi yahi karta hai: 21 Aug ko jari kiya gaya challan August ka
     ginta hai chahe uski due date 10 September ho ("A ledger entry for this
     BranchID, Type, and month already exists" isi par aata hai). Pehle yahan
     due date se mahina nikalta tha, is liye screen September samajhti aur
     backend August — dono ka hisaab alag ho jata tha. */
  const period = periodOf(issueDate);
  return {
    action,
    id: num(id),
    paymentID: num(paymentId),          // setup record ki id — challan usi se juda hai
    branchID: num(branchId),
    dueDate: dueDate ? `${isoDay(dueDate)}T00:00:00` : null,
    creationDate: `${isoDay(issueDate) || todayISO()}T00:00:00`,
    challanType: CHALLAN_TYPE,          // [Required]
    /* Kis mahine ka challan hai — wahi jodi (month, year) jo ERP ka
       BranchLedger rakhta hai. Backend ab in par unique key lagata hai
       ("A ledger entry for this BranchID, Type, and month already exists"),
       is liye ye issue date ke mahine se hi nikalne chahiye. */
    month: period.month,
    year: period.year,
    /* Challan issue hona = school par charge → debit. Credit receiving ki taraf
       se aata hai, is liye yahan 0. */
    credit: 0,
    debit: num(total),
    networkID: 0,
    totalAmount: num(total),
    type: PAYMENT_TYPE,                 // [Required]
    createdBy: me,
    modifiedBy: me,
  };
}

/**
 * Ek branch ka challan (ya null) — ek MAHINE ka.
 *
 * `period` ({ month, year }) do jagah lagta hai:
 *   1. request me — jis din backend month/year se filter karne lage, kaam
 *      wahin server par ho jayega (ERP ka get-by-month wala tareeqa).
 *   2. jawab par — abhi backend saari rows deta hai, is liye us mahine wali
 *      row yahan chhaan li jati hai. Dono chalne se aaj bhi sahi mahina
 *      dikhta hai aur kal bhi.
 *
 * `period` na do to filter lagta hi nahi — jo pehli row mile wahi.
 */
export async function getChallan(branchId, school, setup, period) {
  if (!num(branchId)) return null;
  const json = await ledgerPost(
    {
      action: LEDGER_ACTIONS.get, id: 0, branchID: num(branchId),
      type: PAYMENT_TYPE, challanType: CHALLAN_TYPE,
      month: period?.month ? Number(period.month) : null,
      year: period?.year ? Number(period.year) : null,
    },
    'load this challan',
  );
  const rows = Array.isArray(json?.data) ? json.data : [];
  const mapped = rows.filter((r) => num(r?.id)).map((r) => ledgerRowToChallan(r, school, setup));
  const hit = mapped.find((c) => samePeriod(period, { month: c.month, year: c.year }));
  return hit || null;
}

/**
 * Kai branches ke challans ek saath (sab calls parallel).
 * @param {Array} schools  live school rows (branchID + students ke liye)
 * @param {Object} setups  { [branchId]: setup } — monthly/prevDues split ke liye
 * @param {Object} [period] { month, year } — kis mahine ke challans chahiye
 * @returns {Promise<Object>} { [branchId]: challan }
 */
export async function listChallans(schools = [], setups = {}, period) {
  const rows = await Promise.all(
    schools.map((s) => getChallan(s.id, s, setups[s.id], period).catch(() => null)),
  );
  const out = {};
  schools.forEach((s, i) => { if (rows[i]) out[s.id] = rows[i]; });
  return out;
}

/**
 * Generate Challan — pehli baar ADD, dobara UPDATE (branchID+type unique hai).
 * @returns {Promise<Object>} taaza mapped challan (save ke baad GET se padha hua)
 */
export async function saveChallan({ branchId, school, setup, dueDate, total, issueDate, id = 0 } = {}) {
  const rowId = num(id);
  await ledgerPost(
    challanToBody({
      action: rowId > 0 ? LEDGER_ACTIONS.update : LEDGER_ACTIONS.add,
      id: rowId, branchId, paymentId: setup?.id, dueDate, issueDate, total,
    }),
    rowId > 0 ? 'update this challan' : 'generate this challan',
  );
  /* Save ke baad usi mahine ka taaza record — warna kisi aur mahine ki row
     uthai ja sakti hai. Mahina issue date se (wahi jo body me gaya). */
  const fresh = await getChallan(branchId, school, setup, periodOf(issueDate)).catch(() => null);
  return fresh || ledgerRowToChallan({ id: rowId, branchID: branchId, totalAmount: total, dueDate, creationDate: issueDate }, school, setup);
}

/**
 * Pichhle mahine ka bacha hua — yehi is mahine ke challan ka "previous
 * dues" banta hai (ERP ka wahi usool: har challan me pichhla baqaya jud
 * kar aata hai).
 *
 * Hisaab:
 *   pichhle mahine ka challan hi na bana ho      → 0 (kuch maanga hi nahi gaya)
 *   challan bana aur receiving bhi hui           → us receiving ka remaining
 *   challan bana magar koi receiving nahi hui    → poora challan baqi hai
 *
 * @returns {Promise<number>} baqaya (kabhi manfi nahi)
 */
export async function getPreviousDues(branchId, school, setup, period) {
  if (!num(branchId)) return 0;
  const prev = previousPeriod(period);
  const [challan, recv] = await Promise.all([
    getChallan(branchId, school, setup, prev).catch(() => null),
    getReceiving(branchId, prev).catch(() => null),
  ]);
  if (!challan) return 0;
  const left = recv ? num(recv.remainingAmount) : num(challan.total);
  return Math.max(0, left);
}

/**
 * Kai branches ka pichhle mahine ka baqaya ek saath — Receiving tab ka
 * "Total Dues" column isi par chalta hai (August khula ho to July ka baqaya,
 * September khula ho to August ka).
 *
 * Ek ek branch par getPreviousDues chalane ke bajaye do batch calls: pichhle
 * mahine ke saare challans, aur pichhle mahine ki saari receivings. Isi liye
 * ye Receiving tab ke apne load ke barabar hai, teen guna nahi.
 *
 * @returns {Promise<Object>} { [branchId]: baqaya }
 */
export async function listPreviousDues(schools = [], setups = {}, period) {
  const prev = previousPeriod(period);
  const ids = schools.map((s) => s.id).filter(Boolean);
  const [challans, receivings] = await Promise.all([
    listChallans(schools, setups, prev).catch(() => ({})),
    listReceivings(ids, prev).catch(() => ({})),
  ]);
  const out = {};
  for (const s of schools) {
    const challan = challans[s.id];
    if (!challan) { out[s.id] = 0; continue; }
    const recv = receivings[s.id];
    /* Receiving hui to uska remaining sach hai; na hui to poora challan baqi. */
    const left = recv ? num(recv.remainingAmount) : num(challan.total);
    out[s.id] = Math.max(0, left);
  }
  return out;
}

/** Challan hatao. */
export function deleteChallan({ branchId, id }) {
  return ledgerPost(
    {
      action: LEDGER_ACTIONS.delete,
      id: num(id), branchID: num(branchId),
      type: PAYMENT_TYPE, challanType: CHALLAN_TYPE,
      createdBy: currentUserId(), modifiedBy: currentUserId(),
    },
    'delete this challan',
  );
}

/* ═══════════════════ RECEIVING (live) ═══════════════════
   POST .../api/AHM_School_Payments/manage_payment_receiving
     body: { action, id, schoolPaymentID, paymentLedgerID, currentBranchID,
             month, year, payableAmount, discount, netPayable, receivingAmount,
             remainingAmount, receivingDate, networkID, paymentVia, type,
             createdBy, createdAt, modifiedBy, modifiedAt }

   Ledger jaisa hi: wahi paanch actions, GET `currentBranchID` par filter karta
   hai, aur row (currentBranchID + type) par UNIQUE hai — "A receiving entry for
   this CurrentBranchID and Type already exists." Sirf `Type` [Required] hai.

   "Payment Via" (Cash / Easypaisa / Bank …) ab `paymentVia` column me save
   hota hai — screen ka chunaav seedha wahan jata hai aur wapas bhi wahin se
   padha jata hai.

   NOTE — API har branch ka SIRF AAKHRI receiving record rakhti hai, poori
   history nahi — screen par history usi ek record se banti hai (aur session
   ke andar ki nayi entries saath jud jati hain).
   ═══════════════════════════════════════════════════════ */

/** Ek receiving row → wohi shape jo Receiving tab / slip padhte hain. */
export function receivingRowToUi(r) {
  const day = isoDay(r?.receivingDate);
  return {
    id: num(r?.id),
    schoolPaymentId: num(r?.schoolPaymentID),
    paymentLedgerId: num(r?.paymentLedgerID),
    branchId: num(r?.currentBranchID),
    month: num(r?.month),
    year: num(r?.year),
    payableAmount: num(r?.payableAmount),
    discount: num(r?.discount),
    netPayable: num(r?.netPayable),
    receivedAmount: num(r?.receivingAmount),
    remainingAmount: num(r?.remainingAmount),
    date: day ? fmtDateShort(day) : '',
    dateRaw: day,
    via: r?.paymentVia || '',
    history: day || num(r?.receivingAmount)
      ? [{ amount: num(r?.receivingAmount), via: r?.paymentVia || '', date: day ? fmtDateShort(day) : '' }]
      : [],
    raw: r,
  };
}

function receivingToBody({ action, id = 0, branchId, setupId = 0, challanId = 0, rec, period }) {
  const me = currentUserId();
  const day = isoDay(rec?.dateRaw || rec?.date) || todayISO();
  /* month/year wo mahina hai JIS KA challan bhara ja raha hai — payment ki
     tareekh ka mahina nahi. August ka challan 2 September ko bhara jaye to
     bhi record August ka hi hai (ERP ka wahi usool: ledger row ka mahina).
     Period na mile to purana tareeqa — tareekh se nikal lo. */
  const fallback = periodOf(day);
  const month = Number(period?.month) || fallback.month;
  const year = Number(period?.year) || fallback.year;
  return {
    action,
    id: num(id),
    schoolPaymentID: num(setupId),
    paymentLedgerID: num(challanId),
    currentBranchID: num(branchId),
    month,
    year,
    payableAmount: num(rec?.payableAmount),
    discount: num(rec?.discount),
    netPayable: num(rec?.netPayable),
    receivingAmount: num(rec?.receivedAmount),
    remainingAmount: num(rec?.remainingAmount),
    receivingDate: `${day}T00:00:00`,
    networkID: 0,
    /* Cash / Easypaisa / Bank Transfer … — jo modal me chuna gaya. */
    paymentVia: rec?.via || '',
    type: PAYMENT_TYPE,            // [Required]
    createdBy: me,
    modifiedBy: me,
  };
}

/**
 * Ek branch ka receiving record (ya null) — ek MAHINE ka.
 *
 * Wahi do-tarfa tareeqa jo getChallan par hai: month/year request me bhi
 * jate hain (jis din backend filter karne lage) aur jawab par bhi lagte
 * hain (abhi API saari rows deti hai). Receiving model par month + year
 * pehle se mojood hain — swagger par tasdeeq shuda.
 */
export async function getReceiving(branchId, period) {
  if (!num(branchId)) return null;
  const json = await receivingPost(
    {
      action: LEDGER_ACTIONS.get, id: 0, currentBranchID: num(branchId), type: PAYMENT_TYPE,
      month: period?.month ? Number(period.month) : null,
      year: period?.year ? Number(period.year) : null,
    },
    'load this receiving record',
  );
  const rows = Array.isArray(json?.data) ? json.data : [];
  const mapped = rows.filter((r) => num(r?.id)).map(receivingRowToUi);
  const hit = mapped.find((x) => samePeriod(period, { month: x.month, year: x.year }));
  return hit || null;
}

/**
 * Kai branches ke receiving records ek saath (sab calls parallel).
 * @returns {Promise<Object>} { [branchId]: receiving }
 */
export async function listReceivings(branchIds = [], period) {
  const ids = [...new Set(branchIds.map(Number).filter(Boolean))];
  const rows = await Promise.all(ids.map((id) => getReceiving(id, period).catch(() => null)));
  const out = {};
  ids.forEach((id, i) => { if (rows[i]) out[id] = rows[i]; });
  return out;
}

/**
 * Add Payment — pehli baar ADD, dobara UPDATE (currentBranchID+type unique hai).
 * @returns {Promise<Object>} taaza mapped record (save ke baad GET se padha hua)
 */
export async function saveReceiving({ branchId, rec, setupId = 0, challanId = 0, id = 0, period } = {}) {
  const rowId = num(id);
  await receivingPost(
    receivingToBody({
      action: rowId > 0 ? LEDGER_ACTIONS.update : LEDGER_ACTIONS.add,
      id: rowId, branchId, setupId, challanId, rec, period,
    }),
    rowId > 0 ? 'update this payment' : 'record this payment',
  );
  const fresh = await getReceiving(branchId, period).catch(() => null);
  return fresh || { ...rec, id: rowId, branchId: num(branchId) };
}

/** Receiving record hatao. */
export function deleteReceiving({ branchId, id }) {
  return receivingPost(
    {
      action: LEDGER_ACTIONS.delete,
      id: num(id), currentBranchID: num(branchId), type: PAYMENT_TYPE,
      createdBy: currentUserId(), modifiedBy: currentUserId(),
    },
    'delete this receiving record',
  );
}

/* ═══════════════════ Reports ═══════════════════
   Reports tab ka apna koi endpoint nahi — wo teeno live stores (setup /
   challan / receiving) se hi bante hain, is liye yahan kuch wire karna nahi.

   Purane `resolve()` wale mock stubs (listPaySchools / getSetup / saveSetup /
   generateChallan / generateBulkChallans / recordReceiving / getChallans /
   getReport) hata diye gaye — teeno screens ab live hain aur unhe koi call
   nahi karta tha; live functions ke saath rakhna sirf ghalat import ki dawat
   thi. Purani demo rows abhi bhi ../../paymentData me hain (screen API fail
   hone par unhi par gir jati hai). */
