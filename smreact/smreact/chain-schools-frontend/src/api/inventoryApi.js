/* ═══════════════════════════════════════════════════════════════════
   NETWORK INVENTORY — chain (head-office) ka apna inventory, POS products
   aur sales, sab networkID ki base par (branchID null).

   Wahi Inventory controller jo ERP use karta hai; farq sirf itna ke school
   ki rows branchID se bandhi hoti hain aur chain ki rows networkID se — is
   liye har row me branchID: null aur networkID = logged-in network jata hai.

     POST   /api/Inventory/manage  action:get               items (active/inactive)
     GET    /api/Inventory/list?networkId=&isPos=true        POS products
     GET    /api/Inventory/list-sales?networkId=             POS sales
     POST   /api/Inventory/manage   (MdlAHM_Branch_Inventory)  add/edit/delete
     POST   /api/Inventory/save     (MdlInventorySale)         record a sale

   Items ka GET ab /manage action:get se jata hai: ye server-side isActive
   par filter karta hai (live-tested) — isActive:true → sirf active, false →
   sirf inactive. Page ko dono chahiye (Active/Inactive tabs), is liye dono
   call kar ke merge karte hain. (Pehle /list?isPos=false tha jo inactive
   rows theek se nahi laata tha.)

   academicsSetupApi ki tarah ye axios client se nahi jata (wo apna token
   lagata hai / 401 par logout) — seedha fetch, ERP base par.

   Quirk: server in strings ko NON-EMPTY [Required] karta hai — itemName,
   itemCategory, inventoryNumber, condition, status, location, description,
   image, barcode — is liye ghair-mutalliqa fields "-" jate hain. save par
   discountType "Amount" / "Percentage" hona chahiye. Sale stock server-side
   kam karta hai, is liye sale ke baad dobara fetch karte hain.
   ═══════════════════════════════════════════════════════════════════ */

import { ERP_API_BASE } from '@/config/env'
import { getStoredUser } from '@/auth/tokenStorage'
import { currentNetworkId } from './networkSchoolsApi'

const BASE = `${ERP_API_BASE}/api/Inventory`

const currentUserId = () => {
  const u = getStoredUser()
  return Number(u?.id ?? u?.userID ?? u?.userId) || 0
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { Accept: '*/*', 'Content-Type': 'application/json' } : { Accept: '*/*' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) throw new Error(json?.message || json?.title || 'Request failed')
  return json
}

const rows = (json) => (Array.isArray(json?.data) ? json.data : [])
const dateOnly = (v) => { const m = String(v || '').match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : '' }
const todayISO = () => new Date().toISOString().slice(0, 10)
const clean = (v) => (v && v !== '-' ? v : '')
const nz = (v, f = '-') => { const s = (v == null ? '' : String(v)).trim(); return s || f }

const DEFAULT_CATS = [
  'Furniture', 'Electronics', 'Appliances', 'Lab Equipment', 'Sports',
  'Books Stock', 'Stationery', 'Office Equipment', 'Security', 'Teaching Aids', 'Other',
]

/* ─── API row → chain UI shapes ─── */
const mapItem = (r) => ({
  id: r.id,
  name: r.itemName || '',
  cat: r.itemCategory || '',
  code: clean(r.inventoryNumber),
  qty: Number(r.quantity) || 0,
  low: Number(r.lowStock) || 0,
  date: dateOnly(r.purchaseDate),
  cond: r.condition || 'Good',
  status: r.status || 'In Use',
  loc: clean(r.location),
  desc: clean(r.description),
  /* Network list kabhi camelCase (isActive) aur kabhi PascalCase (IsActive)
     bhej sakta hai — dono padho, warna inactivated item bhi active dikhta hai. */
  active: (r.isActive ?? r.IsActive) !== false,
  history: [],
})

const mapProduct = (r) => ({
  id: r.id,
  name: r.itemName || '',
  cat: r.itemCategory || '',
  barcode: clean(r.barcode),
  stock: Number(r.stockQuantity) || 0,
  low: Number(r.lowStock) || 0,
  cost: Number(r.purchasePrice) || 0,
  price: Number(r.salePrice) || 0,
})

const mapSale = (r) => ({
  no: `RCP-${r.id}`,
  id: r.id,
  date: dateOnly(r.createdAt),
  buyer: r.buyerName || 'Walk-in',
  by: '—',
  total: Number(r.totalAmount) || 0,
  lines: (r.saleItems || []).map((li) => ({
    name: li.itemName || '',
    qty: Number(li.quantity) || 0,
    price: Number(li.currentSalePrice ?? li.itemAmount) || 0,
  })),
})

/* Inventory items (isPOS false) /manage action:get se — isActive true/false
   dono. Server har call sirf usi status ki rows deta hai; id par dedupe
   taake agar kabhi overlap ho to item double na ho. */
