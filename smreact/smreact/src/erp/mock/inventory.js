/* ═══════════════════════════════════════════════════════════════════
   Inventory Module — seed data
   Ported from ~/Desktop/ERP-HTML/Inventory Module .html (window.INV)
   ═══════════════════════════════════════════════════════════════════ */

export const mockInvCategories = [
  'Furniture', 'Electronics', 'Appliances', 'Lab Equipment', 'Sports',
  'Books Stock', 'Stationery', 'Office Equipment', 'Security',
  'Teaching Aids', 'Other',
];

export const mockInvNextItemId    = 100;
export const mockInvNextProdId    = 50;
export const mockInvNextReceiptNo = 1018;

/* Inventory items — physical school assets with history timeline. */
export const mockInvItems = [
  { id: 1, name: 'Student Chair',        cat: 'Furniture',         code: 'INV-CHAIR-001', qty: 120, low: 20, date: '2024-08-12', cond: 'Good', status: 'In Use',       loc: 'Classrooms (Block A)', desc: 'Standard wooden student chairs distributed across Block A classrooms.', active: true, img: null,
    history: [
      { t: 'Item added to inventory',           at: '2024-08-12' },
      { t: '5 chairs moved to Block B',          at: '2025-01-10' },
      { t: 'Condition reviewed — Good',          at: '2026-02-02' },
    ] },
  { id: 2, name: 'Classroom Table',      cat: 'Furniture',         code: 'INV-TABLE-014', qty:  60, low: 10, date: '2024-08-12', cond: 'Good', status: 'In Use',       loc: 'Classrooms (Block A)', desc: 'Two-seater laminated classroom tables.', active: true, img: null,
    history: [{ t: 'Item added to inventory', at: '2024-08-12' }] },
  { id: 3, name: 'Ceiling Fan',          cat: 'Appliances',        code: 'INV-FAN-008',   qty:  45, low:  8, date: '2024-07-01', cond: 'Good', status: 'In Use',       loc: 'Classrooms & Halls',   desc: 'Ceiling fans installed in classrooms and the main hall.', active: true, img: null,
    history: [
      { t: 'Item added to inventory',  at: '2024-07-01' },
      { t: '3 fans sent for repair',    at: '2026-03-15' },
    ] },
  { id: 4, name: 'Whiteboard',           cat: 'Teaching Aids',     code: 'INV-WBRD-003',  qty:  12, low:  3, date: '2024-08-20', cond: 'Good', status: 'In Use',       loc: 'Classrooms',           desc: 'Wall-mounted magnetic whiteboards.', active: true, img: null,
    history: [{ t: 'Item added to inventory', at: '2024-08-20' }] },
  { id: 5, name: 'Desktop Computer',     cat: 'Electronics',       code: 'INV-COMP-002',  qty:   8, low:  2, date: '2025-02-10', cond: 'Good', status: 'In Use',       loc: 'Computer Lab',         desc: 'Core-i5 desktop systems in the computer lab.', active: true, img: null,
    history: [
      { t: 'Item added to inventory',  at: '2025-02-10' },
      { t: '1 unit under repair',       at: '2026-04-22' },
    ] },
  { id: 6, name: 'Laser Printer',        cat: 'Office Equipment',  code: 'INV-PRNT-001',  qty:   3, low:  1, date: '2025-03-05', cond: 'Good', status: 'In Use',       loc: 'Admin Office',         desc: 'Monochrome laser printers in the admin office.', active: true, img: null,
    history: [{ t: 'Item added to inventory', at: '2025-03-05' }] },
  { id: 7, name: 'Multimedia Projector', cat: 'Electronics',       code: 'INV-PROJ-001',  qty:   2, low:  1, date: '2025-01-18', cond: 'Good', status: 'In Store',     loc: 'Store Room',           desc: 'Portable projectors used for presentations.', active: true, img: null,
    history: [{ t: 'Item added to inventory', at: '2025-01-18' }] },
  { id: 8, name: 'CCTV Camera',          cat: 'Security',          code: 'INV-CCTV-006',  qty:  16, low:  4, date: '2024-09-01', cond: 'Good', status: 'In Use',       loc: 'Corridors & Gates',    desc: 'Dome CCTV cameras covering corridors and entry gates.', active: true, img: null,
    history: [{ t: 'Item added to inventory', at: '2024-09-01' }] },
  { id: 9, name: 'Microscope',           cat: 'Lab Equipment',     code: 'INV-MICR-004',  qty:  10, low:  3, date: '2025-02-25', cond: 'Fair', status: 'In Use',       loc: 'Science Lab',          desc: 'Compound microscopes for biology practicals.', active: true, img: null,
    history: [{ t: 'Item added to inventory', at: '2025-02-25' }] },
  { id: 10, name: 'Cricket Kit',         cat: 'Sports',            code: 'INV-SPRT-007',  qty:   4, low:  2, date: '2025-04-02', cond: 'Good', status: 'In Store',     loc: 'Sports Store',         desc: 'Complete cricket kits including bats, pads and gloves.', active: true, img: null,
    history: [{ t: 'Item added to inventory', at: '2025-04-02' }] },
  { id: 11, name: 'Old Wooden Bench',    cat: 'Furniture',         code: 'INV-BNCH-009',  qty:   6, low:  0, date: '2019-05-10', cond: 'Poor', status: 'Damaged',      loc: 'Store Room',           desc: 'Old benches retired from service, kept for spare parts.', active: false, img: null,
    history: [
      { t: 'Item added to inventory',                   at: '2019-05-10' },
      { t: 'Marked Inactive — damaged beyond repair',    at: '2026-01-20' },
    ] },
];

