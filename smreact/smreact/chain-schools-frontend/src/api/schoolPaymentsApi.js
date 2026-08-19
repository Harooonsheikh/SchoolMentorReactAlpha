/* ═══════════════════════════════════════════════════════════════════
   SCHOOL PAYMENTS — har connected school ka billing setup.

   Do alag APIs:

   1) Setup padhna/likhna — Super-Admin API
        GET  {sa}/api/AHM_School_Payments/summary?branchId={id}&type=chain
        POST {sa}/api/AHM_School_Payments/manage   → action: insert|update|delete

      KHABARDAR: `manage` par koi READ action nahi hai. Uska error message
      "Use INSERT, ADD, UPDATE, or DELETE" kehta hai aur is baar sach kehta
      hai — get/getall/getbybranch sab 500 dete hain. Padhne ka rasta sirf
      `summary` hai, aur wo aik waqt me aik hi branch deta hai; is liye list
      ke liye har branch par alag call jaati hai (dekhein fetchSetupEach).

      Record na ho to `summary` success:false + "No payment record found"
      deta hai — ye khata nahi, sirf "abhi setup nahi hua" hai.

   2) Classes aur unke fee heads — ERP API
        GET {erp}/api/LaunchSetup/get-grades-by-branch/{branchID}

      Percentage (royalty) formula ke liye school ki apni classes aur unke
      apne fee heads chahiye. Yehi aik call dono deti hai: har grade ke sath
      `feeHeads: [{ feeStructureID, headName, amount }]` bhi aata hai, is liye
      heads ke liye alag call ki zaroorat nahi. feeStructureID hi wo `headID`
      hai jo details[] me wapas bheja jaata hai.

   Chain portal hamesha `type: "chain"` bhejta hai (SOPs / permissions ki
   tarah), taake ye rows sirf isi portal ki rahein.

   Baqi Super-Admin calls ki tarah ye bhi axios client se nahi jaatin.
   ═══════════════════════════════════════════════════════════════════ */

