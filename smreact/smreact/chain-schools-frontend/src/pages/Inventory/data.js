/* ═══════════════════════════════════════════════════════════════════
   INVENTORY — school assets, a simple POS shop counter & reports.
   Ported from the ERP design; localStorage-backed demo store.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_inventory'

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const ITEM_STATUSES = ['In Use', 'In Store', 'Under Repair', 'Damaged']
export const CONDITIONS = ['Good', 'Fair', 'Poor']

const SEED = {
  categories: ['Furniture', 'Electronics', 'Appliances', 'Lab Equipment', 'Sports', 'Books Stock', 'Stationery', 'Office Equipment', 'Security', 'Teaching Aids', 'Other'],
  nextItemId: 100, nextProdId: 50, nextReceiptNo: 1018,
  items: [
    { id: 1, name: 'Student Chair', cat: 'Furniture', code: 'INV-CHAIR-001', qty: 120, low: 20, date: '2024-08-12', cond: 'Good', status: 'In Use', loc: 'Classrooms (Block A)', desc: 'Standard wooden student chairs across Block A.', active: true, history: [{ t: 'Item added to inventory', at: '2024-08-12' }, { t: '5 chairs moved to Block B', at: '2025-01-10' }, { t: 'Condition reviewed — Good', at: '2026-02-02' }] },
    { id: 2, name: 'Classroom Table', cat: 'Furniture', code: 'INV-TABLE-014', qty: 60, low: 10, date: '2024-08-12', cond: 'Good', status: 'In Use', loc: 'Classrooms (Block A)', desc: 'Two-seater laminated classroom tables.', active: true, history: [{ t: 'Item added to inventory', at: '2024-08-12' }] },
    { id: 3, name: 'Ceiling Fan', cat: 'Appliances', code: 'INV-FAN-008', qty: 45, low: 8, date: '2024-07-01', cond: 'Good', status: 'In Use', loc: 'Classrooms & Halls', desc: 'Ceiling fans in classrooms and the main hall.', active: true, history: [{ t: 'Item added to inventory', at: '2024-07-01' }, { t: '3 fans sent for repair', at: '2026-03-15' }] },
    { id: 4, name: 'Whiteboard', cat: 'Teaching Aids', code: 'INV-WBRD-003', qty: 12, low: 3, date: '2024-08-20', cond: 'Good', status: 'In Use', loc: 'Classrooms', desc: 'Wall-mounted magnetic whiteboards.', active: true, history: [{ t: 'Item added to inventory', at: '2024-08-20' }] },
    { id: 5, name: 'Desktop Computer', cat: 'Electronics', code: 'INV-COMP-002', qty: 8, low: 2, date: '2025-02-10', cond: 'Good', status: 'In Use', loc: 'Computer Lab', desc: 'Core-i5 desktop systems in the computer lab.', active: true, history: [{ t: 'Item added to inventory', at: '2025-02-10' }, { t: '1 unit under repair', at: '2026-04-22' }] },
    { id: 6, name: 'Laser Printer', cat: 'Office Equipment', code: 'INV-PRNT-001', qty: 3, low: 1, date: '2025-03-05', cond: 'Good', status: 'In Use', loc: 'Admin Office', desc: 'Monochrome laser printers in the admin office.', active: true, history: [{ t: 'Item added to inventory', at: '2025-03-05' }] },
    { id: 7, name: 'Multimedia Projector', cat: 'Electronics', code: 'INV-PROJ-001', qty: 2, low: 1, date: '2025-01-18', cond: 'Good', status: 'In Store', loc: 'Store Room', desc: 'Portable projectors used for presentations.', active: true, history: [{ t: 'Item added to inventory', at: '2025-01-18' }] },
    { id: 8, name: 'CCTV Camera', cat: 'Security', code: 'INV-CCTV-006', qty: 16, low: 4, date: '2024-09-01', cond: 'Good', status: 'In Use', loc: 'Corridors & Gates', desc: 'Dome CCTV cameras covering corridors and gates.', active: true, history: [{ t: 'Item added to inventory', at: '2024-09-01' }] },
    { id: 9, name: 'Microscope', cat: 'Lab Equipment', code: 'INV-MICR-004', qty: 10, low: 3, date: '2025-02-25', cond: 'Fair', status: 'In Use', loc: 'Science Lab', desc: 'Compound microscopes for biology practicals.', active: true, history: [{ t: 'Item added to inventory', at: '2025-02-25' }] },
    { id: 10, name: 'Cricket Kit', cat: 'Sports', code: 'INV-SPRT-007', qty: 4, low: 2, date: '2025-04-02', cond: 'Good', status: 'In Store', loc: 'Sports Store', desc: 'Complete cricket kits — bats, pads and gloves.', active: true, history: [{ t: 'Item added to inventory', at: '2025-04-02' }] },
    { id: 11, name: 'Old Wooden Bench', cat: 'Furniture', code: 'INV-BNCH-009', qty: 6, low: 0, date: '2019-05-10', cond: 'Poor', status: 'Damaged', loc: 'Store Room', desc: 'Old benches retired from service, kept for spare parts.', active: false, history: [{ t: 'Item added to inventory', at: '2019-05-10' }, { t: 'Marked Inactive — damaged beyond repair', at: '2026-01-20' }] },
  ],
  products: [
    { id: 1, name: 'Grade 1 English Book', cat: 'Books', barcode: 'BK-ENG-001', stock: 85, low: 20, cost: 180, price: 250 },
    { id: 2, name: 'School Diary', cat: 'Stationery', barcode: 'ST-DRY-002', stock: 140, low: 30, cost: 90, price: 150 },
    { id: 3, name: 'Notebook (100 pages)', cat: 'Notebooks', barcode: 'NB-100-003', stock: 8, low: 25, cost: 45, price: 70 },
    { id: 4, name: 'Blue Ballpoint Pen', cat: 'Stationery', barcode: 'ST-PEN-004', stock: 300, low: 50, cost: 12, price: 25 },
    { id: 5, name: 'Pencil Box', cat: 'Stationery', barcode: 'ST-PBX-005', stock: 42, low: 15, cost: 120, price: 200 },
    { id: 6, name: 'School Uniform (Shirt)', cat: 'Uniform', barcode: 'UN-SHT-006', stock: 35, low: 10, cost: 450, price: 650 },
    { id: 7, name: 'Eraser', cat: 'Stationery', barcode: 'ST-ERS-007', stock: 5, low: 30, cost: 5, price: 15 },
    { id: 8, name: 'Lead Pencil', cat: 'Stationery', barcode: 'ST-LPN-008', stock: 220, low: 50, cost: 8, price: 20 },
  ],
  sales: [
    { no: 'RCP-1017', date: '2026-05-24', buyer: 'Ahmed Raza — Class 5B', lines: [{ name: 'Notebook (100 pages)', qty: 3, price: 70 }, { name: 'School Diary', qty: 2, price: 150 }, { name: 'Eraser', qty: 1, price: 15 }, { name: 'Lead Pencil', qty: 2, price: 20 }], total: 570, by: 'Front Desk' },
    { no: 'RCP-1016', date: '2026-05-24', buyer: 'Fatima Noor — Class 3A', lines: [{ name: 'Grade 1 English Book', qty: 1, price: 250 }, { name: 'Blue Ballpoint Pen', qty: 2, price: 25 }], total: 300, by: 'Front Desk' },
    { no: 'RCP-1015', date: '2026-05-23', buyer: 'Bilal Hussain — Class 8C', lines: [{ name: 'School Uniform (Shirt)', qty: 1, price: 650 }, { name: 'Pencil Box', qty: 1, price: 200 }], total: 850, by: 'Sana Malik' },
    { no: 'RCP-1014', date: '2026-05-22', buyer: 'Walk-in', lines: [{ name: 'Blue Ballpoint Pen', qty: 5, price: 25 }], total: 125, by: 'Front Desk' },
    { no: 'RCP-1013', date: '2026-05-20', buyer: 'Hira Khan — Class 2B', lines: [{ name: 'Notebook (100 pages)', qty: 4, price: 70 }, { name: 'School Diary', qty: 1, price: 150 }], total: 430, by: 'Front Desk' },
  ],
}

export function loadInv() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.items) return d } catch { /* reseed */ }
  localStorage.setItem(KEY, JSON.stringify(SEED))
  return JSON.parse(JSON.stringify(SEED))
}
export const saveInv = (d) => localStorage.setItem(KEY, JSON.stringify(d))

export const rs = (n) => 'Rs ' + Number(n || 0).toLocaleString()
export const num = (n) => Number(n || 0).toLocaleString()
export const todayISO = () => new Date().toISOString().slice(0, 10)
export function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) } catch { return d } }

/* Auto inventory code from a name + sequence number. */
export function nextItemCode(inv, name) {
  const prefix = (name || 'ITEM').replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'ITEM'
  let max = 0
  inv.items.forEach((i) => { const m = (i.code || '').match(/-(\d+)$/); if (m) { const n = parseInt(m[1], 10); if (n > max) max = n } })
  return `INV-${prefix}-${String(max + 1).padStart(3, '0')}`
}

/* Deterministic barcode bar widths from a code string. */
export function barcodeBars(code = '') {
  const out = []
  const s = (code + '0000').replace(/[^a-zA-Z0-9]/g, '')
  for (let i = 0; i < s.length; i += 1) { const c = s.charCodeAt(i); out.push(1 + (c % 3), 1 + ((c >> 2) % 3)) }
  return out
}