/* Shop products — sold via Point of Sale. */
export const mockInvProducts = [
  { id:  1, name: 'Grade 1 English Book',    cat: 'Books',      barcode: 'BK-ENG-001', stock:  85, low: 20, cost: 180, price:  250, img: null },
  { id:  2, name: 'School Diary',            cat: 'Stationery', barcode: 'ST-DRY-002', stock: 140, low: 30, cost:  90, price:  150, img: null },
  { id:  3, name: 'Notebook (100 pages)',    cat: 'Notebooks',  barcode: 'NB-100-003', stock:   8, low: 25, cost:  45, price:   70, img: null },
  { id:  4, name: 'Blue Ballpoint Pen',      cat: 'Stationery', barcode: 'ST-PEN-004', stock: 300, low: 50, cost:  12, price:   25, img: null },
  { id:  5, name: 'Pencil Box',              cat: 'Stationery', barcode: 'ST-PBX-005', stock:  42, low: 15, cost: 120, price:  200, img: null },
  { id:  6, name: 'School Uniform (Shirt)',  cat: 'Uniform',    barcode: 'UN-SHT-006', stock:  35, low: 10, cost: 450, price:  650, img: null },
  { id:  7, name: 'Eraser',                  cat: 'Stationery', barcode: 'ST-ERS-007', stock:   5, low: 30, cost:   5, price:   15, img: null },
  { id:  8, name: 'Lead Pencil',             cat: 'Stationery', barcode: 'ST-LPN-008', stock: 220, low: 50, cost:   8, price:   20, img: null },
  { id:  9, name: 'Grade 2 Math Book',       cat: 'Books',      barcode: 'BK-MAT-009', stock:  72, low: 20, cost: 220, price:  300, img: null },
  { id: 10, name: 'Grade 3 Science Book',    cat: 'Books',      barcode: 'BK-SCI-010', stock:  64, low: 20, cost: 240, price:  320, img: null },
  { id: 11, name: 'Notebook (200 pages)',    cat: 'Notebooks',  barcode: 'NB-200-011', stock:  96, low: 25, cost:  75, price:  110, img: null },
  { id: 12, name: 'Drawing Sketchbook',      cat: 'Notebooks',  barcode: 'NB-SKB-012', stock:  48, low: 15, cost: 130, price:  180, img: null },
  { id: 13, name: 'Geometry Box',            cat: 'Stationery', barcode: 'ST-GMB-013', stock:  60, low: 15, cost: 180, price:  280, img: null },
  { id: 14, name: 'Highlighter (Pack of 4)', cat: 'Stationery', barcode: 'ST-HLT-014', stock:  38, low: 12, cost: 150, price:  220, img: null },
  { id: 15, name: 'Glue Stick',              cat: 'Stationery', barcode: 'ST-GLU-015', stock:  90, low: 25, cost:  35, price:   60, img: null },
  { id: 16, name: 'A4 Printer Paper Ream',   cat: 'Stationery', barcode: 'ST-PPR-016', stock:  22, low:  8, cost: 580, price:  750, img: null },
  { id: 17, name: 'School Uniform (Pant)',   cat: 'Uniform',    barcode: 'UN-PNT-017', stock:  28, low: 10, cost: 520, price:  720, img: null },
  { id: 18, name: 'School Tie',              cat: 'Uniform',    barcode: 'UN-TIE-018', stock:  55, low: 15, cost:  90, price:  150, img: null },
  { id: 19, name: 'School Belt',             cat: 'Uniform',    barcode: 'UN-BLT-019', stock:  44, low: 12, cost: 160, price:  240, img: null },
  { id: 20, name: 'School Bag',              cat: 'Other',      barcode: 'OT-BAG-020', stock:  18, low:  6, cost: 900, price: 1350, img: null },
];

