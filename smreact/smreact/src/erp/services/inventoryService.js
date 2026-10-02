import { buildUrl, apiMessage, resolveMediaUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   Inventory Module — real API wiring.

   All calls go through buildUrl() (same host convention as every other
   service; prod proxies through IIS → alphaapi). Verified live against
   the Inventory controller:

     POST   /api/Inventory/manage  action:get              → items (active/inactive)
     GET    /api/Inventory/list?branchId=&isPos=true        → POS products
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
   description, image, barcode — so fields irrelevant to a product vs an
   item are sent as "-". discountType on save must be Amount / Percentage.
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
const todayISO = () => new Date().toISOString().slice(0, 10);

/* A placeholder ("-") the API stored for an irrelevant field reads back as
   empty in the UI. */
const clean = (v) => (v && v !== '-' ? v : '');
const nz    = (v, fallback = '-') => {
  const s = (v == null ? '' : String(v)).trim();
  return s || fallback;
};

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
      price: Number(li.currentSalePrice ?? li.itemAmount) || 0,
    })),
    subtotal: Number(r.subTotal) || 0,
    discount: Number(r.discountAmount) || 0,
    discType: r.discountType === 'Percentage' ? 'pct' : 'rs',
    total:    Number(r.totalAmount) || 0,
    _raw:     r,
  };
}

/* ─── READ APIs ─── */

/* Items (isPOS false) /manage action:get se — isActive true + false dono.
   Server har call sirf usi status ki rows deta hai; id par dedupe taake
   kabhi overlap ho to item double na ho. */
export async function getInvItems() {
  const [activeJson, inactiveJson] = await Promise.all([
    postJson('manage', inventoryBody({ active: true },  { action: 'get', isPOS: false }), 'Could not load inventory items'),
    postJson('manage', inventoryBody({ active: false }, { action: 'get', isPOS: false }), 'Could not load inventory items'),
  ]);
  const byId = new Map();
  [...(activeJson.data || []), ...(inactiveJson.data || [])].forEach((r) => { if (r && !byId.has(r.id)) byId.set(r.id, r); });
  return [...byId.values()].map(mapItem);
}

export async function getInvProducts() {
  const json = await readJson(`${BASE}/list?branchId=${branchId()}&isPos=true`);
  return (json.data || []).map(mapProduct);
}

export async function getInvSales() {
  const json = await readJson(`${BASE}/list-sales?branchId=${branchId()}`);
  return (json.data || []).map(mapSale);
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
    branchID:        branchId(),
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
    barcode:         nz(p.barcode),
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
  const action = item.id ? 'update' : 'insert';
  return postJson('manage', inventoryBody(item, { action, isPOS: false }), 'Could not save item');
}

/* Permanent delete of an inventory item (action=delete on manage). */
export async function deleteInvItem(item) {
  const body = inventoryBody({ ...item, active: false }, { action: 'delete', isPOS: false });
  return postJson('manage', body, 'Could not delete item');
}

/* Shop product — add / edit. */
export async function saveInvProduct(product) {
  const action = product.id ? 'update' : 'insert';
  return postJson('manage', inventoryBody(product, { action, isPOS: true }), 'Could not save product');
}

export async function deleteInvProduct(product) {
  const body = inventoryBody({ ...product, active: false }, { action: 'delete', isPOS: true });
  return postJson('manage', body, 'Could not delete product');
}

/* Record a POS sale. `cart` lines carry { id, name, price, qty, cat?, barcode? }.
   Stock is reduced server-side; the caller re-fetches products + sales after. */
export async function saveInvSale({ cart = [], buyer, discAmount = 0, discType = 'rs', subtotal = 0, total = 0 }) {
  const b = branchId();
  const body = {
    id:             0,
    branchID:       b,
    buyerName:      (buyer && buyer.trim()) || 'Walk-in',
    discount:       Number(discAmount) || 0,
    discountType:   discType === 'pct' ? 'Percentage' : 'Amount',
    discountAmount: Number(discAmount) || 0,
    subTotal:       Number(subtotal) || 0,
    items:          cart.reduce((a, c) => a + (Number(c.qty) || 0), 0),
    totalAmount:    Number(total) || 0,
    createdBy:      userId(),
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
  return postJson('save', body, 'Could not save sale');
}
