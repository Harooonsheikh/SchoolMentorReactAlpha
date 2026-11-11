import { useCallback, useMemo, useState } from 'react';
import * as complianceApi from '../../services/complianceApi';
import { STATUS, STATUS_META } from '../../mock/compliance';

/* ═══════════════════════════════════════════════════════════════════
   Daily / Weekly / Monthly tabs ka shared data layer.

   Teeno tabs wohi backend task list (task-list) dikhate hain jo
   Compliance Setup mein banti hai — koi dummy/mock template nahi.
   Ek task ki check state (status, remark, evidence photo, verification)
   backend par usi task row par save hoti hai (task-action ke Status /
   Remarks / RemarksPicFile / CheckDate / VerifiedBy fields), is liye
   Setup mein task add/edit karne par wo foran in tabs mein bhi aa
   jata hai aur yahan mark karne par Setup ka data kharab nahi hota.

   NOTE (backend limitation): per-date check history ka koi endpoint
   nahi hai — har task par ek hi current status + checkDate hai. Is
   liye page us period ka status tab dikhata hai jab task ka checkDate
   usi period (din / hafta / mahina) ka ho; warna wo task us period ke
   liye "Not Checked" hai. Save karte waqt CheckDate wahi period ka din
   jata hai jo user dekh raha hai.
   ═══════════════════════════════════════════════════════════════════ */

/* dashArea (Overview ke 6 areas) -> Problems ki category */
const CATEGORY_BY_DASH_AREA = {
  cleanliness: 'Cleanliness',
  facilities: 'Facilities',
  safety: 'Safety',
  staff: 'Staff',
  academics: 'Academics',
  administration: 'Administration',
};
export const categoryOf = (dashArea) => CATEGORY_BY_DASH_AREA[dashArea] || 'Administration';

/* Checklist items ko area/dashArea par group karna. `order` di ho to
   pehle usi tarteeb se, baqi (school ke apne custom areas) baad mein. */
export function groupItems(items, { keyOf = (i) => i.area, labelOf = (i) => i.areaLabel, order = [] } = {}) {
  const map = new Map();
  items.forEach((i) => {
    const key = keyOf(i);
    if (!map.has(key)) map.set(key, { area: key, areaLabel: labelOf(i), items: [] });
    map.get(key).items.push(i);
  });
  const first = order.map((id) => map.get(id)).filter(Boolean);
  const rest = [...map.values()].filter((g) => !order.includes(g.area));
  return [...first, ...rest];
}

/* Assigned Staff filter dropdown — branch ke SAARE employees
   (get-employees-by-branch), naam ke hisaab se sorted */
export function staffOptionsOf(employees) {
  return [...(employees || [])].sort((a, b) => a.name.localeCompare(b.name));
}

/* Assigned Staff filter — employee id se match, aur purane tasks
   (jin par sirf naam hai, id nahi) ke liye naam se */
export function filterByStaff(items, staffId, employees) {
  if (!staffId) return items;
  const emp = (employees || []).find((e) => String(e.id) === String(staffId));
  const name = complianceApi.norm(emp?.name);
  return items.filter((i) =>
    (i.assignedToId && String(i.assignedToId) === String(staffId))
    || (!i.assignedToId && name && complianceApi.norm(i.assignedTo) === name));
}

/* Backend task list -> ek frequency + period ke checklist instances.
   Daily / Weekly / Monthly tabs aur Reports tab dono yahi use karte hain,
   ta ke report ke numbers bilkul tab jaise hon. */
export function buildCheckInstances({ tasks, areas = [], employeeNames = new Map(), frequency, periodKey }) {
  if (!tasks) return null;
  const areaMap = new Map((areas || []).map((a) => [a.id, a.name]));
  return tasks
    .map((t) => complianceApi.toInstance(t, { areaMap, employeeNames, periodKey }))
    .filter((i) => i.frequency === frequency && i.active)
    /* Sirf wohi tasks jo chuni hui period (din / hafta / mahina) mein
       add hue. Jis row par created date hi na ho use chhupate nahi. */
    .filter((i) => !i.createdDate || complianceApi.inPeriod(i.createdDate, frequency, periodKey));
}

