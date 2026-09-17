import { buildUrl } from '../../utils/apiConfig';

/* ═══════════════════════════════════════════════════════════════════
   ROLES SERVICE — User Permissions ▸ Roles tab

   Two endpoints:
     • GET  /get-roles-by-branch/{branchId}   → list branch roles
     • POST /save-role                         → create (id:0) / update (id>0)

   branchID / user id come from sessionStorage (same as the rest of the ERP).
   ═══════════════════════════════════════════════════════════════════ */

/* All roles configured for the current branch. Returns the raw `data`
   array from the API (see mapApiRole in UserPermissions for the card shape). */
export async function getRolesByBranch() {
  const token = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID');

  const response = await fetch(
    buildUrl(`/get-roles-by-branch/${branchID}`),
    {
      method: 'GET',
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json?.data || [];
}

/* Create or update a role. Payload shape expected by /save-role:
     { id, branchID, roleName, description, color, modules[], createdBy, modifiedBy }
   id === 0 → create, id > 0 → update.
   Body har haal me parse karo — backend success:false + message kabhi
   non-200 status ke saath aata hai, wo message toaster tak pahunchna chahiye. */
export async function saveRole(payload) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl('/save-role'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok && !json) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return json;
}

/* The role currently assigned to an employee → GET
   /get-user-role/{employeeId}/{branchId}. Returns the raw `data` (role row)
   or null. branchId sessionStorage se. */
export async function getUserRole(employeeId) {
  const token = sessionStorage.getItem('token');
  const branchID = sessionStorage.getItem('branchID');

  const response = await fetch(
    buildUrl(`/get-user-role/${employeeId}/${branchID}`),
    {
      method: 'GET',
      headers: {
        Accept: '*/*',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();
  return json?.data ?? null;
}

/* HR employee id → login user id, get-meeting-teachers/{branchId} ki
   { empid, userId } jodi se. Na mile to null. */
async function resolveLoginUserId(employeeId, branchId, headers) {
  try {
    const res = await fetch(buildUrl(`/get-meeting-teachers/${branchId}`), { headers });
    const json = await res.json().catch(() => null);
    const rows = Array.isArray(json) ? json : (json?.data || []);
    const hit = rows.find((r) => String(r.empid ?? r.empId ?? r.employeeId) === String(employeeId));
    return Number(hit?.userId) || null;
  } catch (_) {
    return null;
  }
}

/* Ek user ki SAVED menu permissions → [{ menuName, subMenuName, action, isAccessable }].
     GET /get-user-menu-permissions/{branchId}/{userId}
   Ye route LOGIN user id leta hai (UserID 213 → employeeID 78 ki row), is liye
   pehle login id nikalte hain: jo caller de (get-user-role ka UserID), warna
   get-meeting-teachers se. Jawab ka employeeID is employee se na mile to wo
   kisi aur ki row hai — use nahi lete. Kuch na mile to purana
   get-user-menu-permissions-by-branch raasta. */
export async function getUserMenuPermissions({ employeeId, loginUserId }) {
  const token = sessionStorage.getItem('token');
  const branchId = sessionStorage.getItem('branchID') || '1';
  const headers = { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

  const userId = Number(loginUserId) || await resolveLoginUserId(employeeId, branchId, headers);
  if (userId) {
    try {
      const res = await fetch(buildUrl(`/get-user-menu-permissions/${branchId}/${userId}`), { headers });
      const json = await res.json().catch(() => null);
      const data = json?.data;
      const sameEmployee = data?.employeeID == null || String(data.employeeID) === String(employeeId);
      if (res.ok && sameEmployee && Array.isArray(data?.permissions) && data.permissions.length) {
        return data.permissions;
      }
    } catch (_) { /* neeche by-branch par girte hain */ }
  }

  const res = await fetch(buildUrl(`/get-user-menu-permissions-by-branch/${branchId}`), { headers });
  const json = await res.json().catch(() => null);
  const entry = (json?.data || []).find((d) => String(d.employeeID) === String(employeeId));
  return entry?.permissions || [];
}

/* Delete a role → DELETE /delete-role/{id}.
   Body har haal me parse karo — role kisi user ko assigned ho to backend
   success:false + message deta hai (kabhi non-200 ke saath), aur wohi
   message toaster me dikhana hai. */
export async function deleteRole(id) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl(`/delete-role/${id}`), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const json = await response.json().catch(() => null);
  if (!response.ok && !json) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return json;
}

/* Assign a role to a user (employee). Payload shape expected by
   /assign-role-to-user:
     { employeeID, roleID, branchID, createdBy } */
export async function assignRoleToUser(payload) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl('/assign-role-to-user'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok && !json) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return json;
}

/* Save a user's menu permissions → POST /save-user-menu-permissions.
   Payload: { branchID, employeeID, permissions[] }. Assign-role ke baad
   role ke modules ko user ki menu-permissions me sync karne ke liye. */
export async function saveUserMenuPermissions(payload) {
  const token = sessionStorage.getItem('token');

  const response = await fetch(buildUrl('/save-user-menu-permissions'), {
    method: 'POST',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json().catch(() => null);
}
