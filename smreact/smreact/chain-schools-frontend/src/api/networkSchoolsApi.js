/* ═══════════════════════════════════════════════════════════════════
   Network schools API — connected schools + join requests for the Head
   Office (Chain Admin) portal.

   NOTE: the pushed build referenced this module but did not include it, so
   this is a mock stand-in that keeps the UI working on demo data. When the
   real Chain-Management wiring (network-schools/manage → getbynetwork /
   accept / reject / setup) lands, it replaces this file. Shapes here match
   what viewContext.jsx, AdminLayout.jsx and SchoolStatus.jsx consume.
   ═══════════════════════════════════════════════════════════════════ */
import { USE_MOCK } from '../config/env'

const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)))
const wait  = (ms = 220) => new Promise((r) => setTimeout(r, ms))

/* Connected schools — accepted network members. `id` = network-school row id
   (used to activate/deactivate), `branchId` = the school's ERP branch id. */
const MOCK_CONNECTED = [
  { id: 1, branchId: 1,  name: 'Beacon Public School',        code: '5790', phone: '03008411045', email: 'beacon@school.pk',   address: 'Chunian',        city: 'Chunian', status: 'ERP',      networkPermission: true  },
  { id: 2, branchId: 12, name: 'Milford Sounds Grammar',      code: '6021', phone: '03211234567', email: 'milford@school.pk',  address: 'Gulberg, Lahore', city: 'Lahore',  status: 'ERP',      networkPermission: true  },
  { id: 3, branchId: 18, name: 'The Creative School',         code: '6044', phone: '03009876543', email: 'creative@school.pk', address: 'Model Town',      city: 'Lahore',  status: 'Inactive', networkPermission: false },
]

/* Pending / rejected join requests. Fields used by AdminLayout: id, name,
   phone (search), plus status / date for display. */
const MOCK_REQUESTS = {
  pending: [
    { id: 101, branchId: 21, name: 'Punjab Group Of Colleges', phone: '04299203000', code: '7010', city: 'Lahore', status: 'Pending', date: new Date().toISOString().slice(0, 10) },
    { id: 102, branchId: 22, name: 'Allied Schools',           phone: '04235870000', code: '7022', city: 'Lahore', status: 'Pending', date: new Date().toISOString().slice(0, 10) },
  ],
  rejected: [
    { id: 103, branchId: 23, name: 'City School (Test)',       phone: '04236000000', code: '7031', city: 'Lahore', status: 'Rejected', date: '2025-11-24' },
  ],
}

/* Connected schools for the view-switcher + School Status screens. */
export async function fetchConnectedSchools() {
  if (USE_MOCK) { await wait(); return clone(MOCK_CONNECTED) }
  await wait(); return clone(MOCK_CONNECTED)   // TODO: live network-schools/manage getbynetwork
}

/* Join requests, split into pending + rejected. */
export async function fetchSchoolRequests() {
  if (USE_MOCK) { await wait(); return clone(MOCK_REQUESTS) }
  await wait(); return clone(MOCK_REQUESTS)    // TODO: live network-schools/manage requests
}

/* Accept / reject a join request. `accepted` true → the school joins the
   network; false → the request is rejected. */
export async function decideSchoolRequest(row, accepted) {
  await wait()
  return { ok: true, id: row?.id, accepted: !!accepted }   // TODO: live accept/reject
}

/* Turn a connected school's ERP access on/off (School Status card). */
export async function setSchoolErpAccess(school, activate) {
  await wait()
  return { ok: true, id: school?.id ?? school?.rowId, active: !!activate }   // TODO: live setup
}