import { SUPERADMIN_API_BASE, ERP_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${SUPERADMIN_API_BASE}/api/AHM_School_Payments`
const TYPE = 'chain'

const userId = () => {
  const u = getStoredUser()
  return Number(u?.id ?? u?.userID ?? u?.userId) || 0
}

/* ── API ka paighaam → wo baat jo user ke kaam ki ho ──
   Ye teen tables aik zanjeer me bandhe hain:
       payment setup  ←  challan (ledger)  ←  receiving
   Upar wala record tab tak nahi mitta jab tak neeche wala mojood hai — DB
   foreign key rok deti hai. Us soorat me API poora SQL error wapas karti
   hai ("The DELETE statement conflicted with the REFERENCE constraint
   FK_NetworkSchoolPayment_Ledger_PaymentID…"), jo toast me daalna bekaar
   hai: user ko constraint ka naam nahi, ye jaanna hai ke pehle kya hataana
   parega. Constraint ke naam se wahi bata dete hain.

   Jo paighaam pehchana na jaye wo jyun ka tyun aage jaata hai — chupana
   nuqsan-deh hoga. */
function friendlyError(raw) {
  const msg = String(raw || '').trim()

  if (/Receiving_PaymentLedgerID/i.test(msg)) {
    return 'This challan has a receiving record against it. Delete the receiving record first, then delete the challan.'
  }
  if (/Ledger_PaymentID/i.test(msg)) {
    return 'This school has a challan against its payment setup. Delete the challan first, then delete the setup.'
  }
  /* Koi aur FK — asal naam nahi jaante, magar wajah wahi hai. */
  if (/REFERENCE constraint|FOREIGN KEY|conflicted with the DELETE/i.test(msg)) {
    return 'This record is linked to other payment records. Remove those first, then try again.'
  }

  /* API har paighaam ke aage apni method ka naam laga deti hai
     ("Error in ManageNetworkSchoolPaymentAsync: …") — wo user ke liye
     shor hai, hata dete hain. */
  return msg.replace(/^Error in \w+Async:\s*/i, '').trim() || 'Request failed'
}

/* ── Formula ↔ API flags ──
   API par formula do booleans se banta hai, is liye teenon aik dusre ko kaat
   dete hain — aik on hote hi baqi dono lazman off:

     lumpsum     → isLumpSum: true,  percentage: false
     perstudent  → isLumpSum: false, percentage: false
     percentage  → isLumpSum: false, percentage: true

   `amount` ka matlab formula ke sath badalta hai: lump sum me poora mahana
   charge, per-student me aik student ka rate. `totalAmount` hamesha wo raqam
   hai jo asal me charge hogi. */
export const FORMULAS = ['lumpsum', 'perstudent', 'percentage']

export function toApiFlags(formula) {
  return {
    isLumpSum:  formula === 'lumpsum',
    percentage: formula === 'percentage',
  }
}

function toFormula(row) {
  if (row?.percentage) return 'percentage'
  if (row?.isLumpSum) return 'lumpsum'
  return 'perstudent'
}

/* ── API row → screen ka setup object ── */
export function toSetup(row) {
  if (!row) return null
  const formula = toFormula(row)
  const amount = Number(row.amount) || 0
  return {
    id:              Number(row.id) || 0,
    formula,
    lumpAmount:      formula === 'lumpsum' ? String(amount || '') : '',
    perStudentRate:  formula === 'perstudent' ? String(amount || '') : '',
    studentCount:    String(Number(row.totalStudents) || 0),
    /* Round-trip ke liye rakha jaata hai — screen ise nahi dikhati, magar
       update par wapas na bhejein to backend ka pichla balance sifr ho jaye. */
    previousAmount:  Number(row.previousAmount) || 0,
    freeTrial:       !!row.freeTrial,
    trialDays:       row.duration ? String(row.duration) : '',
    notes:           String(row.notes ?? '').trim(),
    /* Royalty rows flat rakhe jaate hain — details[] ki shakl bilkul yahi hai,
       is liye save par mapping ka kaam nahi bachta. */
    royaltyRows: (Array.isArray(row.details) ? row.details : []).map((d) => ({
      detailId:   Number(d.id) || 0,
      classID:    Number(d.classID) || 0,
      className:  '',                        // grades load hone par bhar jaata hai
      headID:     Number(d.headID) || 0,
      headName:   String(d.headName ?? ''),
      headAmount: Number(d.headAmount) || 0,
      pct:        Number(d.reqPercentage) || 0,
    })),
  }
}

/* ── Screen ka setup → API body ──
   Poora body har call me jaata hai: API `notes` jaisi fields ko required
   rakhta hai (khali chhodne par 400 deta hai), is liye kuch bhi omit nahi
   karte — sirf khali value bhejte hain. */
function toBody(action, branchID, setup = {}, networkID = currentNetworkId()) {
  const formula = setup.formula || 'lumpsum'
  const flags = toApiFlags(formula)
  const rate = parseFloat(setup.perStudentRate) || 0
  const students = parseInt(setup.studentCount, 10) || 0

  const amount =
    formula === 'lumpsum' ? (parseFloat(setup.lumpAmount) || 0)
      : formula === 'perstudent' ? rate
        : 0
  /* Percentage collection-based hai — koi tay-shuda mahana raqam nahi banti. */
  const totalAmount = formula === 'perstudent' ? rate * students : amount

  return {
    action,
    id:             Number(setup.id) || 0,
    branchID:       Number(branchID) || 0,
    ...flags,
    freeTrial:      !!setup.freeTrial,
    duration:       setup.freeTrial ? (parseInt(setup.trialDays, 10) || 0) : 0,
    amount,
    notes:          String(setup.notes ?? ''),
    type:           TYPE,
    networkID:      Number(networkID) || 0,
    totalStudents:  formula === 'perstudent' ? students : 0,
    totalAmount,
    previousAmount: Number(setup.previousAmount) || 0,
    createdBy:      userId(),
    modifiedBy:     userId(),
    details: formula === 'percentage' ? royaltyDetails(setup, branchID, networkID) : [],
  }
}

/* Sirf wohi heads bhejte hain jin par royalty % lagi hai — 0% wale rows
   store karne ka koi faida nahi, aur bara school (20 classes × 5 heads)
   warna har save par 100 khali rows bhejta. */
function royaltyDetails(setup, branchID, networkID) {
  return (setup.royaltyRows || [])
    .filter((r) => Number(r.pct) > 0)
    .map((r) => ({
      /* id hamesha 0: backend har update par royalty rows dobara banata hai
         (purani gira kar) — bheji hui id ko nazarandaaz kar deta hai. Rows
         duplicate nahi hotin, sirf unki ids badal jaati hain. */
      id:                   0,
      schoolPaymentID:      Number(setup.id) || 0,
      networkID:            Number(networkID) || 0,
      branchID:             Number(branchID) || 0,
      classID:              Number(r.classID) || 0,
      headName:             String(r.headName ?? ''),
      headID:               Number(r.headID) || 0,
      reqPercentage:        Number(r.pct) || 0,
      headAmount:           Number(r.headAmount) || 0,
      calculatedHeadAmount: Math.round(((Number(r.headAmount) || 0) * (Number(r.pct) || 0)) / 100),
    }))
}

async function manage(body) {
  const res = await fetch(`${BASE}/manage`, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(friendlyError(json?.message || json?.title) || 'Could not save payment setup')
  }
  return json
}

/* ── Aik hi call do dafa nahi (permissions screen jaisa) ──
   StrictMode har effect do baar chalata hai, aur modal khulte waqt bhi wahi
   branch dobara maangi ja sakti hai. Jab tak aik request chal rahi hai, usi
   key ki dusri request wahi promise share karti hai. */
const inFlight = new Map()

function once(key, fn) {
  const running = inFlight.get(key)
  if (running) return running
  const p = fn().finally(() => inFlight.delete(key))
  inFlight.set(key, p)
  return p
}

/** Aik branch ka payment setup — na ho (ya call nakaam ho) to `null`. */
export function fetchSetup(branchID) {
  if (!branchID) return Promise.resolve(null)
  return once(`setup:${branchID}`, () => fetchSetupNow(branchID))
}

async function fetchSetupNow(branchID) {
  const res = await fetch(`${BASE}/summary?branchId=${branchID}&type=${TYPE}`, {
    headers: { Accept: '*/*' },
  })
  if (!res.ok) return null
  const json = await res.json().catch(() => null)
  /* success:false = is branch ka abhi setup nahi hua — khali row, error nahi. */
  if (!json?.success || !json?.data) return null
  return toSetup(json.data)
}

/**
 * Kai branches ka setup — list ke rows, stats aur filter ke liye.
 *
 * `summary` per-branch hai, is liye ye N calls hain. Table pehle render hoti
 * hai aur har jawab alag se `onResult(branchID, setup)` par aata hai, taake
 * har school ki row apna jawab aate hi bhar jaaye — poori list ka intezaar
 * nahi hota. Aik waqt me 12 se zyada calls nahi, warna bara network (100+
 * schools) browser ki request queue block kar deta.
 */
export function fetchSetupEach(branchIDs, onResult) {
  return mapLimit(branchIDs, 12, (id) => fetchSetup(id).catch(() => null), onResult)
}

async function mapLimit(ids, limit, worker, onResult) {
  const list = ids || []
  let next = 0
  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    for (;;) {
      const i = next++
      if (i >= list.length) return
      const id = list[i]
      onResult(id, await worker(id))
    }
  })
  await Promise.all(runners)
}

/**
 * Setup save — pehli dafa `insert`, uske baad `update`.
 * Return me taza row aati hai (id sameet), taake screen apna store bhar sake.
 */
export async function saveSetup(branchID, setup) {
  const existingId = Number(setup?.id) || 0
  const json = await manage(toBody(existingId ? 'update' : 'insert', branchID, setup))
  const id = Number(json?.data?.id) || existingId
  /* insert sirf { id } deta hai, poori row nahi — is liye wapas padh lete
     hain: yehi rows details[] ke asli ids bhi le aata hai (agli update par
     wo rows dobara nahi bantin). */
  const fresh = await fetchSetupNow(branchID)
  return fresh || { ...setup, id }
}

/** Setup hata dena — school wapas "Pending Setup" par chala jaata hai. */
export async function deleteSetup(branchID, setup) {
  const id = Number(setup?.id) || 0
  if (!id) return
  await manage(toBody('delete', branchID, { ...setup, id }))
}

/* ═══════════════════════════════════════════════════════════════════
   CHALLANS — payment ledger
     POST {sa}/api/AHM_School_Payments/manage_payment_ledger
       action: get | insert | update | delete

   Setup wale `manage` ke bar-aks yahan `get` MOJOOD hai, aur wo branchID par
   filter karta hai (paymentID par nahi — usay `get` nazarandaaz kar deta
   hai; id par filter chalta hai). Khali branchID (0) kuch nahi deta, is liye
   har branch ki apni call jaati hai.

   `challanType` field `get` par bhi REQUIRED hai — khali string chalti hai,
   bilkul na bhejein to 400 aata hai.

   Har (branchID, type) par backend sirf AIK row rehne deta hai — is liye
   "dobara generate" hamesha update hai, naya row nahi (dekhein saveChallan).

   Ledger me raqam do khaano me hai:
     debit  = is challan ka charge (school par jo bana)
     credit = us ke against jo wasool hua
   `totalAmount` = is challan ka charge + pichla baqaya. Screen `prevDues`
   dikhati hai, wo isi farq se nikalta hai.
   ═══════════════════════════════════════════════════════════════════ */

const LEDGER_URL = `${BASE}/manage_payment_ledger`

/* API `2026-09-10T00:00:00` deti hai, screen `2026-09-10` par kaam karti hai. */
const toDateInput = (v) => (v ? String(v).slice(0, 10) : '')
const toApiDate = (v) => (v ? `${String(v).slice(0, 10)}T00:00:00` : null)

function ledgerBody(action, { id = 0, paymentID = 0, branchID = 0, dueDate = '', creationDate = '', challanType = 'monthly', amount = 0, received = 0, total = 0 } = {}, networkID = currentNetworkId()) {
  return {
    action,
    id:           Number(id) || 0,
    paymentID:    Number(paymentID) || 0,
    branchID:     Number(branchID) || 0,
    dueDate:      toApiDate(dueDate),
    creationDate: toApiDate(creationDate),
    challanType:  challanType || 'monthly',
    debit:        Number(amount) || 0,
    credit:       Number(received) || 0,
    networkID:    Number(networkID) || 0,
    totalAmount:  Number(total) || 0,
    type:         TYPE,
    createdBy:    userId(),
    modifiedBy:   userId(),
  }
}

async function ledger(body) {
  const res = await fetch(LEDGER_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(friendlyError(json?.message || json?.title) || 'Challan request failed')
  }
  return json
}

/** Ledger row → screen ka challan object. */
function toChallan(row) {
  const amount = Number(row.debit) || 0
  const total = Number(row.totalAmount) || amount
  return {
    id:        Number(row.id) || 0,
    paymentID: Number(row.paymentID) || 0,
    amount,
    /* Pichla baqaya alag store nahi hota — total me se is challan ka charge
       nikal kar milta hai. Manfi kabhi nahi dikhana. */
    prevDues:  Math.max(0, total - amount),
    total,
    received:  Number(row.credit) || 0,
    dueDate:   toDateInput(row.dueDate),
    createdOn: toDateInput(row.creationDate || row.createdAt),
    challanType: String(row.challanType || 'monthly'),
  }
}

/**
 * Aik branch ka mojooda challan — na ho to `null`.
 *
 * Backend aik hi row rakhta hai, magar `get` phir bhi array deta hai. Sab se
 * naya (sab se bari id) liya jaata hai — agar kabhi wo pabandi hat gayi to ye
 * khud-ba-khud aakhri challan dikhata rahega.
 */
export function fetchChallan(branchID) {
  if (!branchID) return Promise.resolve(null)
  return once(`challan:${branchID}`, async () => {
    const json = await ledger(ledgerBody('get', { branchID, challanType: '' }))
    const rows = Array.isArray(json?.data) ? json.data : []
    if (!rows.length) return null
    const latest = rows.reduce((a, b) => ((Number(b.id) || 0) > (Number(a.id) || 0) ? b : a))
    return toChallan(latest)
  })
}

/** Kai branches ke challans — setup ki tarah background me, 12 at a time. */
export function fetchChallanEach(branchIDs, onResult) {
  return mapLimit(branchIDs, 12, (id) => fetchChallan(id).catch(() => null), onResult)
}

/**
 * Challan banana / dobara banana.
 *
 * Backend har (branchID, type) par SIRF AIK ledger row rehne deta hai —
 * dusra insert "A ledger entry for this BranchID and Type already exists"
 * de kar rad ho jaata hai. Is liye mojood ho to wahi row `update` hoti hai.
 *
 * Agar screen ka data basi ho (dusra tab, ya wo challan jo abhi load hi nahi
 * hua tha) to insert isi paighaam par gir sakta hai — us soorat me row taza
 * padh kar update par palat jaate hain, taake user ko be-wajah error na mile.
 */
export async function saveChallan(branchID, { paymentID, amount, prevDues = 0, dueDate, existingId = 0, createdOn }) {
  const total = (Number(amount) || 0) + (Number(prevDues) || 0)
  const payload = {
    id: existingId,
    paymentID,
    branchID,
    dueDate,
    creationDate: createdOn || new Date().toISOString().slice(0, 10),
    amount,
    total,
  }

  try {
    await ledger(ledgerBody(existingId ? 'update' : 'insert', payload))
  } catch (err) {
    if (existingId || !/already exists/i.test(err?.message || '')) throw err
    const current = await fetchChallanNow(branchID)
    if (!current?.id) throw err
    await ledger(ledgerBody('update', { ...payload, id: current.id }))
  }
  /* Wapas padh lete hain taake id aur backend ke apne defaults sahi aayen. */
  return fetchChallanNow(branchID)
}

async function fetchChallanNow(branchID) {
  const json = await ledger(ledgerBody('get', { branchID, challanType: '' }))
  const rows = Array.isArray(json?.data) ? json.data : []
  if (!rows.length) return null
  return toChallan(rows.reduce((a, b) => ((Number(b.id) || 0) > (Number(a.id) || 0) ? b : a)))
}

/** Challan hata dena — school wapas "Not Generated" par chala jaata hai. */
export async function deleteChallan(challan) {
  const id = Number(challan?.id) || 0
  if (!id) return
  await ledger(ledgerBody('delete', { id, challanType: '' }))
}

/* ═══════════════════════════════════════════════════════════════════
   RECEIVING — school se wasooli
     POST {sa}/api/AHM_School_Payments/manage_payment_receiving
       action: get | insert | update | delete

   Ledger ki tarah `get` mojood hai aur `currentBranchID` par filter karta
   hai (branchID nahi — is table me khana `currentBranchID` kehlata hai).

   AHEM: yahan bhi har (currentBranchID, type) par SIRF AIK row banti hai.
   Yaani API har adaigi ka alag record NAHI rakhti — aik hi row chalte
   hisaab ki soorat me rehti hai:
     receivingAmount  = ab tak kul jitna wasool hua
     remainingAmount  = netPayable − receivingAmount
     receivingDate / paymentVia = AAKHRI adaigi ki tafseel
   Is liye nayi adaigi purani raqam me jama ho kar `update` jaati hai, naya
   row nahi banta (dekhein saveReceiving).

   networkID har call me jaati hai — wasooli usi network ke khaate me lagti
   hai jis se user logged in hai.
   ═══════════════════════════════════════════════════════════════════ */

const RECV_URL = `${BASE}/manage_payment_receiving`

function recvBody(action, r = {}, networkID = currentNetworkId()) {
  const now = new Date()
  return {
    action,
    id:              Number(r.id) || 0,
    schoolPaymentID: Number(r.schoolPaymentID) || 0,
    paymentLedgerID: Number(r.paymentLedgerID) || 0,
    currentBranchID: Number(r.branchID) || 0,
    /* Kis mahine ki wasooli hai — adaigi ki tareekh se li jaati hai. */
    month:           Number(r.month) || (r.date ? Number(String(r.date).slice(5, 7)) : now.getMonth() + 1),
    year:            Number(r.year) || (r.date ? Number(String(r.date).slice(0, 4)) : now.getFullYear()),
    payableAmount:   Number(r.payableAmount) || 0,
    discount:        Number(r.discount) || 0,
    netPayable:      Number(r.netPayable) || 0,
    receivingAmount: Number(r.receivedAmount) || 0,
    remainingAmount: Number(r.remainingAmount) || 0,
    receivingDate:   toApiDate(r.date),
    networkID:       Number(networkID) || 0,
    paymentVia:      String(r.via || ''),
    type:            TYPE,
    createdBy:       userId(),
    modifiedBy:      userId(),
  }
}

async function receiving(body) {
  const res = await fetch(RECV_URL, {
    method: 'POST',
    headers: { Accept: '*/*', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(friendlyError(json?.message || json?.title) || 'Receiving request failed')
  }
  return json
}

/** API row → screen ka receiving object. */
function toReceiving(row) {
  return {
    id:              Number(row.id) || 0,
    schoolPaymentID: Number(row.schoolPaymentID) || 0,
    paymentLedgerID: Number(row.paymentLedgerID) || 0,
    payableAmount:   Number(row.payableAmount) || 0,
    discount:        Number(row.discount) || 0,
    netPayable:      Number(row.netPayable) || 0,
    receivedAmount:  Number(row.receivingAmount) || 0,
    remainingAmount: Number(row.remainingAmount) || 0,
    via:             String(row.paymentVia || ''),
    date:            toDateInput(row.receivingDate),
    month:           Number(row.month) || 0,
    year:            Number(row.year) || 0,
  }
}

async function fetchReceivingNow(branchID) {
  const json = await receiving(recvBody('get', { branchID }))
  const rows = Array.isArray(json?.data) ? json.data : []
  if (!rows.length) return null
  return toReceiving(rows.reduce((a, b) => ((Number(b.id) || 0) > (Number(a.id) || 0) ? b : a)))
}

/** Aik branch ka receiving record — na ho to `null`. */
export function fetchReceiving(branchID) {
  if (!branchID) return Promise.resolve(null)
  return once(`recv:${branchID}`, () => fetchReceivingNow(branchID))
}

/** Kai branches ke receiving records — background me, 12 at a time. */
export function fetchReceivingEach(branchIDs, onResult) {
  return mapLimit(branchIDs, 12, (id) => fetchReceiving(id).catch(() => null), onResult)
}

/**
 * Nayi adaigi darj karna.
 *
 * `receivedAmount` chalta hisaab hai (purani + nayi), is liye screen ise
 * pehle hi jama kar ke bhejti hai. Row mojood ho to update, warna insert —
 * aur ledger ki tarah yahan bhi insert "already exists" par gire to taza
 * padh kar update par palat jaate hain (basi state / doosra tab).
 */
export async function saveReceiving(branchID, payload) {
  const body = { ...payload, branchID }
  const existingId = Number(payload?.id) || 0
  try {
    await receiving(recvBody(existingId ? 'update' : 'insert', body))
  } catch (err) {
    if (existingId || !/already exists/i.test(err?.message || '')) throw err
    const current = await fetchReceivingNow(branchID)
    if (!current?.id) throw err
    await receiving(recvBody('update', { ...body, id: current.id }))
  }
  return fetchReceivingNow(branchID)
}

/** Receiving record hata dena — school wapas "koi adaigi nahi" par. */
export async function deleteReceiving(recv) {
  const id = Number(recv?.id) || 0
  if (!id) return
  await receiving(recvBody('delete', { id }))
}

/* ── Classes + fee heads (Percentage formula ke liye) ──
   Har school apne fee heads khud rakhta hai aur unhe apni marzi ka naam deta
   hai, aur heads class se class alag hote hain — is liye royalty % school ke
   apne asli heads par lagti hai, kisi tay-shuda list par nahi. */

/**
 * Aik branch ki classes, har class ke apne fee heads ke sath.
 * Shape: [{ id, name, heads: [{ headID, name, amount }] }]
 *
 * Jis class ka koi fee head set nahi, wo bhi list me rehti hai (khali) —
 * taake head office ko nazar aaye ke us class ka structure abhi banna hai.
 */
export async function fetchBranchClasses(branchID) {
  if (!branchID) return []
  return once(`classes:${branchID}`, async () => {
    const res = await fetch(`${ERP_API_BASE}/api/LaunchSetup/get-grades-by-branch/${branchID}`, {
      headers: { Accept: '*/*' },
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || 'Could not load this school’s classes')
    }
    return (Array.isArray(json.data) ? json.data : []).map((g) => ({
      id:   Number(g.id) || 0,
      name: String(g.name ?? '').trim() || `Class #${g.id}`,
      heads: (Array.isArray(g.feeHeads) ? g.feeHeads : []).map((h) => ({
        headID: Number(h.feeStructureID) || 0,
        name:   String(h.headName ?? '').trim(),
        amount: Number(h.amount) || 0,
      })),
    }))
  })
}
