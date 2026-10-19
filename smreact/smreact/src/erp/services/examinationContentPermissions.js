/* ═══════════════════════════════════════════════════════════════════
   EXAMINATION CONTENT PERMISSIONS — chain Head Office ne is branch ko
   Exam Setup / Result Setup par View / Add / Edit / Delete diya hai ya
   nahi. Bilkul academicsContentPermissions jaisa — wahi endpoint, bas
   menu slugs alag (examsetup / resultsetup).

     POST {chain}/api/Network_Setup/manage-academics-permission
       { action: "GETBYBRANCH", branchID, networkID: null, menu, … }

   Branch login (aur ERP refresh) par ek dafa aati hai, sessionStorage me
   rehti hai. Sirf usi branch par lagti hain jo abhi kisi chain network ka
   accepted hissa ho. Chain se nikal jaye to applies:false — school ke apne
   actions par koi rok nahi. Chain ho to har action isAccessable se chalti
   hai: true → kaam, false → button band, hover par head-office message.
   ═══════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from 'react';
import { buildChainApiUrl } from '../../utils/apiConfig';
import { checkChainBranch } from './chainBranch';

export const EXAMINATION_CONTENT_KEY = 'sm_examination_content_perms';
export const EXAMINATION_VIEW_ONLY_MSG = 'Enable permission from head office';

const MANAGE_URL = () => buildChainApiUrl('/api/Network_Setup/manage-academics-permission');

const MENUS = ['examsetup', 'resultsetup'];
const ACTIONS = ['view', 'add', 'edit', 'delete'];

/* Head Office modal:
     examsetup   → Exam Setup (Add Exam tab)
     resultsetup → Result Setup (grades / signatures / final remarks)
   Chain portal ke save slugs + mumkin purane/alt naam isi par map hote hain. */
const MENU_ALIAS = {
  examsetup: 'examsetup', exam: 'examsetup', examination: 'examsetup',
  resultsetup: 'resultsetup', result: 'resultsetup',
};
const ACT_ALIAS = {
  view: 'view', viewonly: 'view',
  add: 'add', create: 'add',
  edit: 'edit', update: 'edit',
  delete: 'delete',
};
const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const int = (v) => Number(v) || 0;

function blank(viewDefault) {
  const out = {};
  MENUS.forEach((m) => {
    out[m] = { view: !!viewDefault, add: false, edit: false, delete: false };
  });
  return out;
}

function asBool(v) {
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return v === true || v === 1;
}

function parseRows(rows) {
  const perms = blank(false);
  (rows || []).forEach((r) => {
    const menu = MENU_ALIAS[norm(r.Menu ?? r.menu)];
    const act = ACT_ALIAS[norm(r.Action ?? r.action ?? r.MenuAction ?? r.menuAction)];
    if (!menu || !act) return;
    perms[menu][act] = asBool(r.IsAccessable ?? r.isAccessable);
  });
  return perms;
}

export function cachedExaminationContentPerms() {
  try {
    const raw = sessionStorage.getItem(EXAMINATION_CONTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function clearExaminationContentPerms() {
  try { sessionStorage.removeItem(EXAMINATION_CONTENT_KEY); } catch (e) { /* private mode */ }
}

function remember(value) {
  const stored = { ...value, branchID: int(sessionStorage.getItem('branchID')) };
  try { sessionStorage.setItem(EXAMINATION_CONTENT_KEY, JSON.stringify(stored)); } catch (e) { /* private mode */ }
  return stored;
}

function rowsOf(json) {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.Data)) return json.Data;
  return [];
}

/* Exam Setup / Result Setup — har menu ki GETBYBRANCH. Server kabhi menu
   filter karta hai, is liye dono calls; jo saari rows ek hi jawab me de de,
   unhein menu+action se ek baar rakha jata hai. */
async function fetchBranchPermissionRows(branchID) {
  const lists = await Promise.all(MENUS.map(async (menu) => {
    const res = await fetch(MANAGE_URL(), {
      method: 'POST',
      headers: { Accept: '*/*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'GETBYBRANCH',
        id: 0,
        networkID: null,
        branchID,
        menu,
        menuAction: '',
        isAccessable: true,
        createdBy: 0,
        modifiedBy: 0,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) return [];
    return rowsOf(json);
  }));
  const seen = new Set();
  const rows = [];
  lists.flat().forEach((r) => {
    const menu = norm(r.Menu ?? r.menu);
    const act = norm(r.Action ?? r.action ?? r.MenuAction ?? r.menuAction);
    const key = `${menu}|${act}`;
    if (!menu || !act || seen.has(key)) return;
    seen.add(key);
    rows.push(r);
  });
  return rows;
}

let loadInflight = null;

/**
 * Branch login / ERP boot par. Chain ka accepted hissa na ho to applies:false,
 * chahe purani permission rows server par padi hon.
 * GET fail → applies:false (fail-open), siwaye isi branch ke pehle wale cache ke.
 * Chain ho aur rows hon to unka isAccessable overlay; rows na hon to View Only.
 */
export function loadExaminationContentPermissions() {
  if (loadInflight) return loadInflight;
  loadInflight = loadExaminationContentPermissionsNow().finally(() => { loadInflight = null; });
  return loadInflight;
}

async function loadExaminationContentPermissionsNow() {
  const branchID = int(sessionStorage.getItem('branchID'));
  if (!branchID) return remember({ applies: false, ...blank(true) });

  try {
    /* Pehle membership. Chain se hat chuki branch par GETBYBRANCH ki purani
       rows bhi apply nahi hotin — Exam Setup / Result Setup wapas school ki
       apni role permissions par chalte hain. */
    const inChain = await checkChainBranch();
    if (!inChain) return remember({ applies: false, ...blank(true) });

    const rows = await fetchBranchPermissionRows(branchID);
    /* Saved rows hon to wahi law. View only = view true, add/edit/delete false.
       Sirf Add = add chale, edit aur delete band. */
    if (rows.length) return remember({ applies: true, ...parseRows(rows) });
    return remember({ applies: true, ...blank(true) });
  } catch (err) {
    console.error('Examination content permissions load failed:', err);
    const cached = cachedExaminationContentPerms();
    if (cached && cached.applies && cached.branchID === branchID) return cached;
    return remember({ applies: false, ...blank(true) });
  }
}

export function useExaminationContentPerms() {
  const [state, setState] = useState(() => cachedExaminationContentPerms() || { applies: false, ...blank(true) });

  useEffect(() => {
    let alive = true;
    loadExaminationContentPermissions().then((p) => { if (alive) setState(p); });
    return () => { alive = false; };
  }, []);

  const can = useCallback((menu, action) => {
    if (!state?.applies) return true;
    const mapped = ACT_ALIAS[norm(action)] || norm(action);
    const m = MENU_ALIAS[norm(menu)] || norm(menu);
    return !!state[m]?.[mapped];
  }, [state]);

  /** true = ruk gaye (toast dikha diya). false = action chalegi. */
  const denyWrite = useCallback((menu, action, toast) => {
    if (can(menu, action)) return false;
    if (typeof toast === 'function') toast(EXAMINATION_VIEW_ONLY_MSG, 'error');
    return true;
  }, [can]);

  return { applies: !!state.applies, can, denyWrite };
}
