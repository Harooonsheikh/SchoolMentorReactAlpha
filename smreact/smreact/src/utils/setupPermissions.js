/* ═══════════════════════════════════════════════════════════════════
   LAUNCH SETUP — permission helpers

   Launch Setup ERP shell se BAHAR chalta hai (apna alag setup app —
   src/App.js), magar permission ke lehaz se wo bhi ERP ka ek module
   hai: MODULE_TREE me `launch` / "Launch Setup", aur uske 6 screens
   wahi 6 setup tabs hain.

   Yahan sirf DO cheezein hain, taake naam kahin bhi haath se na likhne
   paren aur API ka `menuName` / `subMenuName` sab jagah ek jaisa rahe:

     LAUNCH_MENU    — module ka label (= API ka menuName)
     SETUP_SCREENS  — tab key → screen label (= API ka subMenuName)

   Ye labels permissionsData.js ke MODULE_TREE ke labels se HAROOF-BA-
   HAROOF mel khate hain. Wahan badlein to yahan bhi badlein — warna
   permission milne ke bawajood screen band rahegi.
   ═══════════════════════════════════════════════════════════════════ */

import { useMemo } from 'react';
import { usePermissions } from '../erp/context/PermissionsContext';

/** MODULE_TREE ka module label — API par yahi `menuName` jata hai. */
export const LAUNCH_MENU = 'Launch Setup';

/** Setup tab ki key → permission screen ka label (API ka `subMenuName`). */
export const SETUP_SCREENS = {
  school:      'School',
  classes:     'Classes',
  subjects:    'Subjects',
  departments: 'Departments',
  staff:       'Staff Details',
  student:     'Student Details',
};

/** ERP ke andar wali screen (LaunchSetup.jsx — module on/off). */
export const ACTIVATED_MODULES_SCREEN = 'Activated Modules';

/* Jab koi control permission ki wajah se band ho — wahi ek jumla har jagah. */
export const NO_EDIT_TIP = 'You do not have permission to change this';

/* Canonical action strings — bilkul wahi jo API par jate hain (ACTION_LABELS).
   `can()` inhi par match karta hai, is liye 'Manage Settings' nahi, 'Settings'. */
export const SETUP_ACTIONS = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  download: 'Download', print: 'Print', import: 'Import', settings: 'Settings',
};

/**
 * Ek setup tab ke liye permission helpers.
 *
 *   const p = useSetupTabPerms('classes')
 *   p.canView / p.canCreate / p.canEdit / p.canDelete / p.canDownload / p.canImport
 *
 * Provider ke bahar usePermissions poora access deta hai (fail-open), is liye
 * ERP se bahar bhi kuch toot-ta nahi.
 */
export function useSetupTabPerms(tabKey) {
  const { can, canModule, ready, fullAccess, readOnly } = usePermissions();
  const screen = SETUP_SCREENS[tabKey] || tabKey;
  return useMemo(() => {
    /* Pehle module, phir screen. Ye tarteeb zaroori hai: `can()` un modules
       ke liye true de deta hai jo permission response me hain hi nahi (legacy
       safety), jabke `canModule()` registry ke har module par sakht hai —
       response me na ho to access nahi. Bagair is check ke jis user ko Launch
       Setup mila hi nahi, usay chhe ke chhe tabs dikh jate. */
    const moduleAllowed = canModule(LAUNCH_MENU);
    const allow = (action) => moduleAllowed && can(LAUNCH_MENU, screen, action);
    return {
      ready,
      fullAccess,
      readOnly,
      screen,
      moduleAllowed,
      canView:     allow(SETUP_ACTIONS.view),
      canCreate:   allow(SETUP_ACTIONS.create),
      canEdit:     allow(SETUP_ACTIONS.edit),
      canDelete:   allow(SETUP_ACTIONS.delete),
      canDownload: allow(SETUP_ACTIONS.download),
      canImport:   allow(SETUP_ACTIONS.import),
    };
  }, [can, canModule, ready, fullAccess, readOnly, screen]);
}

/**
 * Kaun se setup tabs is user ko dikhne chahiyen — `View` wale.
 * Wapas ek Set aati hai (tab keys), aur `ready` taake permissions aane se
 * pehle koi tab galti se chhup ya dikh na jaye.
 */
export function useVisibleSetupTabs() {
  const { can, canModule, ready, fullAccess } = usePermissions();
  return useMemo(() => {
    /* Permissions load hone se PEHLE kuch bhi visible nahi.
       Zaroori kyun: PermissionsContext ka `can()` un modules ke liye true
       deta hai jo abhi tak "known" nahi (legacy safety) — yani API ka jawab
       aane tak SAARE 6 tabs allowed lagte the aur ek pal ke liye poori list
       dikh jati thi, phir sirf granted wala reh jata tha. Ab is dauran
       screen par loader hota hai (App.js), tabs nahi. */
    if (!ready) return { ready: false, fullAccess, visible: new Set(), list: [] };
    /* Module level par sakht rok — dekhein useSetupTabPerms ki sharh. */
    if (!canModule(LAUNCH_MENU)) return { ready, fullAccess, visible: new Set(), list: [] };
    const keys = Object.keys(SETUP_SCREENS)
      .filter((k) => can(LAUNCH_MENU, SETUP_SCREENS[k], SETUP_ACTIONS.view));
    return { ready, fullAccess, visible: new Set(keys), list: keys };
  }, [can, canModule, ready, fullAccess]);
}
