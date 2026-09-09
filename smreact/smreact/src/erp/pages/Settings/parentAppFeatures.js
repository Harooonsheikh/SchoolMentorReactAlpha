/* ═══════════════════════════════════════════════════════════════════
   PARENTS APP — feature catalogue.

   Keys yahan JAAN BUJH kar API ke field names hain
   (POST /manage-parent-app-permission → Mdl_AHM_ParentAppPermission),
   taake UI state aur request body ke darmiyan koi mapping layer na
   banani pare. Swagger sirf EK flag deti hai `academicsResults` —
   isi liye Academics aur Results ek hi checkbox hain.
   ═══════════════════════════════════════════════════════════════════ */

/** API boolean fields, request/response dono ka order. */
export const PARENT_APP_FLAG_KEYS = [
  'attendance',
  'homeWork',
  'academicsResults',
  'fee',
  'timeTable',
  'suggestions',
  'noticeBoard',
  'notebook',
  'leaves',
];

export const PARENT_APP_FEATURE_META = {
  attendance:       { label: 'Attendance',            icon: 'fa-clipboard-check' },
  homeWork:         { label: 'Homework',              icon: 'fa-book-open' },
  academicsResults: { label: 'Academics & Results',   icon: 'fa-chart-simple' },
  fee:              { label: 'Fee',                   icon: 'fa-money-bill-wave' },
  timeTable:        { label: 'Timetable',             icon: 'fa-calendar-days' },
  suggestions:      { label: 'Suggestions',           icon: 'fa-lightbulb' },
  noticeBoard:      { label: 'Notice Board',          icon: 'fa-bullhorn' },
  notebook:         { label: 'Notebook',              icon: 'fa-note-sticky' },
  leaves:           { label: 'Leaves',                icon: 'fa-umbrella-beach' },
};

/** Har flag ko `value` par set karta hai (SAVE body / defaults ke liye). */
export function parentAppFlags(value = false) {
  return PARENT_APP_FLAG_KEYS.reduce((acc, k) => { acc[k] = Boolean(value); return acc; }, {});
}