export default function useComplianceChecks({
  frequency,
  periodKey,          // daily: 'YYYY-MM-DD' | weekly: hafte ka Monday | monthly: 'YYYY-MM'
  checkDate,          // save par backend ko bhejne wali tareekh
  tasks = null,
  areas = [],
  onTasksChange = () => {},
  toast = () => {},
  employees = [],          // parent (SchoolCompliance) se — module khulne par ek dafa load
  employeesLoading = false,
}) {
  const [busy, setBusy] = useState(false);

  const employeeNames = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);

  /* tasks === null => ab bhi load ho rahe hain */
  const instances = useMemo(
    () => buildCheckInstances({ tasks, areas, employeeNames, frequency, periodKey }),
    [tasks, areas, employeeNames, frequency, periodKey],
  );

  const byId = useMemo(() => new Map((instances || []).map((i) => [i.id, i])), [instances]);

  /* ChecklistRow se aane wala patch: { status, remark, evidence } ya
     { verifiedBy } (verify button) */
  const update = useCallback(async (id, patch) => {
    const item = byId.get(id);
    if (!item) return false;

    const next = { ...patch, checkDate };
    if (patch.verifiedBy !== undefined) {
      const me = complianceApi.getCurrentUser();
      if (!me.id) { toast('Could not save the verification — no signed-in user id found.', 'error'); return false; }
      next.verifiedBy = me.id;
    }

    setBusy(true);
    try {
      await complianceApi.saveTaskCheck(item, next);
      await onTasksChange();
      /* Status badla to "Marked ..."; sirf remark/photo save hua to
         Save button ka apna message */
      if (patch.verifiedBy !== undefined) toast(`"${item.label}" verified.`, 'success');
      else if (patch.status && patch.status !== item.status) toast(`Marked "${STATUS_META[patch.status]?.label || patch.status}".`, 'success');
      else toast('Changes saved.', 'success');
      return true;
    } catch (e) {
      toast(e?.message || 'Could not save the update.', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }, [byId, checkDate, onTasksChange, toast]);

  /* "Mark All Non-Safety Tasks Completed" — safety checks (jin par
     remark zaroori hai) chhod deta hai */
  const bulkComplete = useCallback(async (list) => {
    const todo = list.filter((i) => i.status === STATUS.NOT_CHECKED && !i.verificationRequired);
    const skipped = list.filter((i) => i.status === STATUS.NOT_CHECKED && i.verificationRequired).length;
    if (!todo.length) {
      toast(skipped
        ? `Only ${skipped} safety check${skipped === 1 ? '' : 's'} left — complete those individually.`
        : 'Nothing left to mark.', 'info');
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        todo.map((i) => complianceApi.saveTaskCheck(i, { status: STATUS.COMPLETED, checkDate })),
      );
      await onTasksChange();
      const failed = results.filter((r) => r.status === 'rejected').length;
      const done = todo.length - failed;
      if (failed) toast(`${done} task${done === 1 ? '' : 's'} completed — ${failed} could not be saved.`, 'error');
      else toast(`Marked ${done} task${done === 1 ? '' : 's'} as Completed${skipped ? ` — ${skipped} safety check${skipped === 1 ? '' : 's'} skipped.` : '.'}`, 'success');
    } finally {
      setBusy(false);
    }
  }, [checkDate, onTasksChange, toast]);

  /* Issue Found -> Problems & Follow-ups (asli problem-report API) */
  const saveProblem = useCallback(async (payload) => {
    try {
      await complianceApi.reportProblem(payload);
      toast('Problem reported — visible in Problems & Follow-ups.', 'success');
      return true;
    } catch (e) {
      toast(e?.message || 'Could not report the problem.', 'error');
      return false;
    }
  }, [toast]);

  return { instances, employees, employeesLoading, employeeNames, busy, update, bulkComplete, saveProblem };
}
