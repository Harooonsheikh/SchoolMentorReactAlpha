// ══════════════════════════════════════════════════
//  School Mentor — ERP access helper
//  The ERP is now merged into this app (one port). Opening it switches to the
//  in-app 'erp' screen instead of navigating to another port/URL.
//  Access is gated on launchSetup === 1.
// ══════════════════════════════════════════════════

/** True when the logged-in user has completed launch setup. */
export function isErpUnlocked() {
  return Number(sessionStorage.getItem('launchSetup')) === 1;
}

/**
 * Open the ERP if unlocked, otherwise notify the user.
 * @param {(msg: string, type?: string) => void} [showToast] – toast handler for the locked case
 * @param {() => void} [navigate] – host callback that switches to the ERP screen
 * @returns {boolean} – true if the ERP was opened (unlocked)
 */
export function openERP(showToast, navigate) {
  if (!isErpUnlocked()) {
    if (showToast) showToast('ERP not allowed. Please complete the setup first.', 'error');
    return false;
  }
  if (navigate) navigate();
  return true;
}
