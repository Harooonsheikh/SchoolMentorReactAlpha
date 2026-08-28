import { useEffect, useState } from 'react';
import { isViewOnlyAccount, setViewOnlyActive } from '../../utils/apiConfig';
import { checkChainBranch } from '../services/chainBranch';

/* ═══════════════════════════════════════════════════════════════════
   VIEW-ONLY GUARD — chain account ke liye poore ERP ke action buttons
   band kar deta hai.

   Kyun DOM par? ERP ke 23 module files me se sirf 11 abhi permissions
   (`can()`) par gated hain — baqi screens ke Save/Delete/Edit buttons
   permission check kiye baghair chalte hain. Har module me alag alag
   `disabled={readOnly}` lagane ke bajaye ye ek jagah se sab par lag jata
   hai, aur naye modules bhi apne aap isi ke daere me aa jaate hain.

   Teen parat:
     1. Yahan (nazar)  — likhne wale buttons `disabled` + dhundle
     2. Yahan (click)  — capture phase par rok, taake koi handler chale hi na
     3. apiConfig      — likhne wali API call server tak jaati hi nahi

   Pehchan LABEL aur ICON se hoti hai (ERP me FontAwesome ka istemal poore
   codebase me yaksan hai). Deny-list rakhi hai, allow-list nahi: jo button
   in me se kisi se mel na khaye wo chalta rehta hai — is tarah Search,
   Filter, Close jaisi cheezein galti se band nahi hotin, aur agar koi
   likhne wala button chhoot bhi jaye to teesri parat (API guard) use rok
   leti hai.
   ═══════════════════════════════════════════════════════════════════ */

export const VIEW_ONLY_TIP = 'View only — a chain account cannot make changes';

/* Jo hamesha chalte rehne chahiye. Ye pehle check hote hain, is liye
   "Cancel" aur "Close" (modal band karna) kabhi band nahi hote — warna
   view-only user modal me phans jata. */
const KEEP_ENABLED = /\b(cancel|close|back|next|prev|previous|print|download|export|view|search|filter|refresh|reload|sign out|logout|log out|show|hide|expand|collapse|details?|tutorial|help|support|add-?ons?)\b/i;

/* Likhne wale lafz — word boundary ke sath, warna "Add-ons" aur "Address"
   jaise alfaz bhi pakde jate. */
const WRITE_TEXT = /\b(save|update|delete|remove|edit|add|new|create|submit|approve|reject|assign|unassign|upload|import|generate|issue|promote|transfer|send|pay|receive|activate|deactivate|restore|publish|revoke|grant|enroll|admit|allocate|mark|confirm|apply changes|change password|reset)\b/i;

/* Icon-only buttons (trash / pencil / plus) ka koi label nahi hota — unhe
   icon se pehchante hain. `fa-check` aur `fa-xmark` jaan bujh kar bahar
   hain: pehla filter/select me bhi aata hai aur doosra modal band karta
   hai; jo save buttons `fa-check` rakhte hain unka label upar wale
   WRITE_TEXT me aa jata hai. */
const WRITE_ICONS = /\bfa-(trash|trash-can|trash-alt|pen|pen-to-square|pen-nib|pen-line|pencil|plus|circle-plus|square-plus|user-plus|floppy-disk|save|upload|file-import|paper-plane|arrow-up-from-bracket)\b/;

const LOCKED_CLASS = 'sm-vo-locked';
const MARK = 'data-sm-vo';

const CSS = `
.${LOCKED_CLASS} {
  opacity: .42 !important;
  cursor: not-allowed !important;
  filter: grayscale(.5);
  box-shadow: none !important;
  transform: none !important;
}
`;

/* Tabs, sidebar aur pagination bhi <button> hote hain. Inhe kabhi band nahi
   karna — warna view-only user us screen ka wo hissa dekh hi nahi payega.
   Asool: galti se KHULA reh jana chalta hai (API guard phir bhi rok legi),
   galti se BAND ho jana nahi (dekhna hi na ho paye). */
const NAV_HINT = /(^|[\s_-])(tab|tabs|nav|sidebar|menu|pag(er|ination)|breadcrumb|stab|seg)([\s_-]|$)/i;