/* Sales receipts — Point of Sale history. */
export const mockInvSales = [
  { no: 'RCP-1017', date: '2026-05-24', buyer: 'Ahmed Raza — Class 5B',  by: 'Front Desk',
    lines: [
      { name: 'Notebook (100 pages)', qty: 3, price:  70 },
      { name: 'School Diary',          qty: 2, price: 150 },
      { name: 'Eraser',                qty: 1, price:  15 },
      { name: 'Lead Pencil',           qty: 2, price:  20 },
    ], total: 570 },
  { no: 'RCP-1016', date: '2026-05-24', buyer: 'Fatima Noor — Class 3A', by: 'Front Desk',
    lines: [
      { name: 'Grade 1 English Book', qty: 1, price: 250 },
      { name: 'Blue Ballpoint Pen',   qty: 2, price:  25 },
    ], total: 300 },
  { no: 'RCP-1015', date: '2026-05-23', buyer: 'Bilal Hussain — Class 8C', by: 'Sana Malik',
    lines: [
      { name: 'School Uniform (Shirt)', qty: 1, price: 650 },
      { name: 'Pencil Box',              qty: 1, price: 200 },
    ], total: 850 },
  { no: 'RCP-1014', date: '2026-05-22', buyer: 'Walk-in', by: 'Front Desk',
    lines: [{ name: 'Blue Ballpoint Pen', qty: 5, price: 25 }], total: 125 },
  { no: 'RCP-1013', date: '2026-05-20', buyer: 'Hira Khan — Class 2B', by: 'Front Desk',
    lines: [
      { name: 'Notebook (100 pages)', qty: 4, price:  70 },
      { name: 'School Diary',          qty: 1, price: 150 },
    ], total: 430 },
  { no: 'RCP-1012', date: '2026-05-19', buyer: 'Mariam Tariq — Class 1A', by: 'Sana Malik',
    lines: [
      { name: 'School Bag',              qty: 1, price: 1350 },
      { name: 'School Uniform (Shirt)',  qty: 1, price:  650 },
      { name: 'School Tie',              qty: 1, price:  150 },
    ], total: 2150 },
  { no: 'RCP-1011', date: '2026-05-17', buyer: 'Usman Sheikh — Parent', by: 'Front Desk',
    lines: [
      { name: 'Grade 2 Math Book',       qty: 2, price: 300 },
      { name: 'Grade 3 Science Book',    qty: 1, price: 320 },
      { name: 'Notebook (200 pages)',    qty: 4, price: 110 },
      { name: 'Geometry Box',            qty: 1, price: 280 },
    ], total: 1640 },
  { no: 'RCP-1010', date: '2026-05-15', buyer: 'Aisha Saleem — Class 4C', by: 'Front Desk',
    lines: [
      { name: 'Drawing Sketchbook',      qty: 1, price: 180 },
      { name: 'Highlighter (Pack of 4)', qty: 1, price: 220 },
      { name: 'Glue Stick',              qty: 2, price:  60 },
      { name: 'Lead Pencil',             qty: 5, price:  20 },
    ], total: 620 },
];

export const mockInvUsers       = ['Sana Malik', 'Ali Khan', 'Front Desk'];
export const mockInvCurrentUser = 'Sana Malik';

export const mockInvSchool = {
  name:     'The Oxford System, Lahore Campus',
  monogram: 'OS',
};