function fetchItems(isActive, networkId) {
  return call('/manage', { method: 'POST', body: inventoryBody({ active: isActive }, { action: 'get', isPOS: false, networkId }) })
}

/* Load the whole inventory store the page needs in one go. */
export async function fetchInventory(networkId = currentNetworkId()) {
  if (!networkId) return { items: [], products: [], sales: [], categories: DEFAULT_CATS }
  const [activeJson, inactiveJson, prodJson, salesJson] = await Promise.all([
    fetchItems(true, networkId),
    fetchItems(false, networkId),
    call(`/list?networkId=${networkId}&isPos=true`),
    call(`/list-sales?networkId=${networkId}`).catch(() => ({ data: [] })),
  ])
  const byId = new Map()
  ;[...rows(activeJson), ...rows(inactiveJson)].forEach((r) => { if (r && !byId.has(r.id)) byId.set(r.id, r) })
  const items = [...byId.values()].map(mapItem)
  const products = rows(prodJson).map(mapProduct)
  const sales = rows(salesJson).map(mapSale)
  const categories = Array.from(new Set([...DEFAULT_CATS, ...items.map((i) => i.cat).filter(Boolean)]))
  return { items, products, sales, categories }
}

/* Build a full MdlAHM_Branch_Inventory body (network-level: branchID null). */
function inventoryBody(p, { action, isPOS, networkId }) {
  return {
    action,
    id: p.id || 0,
    branchID: null,
    networkID: Number(networkId) || 0,
    itemName: nz(p.name, 'Unnamed'),
    itemCategory: nz(p.cat, 'Other'),
    inventoryNumber: nz(p.code),
    quantity: Number(p.qty) || 0,
    purchaseDate: p.date || todayISO(),
    condition: nz(p.cond, isPOS ? '-' : 'Good'),
    status: nz(p.status, isPOS ? '-' : 'In Use'),
    location: nz(p.loc),
    description: nz(p.desc),
    image: '-',
    /* Barcode: POS product (isPOS true) ka asli barcode value jata hai; inventory
       item (isPOS false) ke liye "" (empty) — "-" server par error deta hai. */
    barcode: isPOS ? String(p.barcode || '').trim() : '',
    lowStock: Number(p.low) || 0,
    stockQuantity: isPOS ? (Number(p.stock) || 0) : 0,
    purchasePrice: isPOS ? (Number(p.cost) || 0) : 0,
    salePrice: isPOS ? (Number(p.price) || 0) : 0,
    isPOS,
    createdBy: currentUserId(),
    modifiedBy: currentUserId(),
    isActive: p.active !== false,
  }
}

export function saveNetworkItem(item, networkId = currentNetworkId()) {
  return call('/manage', { method: 'POST', body: inventoryBody(item, { action: item.id ? 'update' : 'insert', isPOS: false, networkId }) })
}
export function deleteNetworkItem(item, networkId = currentNetworkId()) {
  return call('/manage', { method: 'POST', body: inventoryBody({ ...item, active: false }, { action: 'delete', isPOS: false, networkId }) })
}
export function saveNetworkProduct(product, networkId = currentNetworkId()) {
  return call('/manage', { method: 'POST', body: inventoryBody(product, { action: product.id ? 'update' : 'insert', isPOS: true, networkId }) })
}
export function deleteNetworkProduct(product, networkId = currentNetworkId()) {
  return call('/manage', { method: 'POST', body: inventoryBody({ ...product, active: false }, { action: 'delete', isPOS: true, networkId }) })
}

/* Record a POS sale. cart lines: { id, name, price, qty, cat?, barcode? }. */
export function saveNetworkSale({ cart = [], buyer, total = 0 }, networkId = currentNetworkId()) {
  const subtotal = cart.reduce((a, c) => a + (Number(c.price) || 0) * (Number(c.qty) || 0), 0)
  const body = {
    id: 0,
    branchID: null,
    networkID: Number(networkId) || 0,
    buyerName: (buyer && buyer.trim()) || 'Walk-in',
    discount: 0,
    discountType: 'Amount',
    discountAmount: 0,
    subTotal: subtotal,
    items: cart.reduce((a, c) => a + (Number(c.qty) || 0), 0),
    totalAmount: Number(total) || subtotal,
    createdBy: currentUserId(),
    saleItems: cart.map((c) => ({
      id: 0, masterID: 0, branchID: null, networkID: Number(networkId) || 0,
      itemID: c.id,
      quantity: Number(c.qty) || 0,
      itemAmount: Number(c.price) || 0,
      totalAmount: (Number(c.price) || 0) * (Number(c.qty) || 0),
      itemName: nz(c.name, 'Item'),
      itemCategory: nz(c.cat),
      barcode: nz(c.barcode),
      inventoryNumber: '-',
      image: '-',
      currentSalePrice: Number(c.price) || 0,
      createdBy: currentUserId(),
    })),
  }
  return call('/save', { method: 'POST', body })
}
