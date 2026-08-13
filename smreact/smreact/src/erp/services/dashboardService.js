// ══════════════════════════════════════════════════════════════════
//  Dashboard service — Command Center (Admin) ke saare real numbers.
//  Ek hi API se poora dashboard bharta hai:
//    GET /get-dashboard/{branchId}?month={m}&year={y}
//  branchID sessionStorage se; month/year default = current month/year.
//  Response.data ka shape (PascalCase) as-is return hota hai — mapping
//  AdminDashboard me hoti hai. Fail hone par error throw (caller {} par
//  gir jata hai taake dashboard crash na ho).
// ══════════════════════════════════════════════════════════════════
import { buildUrl, apiMessage } from '../../utils/apiConfig';

/* Current month (1-12) + year — API in dono ko query params me leta hai. */
export function currentMonthYear() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export async function getDashboard(month, year) {
  const branchID = Number(sessionStorage.getItem('branchID')) || 0;
  const cur = currentMonthYear();
  const m = Number(month) || cur.month;
  const y = Number(year) || cur.year;
  const res  = await fetch(
    buildUrl(`/get-dashboard/${branchID}?month=${m}&year=${y}`),
    { headers: { Accept: '*/*' } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.success === false) {
    throw new Error(apiMessage(json) || 'Could not load dashboard');
  }
  return json?.data || {};
}
