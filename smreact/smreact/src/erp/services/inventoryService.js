import { buildUrl, apiMessage, resolveMediaUrl, approvalPending } from '../../utils/apiConfig';

/* Approvals: asset/product insert/update/delete (manage) pending-approval
   info nested `approval:{}`, TOP-LEVEL (`pendingApproval, approvalID,
   requestNo`) ya `data[0]` ke andar de sakta hai — teeno check. Pending ho
   to { approvalId, requestNo, message } warna null (change apply ho gaya). */
export function invPendingInfo(json) {
  if (!json || typeof json !== 'object') return null;
  const inner = Array.isArray(json.data) ? json.data[0] : (json.data && typeof json.data === 'object' ? json.data : null);
  const isFlag = (v) => v === true || v === 'true' || v === 1;
  const src = [json, inner].find(o => o && (approvalPending(o) || isFlag(o.pendingApproval ?? o.PendingApproval)));
  if (!src) return null;
  const ap = src.approval || src.Approval || src;
  return {
    approvalId: ap.approvalID ?? ap.ApprovalID ?? ap.approvalId ?? null,
    requestNo: ap.requestNo ?? ap.RequestNo ?? ap.requestNumber ?? null,
    message: apiMessage(json) || apiMessage(inner) || null,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Inventory Module — real API wiring.

   All calls go through buildUrl() (same host convention as every other
   service; prod proxies through IIS → alphaapi). Verified live against
   the Inventory controller:

     POST   /api/Inventory/manage  action:get isPOS:false  → items (active/inactive)
     POST   /api/Inventory/manage  action:get isPOS:true isActive:true → POS products
     GET    /api/Inventory/list-sales?branchId=&from&to     → POS sales
     POST   /api/Inventory/manage   (MdlAHM_Branch_Inventory)  add/edit/delete
     POST   /api/Inventory/save     (MdlInventorySale)         record a sale
     DELETE /api/Inventory/delete/{id}?modifiedBy=            delete a SALE

   isPOS=false → physical inventory items. isPOS=true → shop products.
   Items ka GET /manage action:get se jata hai: server isActive par filter
   karta hai (isActive:true → active, false → inactive). Page ko dono chahiye,
   is liye dono laa kar merge karte hain — /list?isPos=false inactive rows
   theek se nahi laata tha.
   A shop SALE (save) reduces product stock server-side, so the UI must
   re-fetch products after a sale, never decrement locally.

   Quirk: the server [Required]s these strings as NON-EMPTY on manage —
   itemName, itemCategory, inventoryNumber, condition, status, location,
   description, image — so fields irrelevant to a product vs an item are
   sent as "-". EXCEPTION barcode: POS product (isPOS true) ka asli barcode;
   inventory item (isPOS false) ke liye "" (empty) — yahan "-" error deta hai.
   discountType on save must be Amount / Percentage.
   ═══════════════════════════════════════════════════════════════════ */

const BASE = '/api/Inventory';

const branchId = () => Number(sessionStorage.getItem('branchID')) || 0;
const userId   = () => Number(sessionStorage.getItem('UserID'))  || 0;

const authHeaders = () => {
  const token = sessionStorage.getItem('token');
  return {
    Accept: '*/*',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/* ISO datetime → yyyy-MM-dd for <input type="date"> / display. */
const dateOnly = (v) => {
  if (!v) return '';
  const m = String(v).match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : '';
};
/* Local (PKT) date — toISOString() UTC deta hai, raat 12–5 baje pichla din aata tha. */
const todayISO = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/* A placeholder ("-") the API stored for an irrelevant field reads back as
   empty in the UI. */
const clean = (v) => (v && v !== '-' ? v : '');
const nz    = (v, fallback = '-') => {
  const s = (v == null ? '' : String(v)).trim();
  return s || fallback;
};

/* ─── Short read cache ───
   Page load par ek hi data kai jagah se maanga jata tha (items 2× + categories
   andar se items 2× dobara, dev StrictMode har effect double) → /manage ~10×.
   Ab same key ki request ek hi baar jaati hai (in-flight share + 20s reuse).
   Har write (save/delete/sale/receive) apni key saaf karta hai → refetch taaza. */
const READ_TTL = 20000;
const readCache = new Map();
function cachedRead(key, fn) {
  const k = `${branchId()}:${key}`;
  const hit = readCache.get(k);
  if (hit && Date.now() - hit.t < READ_TTL) return hit.p;
  const p = fn().catch((e) => { readCache.delete(k); throw e; });
  readCache.set(k, { t: Date.now(), p });
  return p;
}
function invalidateReads(...keys) {
  [...readCache.keys()].forEach((k) => {
    if (keys.some((key) => k.endsWith(`:${key}`))) readCache.delete(k);
  });
}
/* Explicit reload (Retry / refresh / approval aaya) → cache chhod kar taaza. */
export function invalidateInvReads(...keys) { invalidateReads(...keys); }

async function readJson(url) {
  const res  = await fetch(buildUrl(url), { headers: authHeaders() });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load inventory data');
  }
  return json;
}

async function postJson(path, body, failMsg) {
  const res  = await fetch(buildUrl(`${BASE}/${path}`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(apiMessage(json) || failMsg);
  return json;
}

/* ─── API row → UI shapes (kept identical to the old mock shapes so the
       component reads them unchanged) ─── */
function mapItem(r) {
  return {
    id:      r.id,
    name:    r.itemName || '',
    cat:     r.itemCategory || '',
    code:    clean(r.inventoryNumber),
    qty:     Number(r.quantity) || 0,
    low:     Number(r.lowStock) || 0,
    date:    dateOnly(r.purchaseDate),
    cond:    r.condition || '',
    status:  r.status || '',
    loc:     clean(r.location),
    desc:    clean(r.description),
    active:  r.isActive !== false,
    img:     clean(r.image) ? resolveMediaUrl(r.image) : null,
    history: [],          // API has no per-item history timeline
    _raw:    r,
  };
}

function mapProduct(r) {
  return {
    id:      r.id,
    name:    r.itemName || '',
    cat:     r.itemCategory || '',
    barcode: clean(r.barcode),
    stock:   Number(r.stockQuantity) || 0,
    low:     Number(r.lowStock) || 0,
    cost:    Number(r.purchasePrice) || 0,
    price:   Number(r.salePrice) || 0,
    img:     clean(r.image) ? resolveMediaUrl(r.image) : null,
    _raw:    r,
  };
}

function mapSale(r) {
  return {
    no:       `RCP-${r.id}`,
    id:       r.id,
    date:     dateOnly(r.createdAt),
    buyer:    r.buyerName || 'Walk-in',
    by:       '—',
    lines:    (r.saleItems || []).map((li) => ({
      name:  li.itemName || '',
      qty:   Number(li.quantity) || 0,
      /* Jo daam US waqt liya gaya (itemAmount) — product ka ABHI wala daam
         (currentSalePrice) nahi. currentSalePrice product table se juda hota
         hai aur baad me daam badalne par purani sale bhi naye daam par ginti
         thi: ek hi Pencil 100 par bika aur 90 par, magar dono 90 (current)
         par gin kar P&L 180 dikhata tha, 190 nahi. itemAmount sale ke waqt ka
         mehfooz unit daam hai — receipt aur reports dono wahi dikhaayein. */
      price: Number(li.itemAmount ?? li.currentSalePrice) || 0,
    })),
    subtotal: Number(r.subTotal) || 0,
    discount: Number(r.discountAmount) || 0,
    discType: r.discountType === 'Percentage' ? 'pct' : 'rs',
    total:    Number(r.totalAmount) || 0,
    /* Payment fields (list-sales). Purani sales me ye null aate hain → paid
       undefined rehta hai aur UI puri raqam paid maanta hai (purana behaviour). */
    studentId: r.isStudent ? (Number(r.studentID) || 0) : 0,
    ...(r.receiveAmount != null ? { paid: Number(r.receiveAmount) || 0 } : {}),
    walletId:  Number(r.wallatID) || 0,
    method:    r.paymentMethod || '',
    note:      r.receiptNote || '',
    _raw:     r,
  };
}

/* ─── READ APIs ─── */

/* Items (isPOS false) /manage action:get se — isActive true + false dono.
   Server har call sirf usi status ki rows deta hai; id par dedupe taake
   kabhi overlap ho to item double na ho. */
export async function getInvItems() {
  return (await cachedRead('items', fetchInvItems)).slice();
}
async function fetchInvItems() {
  const [activeJson, inactiveJson] = await Promise.all([
    postJson('manage', inventoryBody({ active: true },  { action: 'get', isPOS: false }), 'Could not load inventory items'),
    postJson('manage', inventoryBody({ active: false }, { action: 'get', isPOS: false }), 'Could not load inventory items'),
  ]);
  const byId = new Map();
  [...(activeJson.data || []), ...(inactiveJson.data || [])].forEach((r) => { if (r && !byId.has(r.id)) byId.set(r.id, r); });
  return [...byId.values()].map(mapItem);
}

/* Products (isPOS true) ab /manage action:get se aate hain — sirf active
   (isActive:true). Pehle GET /list?isPos=true use hoti thi; usay hata diya
   (items ki tarah ab sab kuch manage/get par unified hai). */
export async function getInvProducts() {
  return (await cachedRead('products', fetchInvProducts)).slice();
}
async function fetchInvProducts() {
  /* Products bhi items jaise branch-level: branchID = branch, networkID = null,
     action:get isPOS:true, sirf active. */
  const json = await postJson(
    'manage',
    inventoryBody({ active: true }, { action: 'get', isPOS: true }),
    'Could not load products',
  );
  return (json.data || []).map(mapProduct);
}

export async function getInvSales() {
  return (await cachedRead('sales', async () => {
    const json = await readJson(`${BASE}/list-sales?branchId=${branchId()}`);
    return (json.data || []).map(mapSale);
  })).slice();
}

/* Category options for the add/edit pickers (input choices, not stored data).
   Merged with whatever categories already exist on the branch's records so
   the list stays truthful to the data. */
const DEFAULT_ITEM_CATS = [
  'Furniture', 'Electronics', 'Appliances', 'Lab Equipment', 'Sports',
  'Books Stock', 'Stationery', 'Office Equipment', 'Security',
  'Teaching Aids', 'Other',
];
export async function getInvCategories() {
  try {
    const items = await getInvItems();
    const fromData = items.map((i) => i.cat).filter(Boolean);
    return Array.from(new Set([...DEFAULT_ITEM_CATS, ...fromData]));
  } catch (e) {
    return DEFAULT_ITEM_CATS;
  }
}

/* Branch identity for receipts/labels/reports — pulled live from the same
   /report-header API the other report modules use. */
export async function getInvSchool() {
  try {
    const res  = await fetch(buildUrl(`/report-header/${branchId()}`), { headers: authHeaders() });
    const json = await res.json().catch(() => null);
    const d    = (json && json.data) || {};
    const name = d.branchName || 'School Mentor';
    const monogram = name.split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0]).join('').toUpperCase() || 'SM';
    return { name, monogram, logo: resolveMediaUrl(d.branchLogo), address: d.address || '' };
  } catch (e) {
    return { name: 'School Mentor', monogram: 'SM', logo: '', address: '' };
  }
}

/* Server assigns ids/receipt numbers now — these remain for API compatibility
   with existing callers but are no longer used to mint local ids. */
export async function getInvNextItemId()    { return 0; }
export async function getInvNextProdId()    { return 0; }
export async function getInvNextReceiptNo() { return 0; }

/* ─── WRITE APIs ─── */

/* Build the full MdlAHM_Branch_Inventory body an item/product needs.
   `isPOS` selects item (false) vs shop product (true); required strings that
   don't apply to that kind are sent as "-". */
function inventoryBody(p, { action, isPOS }) {
  return {
    action,
    id:              p.id || 0,
    /* ERP me sab kuch branch-level: branchID = logged-in branch, networkID = null
       (items aur products dono). Network-level scoping chain frontend me hoti hai. */
    branchID:        branchId(),
    networkID:       null,
    itemName:        nz(p.name, 'Unnamed'),
    itemCategory:    nz(p.cat, 'Other'),
    inventoryNumber: nz(p.code),
    quantity:        Number(p.qty) || 0,
    purchaseDate:    p.date || todayISO(),
    condition:       nz(p.cond, isPOS ? '-' : 'Good'),
    status:          nz(p.status, isPOS ? '-' : 'In Use'),
    location:        nz(p.loc),
    description:     nz(p.desc),
    image:           nz(typeof p.img === 'string' ? p.img : ''),
    /* Barcode: POS product (isPOS true) ka asli barcode jata hai; inventory
       item (isPOS false) ke liye "" (empty) — "-" server par error deta hai. */
    barcode:         isPOS ? String(p.barcode || '').trim() : '',
    lowStock:        Number(p.low) || 0,
    stockQuantity:   isPOS ? (Number(p.stock) || 0) : 0,
    purchasePrice:   isPOS ? (Number(p.cost)  || 0) : 0,
    salePrice:       isPOS ? (Number(p.price) || 0) : 0,
    isPOS,
    createdBy:       userId(),
    modifiedBy:      userId(),
    isActive:        p.active !== false,
  };
}

/* Inventory item — add (no id) / edit (id) / soft toggle (pass active). */
export async function saveInvItem(item) {
  invalidateReads('items');
  const action = item.id ? 'update' : 'insert';
  return postJson('manage', inventoryBody(item, { action, isPOS: false }), 'Could not save item').finally(() => invalidateReads('items'));
}

/* Permanent delete of an inventory item (action=delete on manage). */
export async function deleteInvItem(item) {
  invalidateReads('items');
  const body = inventoryBody({ ...item, active: false }, { action: 'delete', isPOS: false });
  return postJson('manage', body, 'Could not delete item').finally(() => invalidateReads('items'));
}

/* Shop product — add / edit. Branch-level (items jaisa): branchID = branch,
   networkID = null. Barcode asli value jata hai (isPOS true). */
export async function saveInvProduct(product) {
  invalidateReads('products');
  const action = product.id ? 'update' : 'insert';
  return postJson('manage', inventoryBody(product, { action, isPOS: true }), 'Could not save product').finally(() => invalidateReads('products'));
}

export async function deleteInvProduct(product) {
  invalidateReads('products');
  const body = inventoryBody({ ...product, active: false }, { action: 'delete', isPOS: true });
  return postJson('manage', body, 'Could not delete product').finally(() => invalidateReads('products'));
}

/* Record a POS sale. `cart` lines carry { id, name, price, qty, cat?, barcode? }.
   Stock is reduced server-side; the caller re-fetches products + sales after.

   Payment (MdlInventorySale):
     Walk-in            → isStudent:false, studentID:null, receiveAmount = total
     Student · Full     → isStudent:true,  studentID,      receiveAmount = total
     Student · Partial  → isStudent:true,  studentID,      receiveAmount = paid now
                          (0 … total-1) — baqi (total − receiveAmount) student ka
                          shop credit hai, backend khud hisaab karta hai.
   wallatID (server ki spelling) = jis wallet me paisa aaya; paid 0 ho to null.
   `paid` na diya jaye to puri raqam received maani jati hai (purana flow). */
export async function saveInvSale({
  cart = [], buyer, discAmount = 0, discType = 'rs', subtotal = 0, total = 0,
  studentId = null, paid = null, walletId = null, paymentMethod = 'Cash', receiptNote = '',
}) {
  const b = branchId();
  const grand       = Number(total) || 0;
  const isStudent   = Number(studentId) > 0;
  const receiveAmt  = paid == null ? grand : Math.max(0, Math.min(grand, Number(paid) || 0));
  const body = {
    id:             0,
    branchID:       b,
    buyerName:      (buyer && buyer.trim()) || 'Walk-in',
    discount:       Number(discAmount) || 0,
    discountType:   discType === 'pct' ? 'Percentage' : 'Amount',
    discountAmount: Number(discAmount) || 0,
    subTotal:       Number(subtotal) || 0,
    items:          cart.reduce((a, c) => a + (Number(c.qty) || 0), 0),
    totalAmount:    grand,
    createdBy:      userId(),
    isStudent,
    studentID:      isStudent ? Number(studentId) : null,
    wallatID:       receiveAmt > 0 && Number(walletId) > 0 ? Number(walletId) : null,
    receiveAmount:  receiveAmt,
    paymentMethod:  receiveAmt > 0 ? (paymentMethod || 'Cash') : null,
    receiveDate:    receiveAmt > 0 ? todayISO() : null,
    receiptNote:    (receiptNote || '').trim() || null,
    saleItems:      cart.map((c) => ({
      id: 0, masterID: 0, branchID: b,
      itemID:          c.id,
      quantity:        Number(c.qty) || 0,
      itemAmount:      Number(c.price) || 0,
      totalAmount:     (Number(c.price) || 0) * (Number(c.qty) || 0),
      itemName:        nz(c.name, 'Item'),
      itemCategory:    nz(c.cat),
      barcode:         nz(c.barcode),
      inventoryNumber: '-',
      image:           '-',
      currentSalePrice: Number(c.price) || 0,
      createdBy:       userId(),
    })),
  };
  /* Sale stock ghatati hai + credit badalta hai → teeno taaza laao. */
  invalidateReads('products', 'sales', 'credits');
  return postJson('save', body, 'Could not save sale').finally(() => invalidateReads('products', 'sales', 'credits'));
}


/* ─── POS student credit (server) ───
     GET  /api/student-credit/by-branch/{branchId}
          → one row per student (all their credit sales merged):
            { studentID, firstName, lastName, fatherName, className, sectionName,
              saleCount, creditGiven (sum of sale totals), receivedAmount (all
              money in, counter + later), outstanding, lastActivity,
              receipts:[{ id, saleMasterID, receivedAmount, receivedDate,
                          paymentMethod, note, wallatID, createdBy }] }
            saleMasterID set   → paid at the counter with that sale
            saleMasterID empty → later credit payment (/receive)
     POST /api/student-credit/receive  (StudentCreditReceiveRequest) */
export async function getStudentCredits() {
  return (await cachedRead('credits', fetchStudentCredits)).slice();
}
async function fetchStudentCredits() {
  const res  = await fetch(buildUrl(`/api/student-credit/by-branch/${branchId()}`), { headers: authHeaders() });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) throw new Error(apiMessage(json) || 'Could not load student credit');
  return Array.isArray(json?.data) ? json.data : [];
}

export async function receiveStudentCredit({ studentId, amount, date, walletId, method, note }) {
  invalidateReads('credits');
  const res = await fetch(buildUrl('/api/student-credit/receive'), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      branchID:       branchId(),
      studentID:      Number(studentId) || 0,
      receivedAmount: Number(amount) || 0,
      receivedDate:   date || todayISO(),
      wallatID:       Number(walletId) || 0,
      paymentMethod:  method || 'Cash',
      note:           (note || '').trim() || null,
      userID:         userId(),
    }),
  });
  const json = await res.json().catch(() => null);
  invalidateReads('credits');
  if (!res.ok || json?.success === false) throw new Error(apiMessage(json) || 'Could not save the credit payment');
  return json;
}

/* ─── POS sale meta (session) ───
   list-sales abhi student / paid fields null deta hai, is liye is session me
   bani sale ka student / paid / balance yahan rakhte hain (Sales History ke
   liye). Student credit + credit receipts ab server se aate hain
   (getStudentCredits / receiveStudentCredit). */
const posSessionSaleMeta = {};
export function getPosSaleMeta() { return posSessionSaleMeta; }
export function setPosSaleMeta(no, meta) { posSessionSaleMeta[no] = meta; }
