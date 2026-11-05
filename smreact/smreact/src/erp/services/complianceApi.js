import { buildUrl } from '../../../src/utils/apiConfig'; 

const BASE = '/api/AHM_Branch_Compliance_Area';

const authHeaders = () => {
  const token = sessionStorage.getItem('token') || '';
  return {
    Accept: '*/*',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const getBranchId = () => Number(sessionStorage.getItem('branchID')) || 0;

/* GET area-list */
export async function getAreas(branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-list?branchId=${branchId}`), {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('area-list failed');
  const json = await res.json().catch(() => null);
  const data = json?.data ?? json;
  return Array.isArray(data) ? data : [];
}

/* POST area-add-list — body: { items: [{ id, branchId, name }] } */
export async function addAreas(names, branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-add-list`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      items: names.map((name) => ({ id: 0, branchId, name })),
    }),
  });
  if (!res.ok) throw new Error('area-add-list failed');
  return res.json().catch(() => null);
}

/* Module khulte hi: jo areas backend mein nahi hain sirf wohi save karo */
let seedPromise = null; // module level: dono effect calls ek hi kaam share karenge

export function ensureAreas(defaultNames) {
  if (!seedPromise) {
    seedPromise = (async () => {
      const branchId = getBranchId();
      let areas = await getAreas(branchId);
      const existing = new Set(areas.map((a) => a.name));
      const missing = defaultNames.filter((n) => !existing.has(n));

      if (missing.length) {
        await addAreas(missing, branchId);
        areas = await getAreas(branchId);
      }
      return areas;
    })().catch((err) => {
      seedPromise = null; // fail ho to dobara try ho sake
      throw err;
    });
  }
  return seedPromise;
}

/* POST area-action — action: 'insert' */
export async function addArea(name, branchId = getBranchId()) {
  const res = await fetch(buildUrl(`${BASE}/area-action`), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      action: 'insert',
      data: { id: 0, branchId, name: name.trim() },
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || 'area-action failed');
  }
  return json;
}