function isNavControl(el) {
  if (el.getAttribute('role') === 'tab') return true;
  if (el.closest('[role="tablist"], nav, .sidebar, .em-nav, .em-sub-tabs')) return true;
  return NAV_HINT.test(el.getAttribute('class') || '');
}

/** Kya ye control kuch badalta hai? */
function isWriteControl(el) {
  /* Sirf asal buttons — nav links aur cards ko haath nahi lagate. */
  const tag = el.tagName;
  if (tag !== 'BUTTON' && !(tag === 'A' && el.getAttribute('role') === 'button')) return false;
  if (isNavControl(el)) return false;

  const label = `${el.textContent || ''} ${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  if (KEEP_ENABLED.test(label)) return false;
  if (WRITE_TEXT.test(label)) return true;

  /* Label kuch na kahe to icon se pehchano. */
  const icon = el.querySelector('i[class*="fa-"], svg[class*="fa-"]');
  return !!icon && WRITE_ICONS.test(icon.getAttribute('class') || '');
}

/**
 * Kya ye session view-only hai — chain wale school ka ERP ya chain ka apna
 * account. Jawab session me sambhal jata hai, is liye ek hi network call
 * poore app me (dekhein services/chainBranch.js).
 *
 * PermissionsContext ke bahar (jaise Launch Setup screen) ise seedha use
 * kiya ja sakta hai.
 */
export function useViewOnly() {
  const [viewOnly, setViewOnly] = useState(() => isViewOnlyAccount());

  useEffect(() => {
    if (viewOnly) return undefined;
    let alive = true;
    checkChainBranch()
      .then((isChain) => { if (alive && isChain) setViewOnly(true); })
      .catch(() => { /* chain API na chale to school apna kaam karta rahe */ });
    return () => { alive = false; };
  }, [viewOnly]);

  return viewOnly;
}

export default function ViewOnlyGuard({ active, onBlocked }) {
  /* API parat — likhne wali call server tak jaati hi nahi. Ye alag se on
     karni parti hai kyunke session guard ERP ke bahar band rehta hai. */
  useEffect(() => {
    setViewOnlyActive(!!active);
    return () => setViewOnlyActive(false);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;

    const style = document.createElement('style');
    style.setAttribute('data-sm-view-only', '1');
    style.textContent = CSS;
    document.head.appendChild(style);

    /* Ek pass — jitne bhi write buttons mile, band kar do. Jo pehle se
       disabled hai use chhoo kar bhi kuch nahi bigadta, magar dobara likhne
       se bachne ke liye mark laga dete hain. */
    const lock = () => {
      const nodes = document.querySelectorAll('button:not([' + MARK + ']), a[role="button"]:not([' + MARK + '])');
      nodes.forEach((el) => {
        if (!isWriteControl(el)) return;
        el.setAttribute(MARK, '1');
        el.classList.add(LOCKED_CLASS);
        el.setAttribute('aria-disabled', 'true');
        if (!el.getAttribute('title')) el.setAttribute('title', VIEW_ONLY_TIP);
        if (el.tagName === 'BUTTON') el.disabled = true;
      });
    };

    /* React har render par naye nodes laata hai (aur kabhi kabhi `disabled`
       wapas apni prop se set kar deta hai), is liye DOM par nazar rakhte
       hain — magar har mutation par nahi, ek animation frame me ek dafa. */
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => { queued = false; lock(); });
    };

    lock();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    /* Doosri parat: click capture phase par. Disabled button click hi nahi
       hota, magar agar koi button hamari nazar se pehle (ya `disabled` ke
       baghair) daba diya jaye to yahan ruk jata hai — handler chalne se
       pehle. */
    const onClick = (e) => {
      const el = e.target && e.target.closest && e.target.closest('button, a[role="button"]');
      if (!el || !isWriteControl(el)) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      if (onBlocked) onBlocked();
    };
    /* Form submit (Enter dabane par) bhi rok do. */
    const onSubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onBlocked) onBlocked();
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      style.remove();
      document.querySelectorAll(`[${MARK}]`).forEach((el) => {
        el.removeAttribute(MARK);
        el.classList.remove(LOCKED_CLASS);
        el.removeAttribute('aria-disabled');
        if (el.getAttribute('title') === VIEW_ONLY_TIP) el.removeAttribute('title');
        if (el.tagName === 'BUTTON') el.disabled = false;
      });
    };
  }, [active, onBlocked]);

  return null;
}
