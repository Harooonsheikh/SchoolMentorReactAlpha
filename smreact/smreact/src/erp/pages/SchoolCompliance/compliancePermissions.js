import { useCallback } from 'react';
import { usePermissions } from '../../context/PermissionsContext';

/* ═══════════════════════════════════════════════════════════════════
   SCHOOL COMPLIANCE — permission helpers.

   menuName / subMenuName wahi hain jo User Permissions ka MODULE_TREE
   (permissionsData.js → 'compliance') API ko bhejta hai. Inhein badla
   to DB ki purani saved permissions match nahi hongi — is liye labels
   JAAN BOOJH kar yahan fix hain, tab ke display label se alag.
   Kaunsa button kis action se chalta hai — MODULE_PERMISSIONS ke
   'cmp.*' comments dekhein.

   Jis action ka grant nahi uska button HIDE hota hai (disable nahi).
   School Head / chain / billing lock — sab usePermissions().can() ke
   andar khud handle hote hain.
   ═══════════════════════════════════════════════════════════════════ */

export const COMPLIANCE_MENU = 'School Compliance';

/* screen id → API subMenuName */
export const COMPLIANCE_SCREEN_LABELS = {
  overview: 'Overview',
  daily:    'Daily Checks',
  weekly:   'Weekly Checks',
  monthly:  'Monthly Review',
  problems: 'Problems & Follow-ups',
  reports:  'Reports',
  /* Compliance Setup ke andar ke Daily / Weekly / Monthly sub-tabs —
     har ek ki apni permission */
  setup_daily:   'Compliance Setup - Daily',
  setup_weekly:  'Compliance Setup - Weekly',
  setup_monthly: 'Compliance Setup - Monthly',
};

/* Setup ka sub-tab (freq) → screen id */
export const setupScreenOf = (freq) => `setup_${freq}`;
const SETUP_SCREENS = ['setup_daily', 'setup_weekly', 'setup_monthly'];

/* Tab level — jis tab ka View granted nahi wo tab bar se hide.
   'setup' L1 tab tab dikhta hai jab teeno sub-tabs me se kisi ek ka
   View ho. */
export function useComplianceTabs() {
  const { can, ready } = usePermissions();
  const canOpen = useCallback((tabId) => {
    if (tabId === 'setup') return SETUP_SCREENS.some(s => can(COMPLIANCE_MENU, COMPLIANCE_SCREEN_LABELS[s], 'View'));
    const label = COMPLIANCE_SCREEN_LABELS[tabId];
    return label ? can(COMPLIANCE_MENU, label, 'View') : true;
  }, [can]);
  return { ready, canOpen };
}

/* Action level — ek screen ke saare actions. */
export function useComplianceActions(screenId) {
  const { can } = usePermissions();
  const label = COMPLIANCE_SCREEN_LABELS[screenId];
  const check = (action) => (label ? can(COMPLIANCE_MENU, label, action) : true);
  return {
    canView:     check('View'),
    canCreate:   check('Create'),
    canEdit:     check('Edit'),
    canDelete:   check('Delete'),
    canApprove:  check('Approve'),
    canDownload: check('Download'),
  };
}
