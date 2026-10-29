import { buildUrl, buildSuperAdminUrl } from '../../utils/apiConfig';
import { fetchBranchNetworkId } from './chainBranch';

/* ═══════════════════════════════════════════════════════════════════
   BRANCH CLASS MAPPING — maps this school's own classes to the
   NETWORK's (chain's) central classes. All LIVE.

   Classes (main ERP /api):
     • Local (this school) → GET /api/LaunchSetup/get-grades-by-branch/{branchID}
     • Network (central)   → GET /api/LaunchSetup/get-grades-by-network/{networkId}
       (networkId resolved from chainBranch — fetchBranchNetworkId)
   Only class id + name are used ("classes only" — sections/subjects ignored).

   Mappings (SuperAdmin API, AHM_NetworkUsers — PER BRANCH, not per session):
     • GET  /api/AHM_NetworkUsers/class-mapping/{branchId}
            → data[] : { id, branchID, networkID, networkClassID,
                         branchClassID, branchClassName, … }
     • POST /api/AHM_NetworkUsers/save-class-mapping  (insert id:0, else update)
   No delete endpoint exists, so removing a mapping isn't offered — a mapping
   is changed via save (re-map) only.
   ═══════════════════════════════════════════════════════════════════ */

/* API grade row → { id, name }; tolerant of casing / shape. */
const toClasses = (json) => {
  const d = Array.isArray(json) ? json : (json && json.data);
  return (Array.isArray(d) ? d : [])
    .map((c) => ({ id: Number(c.id ?? c.ID) || 0, name: String(c.name ?? c.Name ?? '').trim() }))
    .filter((c) => c.id && c.name);
};

/** This school's own classes (get-grades-by-branch). */
export async function getLocalClasses() {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchID) return [];
  const res = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
  if (!res.ok) throw new Error(`Failed to load local classes (${res.status})`);
  const json = await res.json().catch(() => null);
  return toClasses(json);
}

/** The network's central classes + the resolved networkId (0 = not in a network). */
export async function getNetworkClasses() {
  const networkId = await fetchBranchNetworkId().catch(() => 0);
  if (!networkId) return { networkId: 0, classes: [] };
  const res = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-network/${networkId}`), { headers: { Accept: '*/*' } });
  if (!res.ok) throw new Error(`Failed to load network classes (${res.status})`);
  const json = await res.json().catch(() => null);
  return { networkId, classes: toClasses(json) };
}

/** This branch's saved mappings (GET class-mapping/{branchId}). Shape kept as
    { id, localClassId, centralClassId, branchClassName } for the screen. */
export async function getMappings() {
  const branchId = Number(sessionStorage.getItem('branchID')) || 0;
  if (!branchId) return [];
  const res = await fetch(
    buildSuperAdminUrl(`/api/AHM_NetworkUsers/class-mapping/${branchId}`),
    { method: 'GET', headers: { Accept: '*/*' } },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Failed to load class mappings (${res.status})`);
  const json = await res.json().catch(() => null);
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map((r) => ({
    id: Number(r.id ?? r.ID) || 0,
    localClassId: Number(r.branchClassID ?? r.branchClassId) || 0,
    centralClassId: Number(r.networkClassID ?? r.networkClassId) || 0,
    branchClassName: r.branchClassName ?? r.BranchClassName ?? '',
  }));
}

/* Save a mapping (POST save-class-mapping). id:0 → insert, id>0 → update.
   branchID + networkID + the actor are resolved here so callers only pass the
   two class ids (+ the local class name + any existing mapping id). */
export async function saveMapping({ localClassId, centralClassId, branchClassName = '', id = 0 }) {
  if (!localClassId) throw new Error('That local class was not found for this school.');
  if (!centralClassId) throw new Error('Please choose a network class.');
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const networkID = await fetchBranchNetworkId().catch(() => 0);
  const uid = Number(sessionStorage.getItem('employee_ID')) || 0;
  const now = new Date().toISOString();
  const body = {
    id: Number(id) || 0,
    branchID,
    networkID,
    networkClassID: Number(centralClassId),
    branchClassID: Number(localClassId),
    branchClassName: String(branchClassName || ''),
    createdBy: uid,
    createdAt: now,
    modifiedBy: uid,
    modifiedAt: now,
  };
  const res = await fetch(
    buildSuperAdminUrl('/api/AHM_NetworkUsers/save-class-mapping'),
    { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: '*/*' }, body: JSON.stringify(body) },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || (json && json.success === false)) {
    throw new Error((json && (json.message || json.Message)) || `Could not save this mapping (${res.status})`);
  }
  return json;
}
