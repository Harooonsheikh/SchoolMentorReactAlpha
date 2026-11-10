import { useCallback, useEffect, useMemo, useState } from 'react';
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

/* Filter dropdown ke liye wohi staff jo in tasks par assigned hain */
export function staffOptionsOf(items) {
  return [...new Set(items.map((i) => i.assignedTo).filter((n) => n && n !== '-'))].sort();
}

export default function useComplianceChecks({
  frequency,
  periodKey,          // daily: 'YYYY-MM-DD' | weekly: hafte ka Monday | monthly: 'YYYY-MM'
  checkDate,          // save par backend ko bhejne wali tareekh
  tasks = null,
  areas = [],
  onTasksChange = () => {},
  toast = () => {},
}) {
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  /* Branch ke employees — assignee ka naam aur Report a Problem ka
     Assign To dropdown (backend kabhi assignedToName khali bhejta hai) */
  useEffect(() => {
    let alive = true;
    complianceApi.getBranchEmployees()
      .then((list) => { if (alive) setEmployees(list); })
      .catch(() => { /* naam na mile to id se '-' dikha dete hain */ })
      .finally(() => { if (alive) setEmployeesLoading(false); });
    return () => { alive = false; };
  }, []);

  const employeeNames = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);

  /* tasks === null => ab bhi load ho rahe hain */
  const instances = useMemo(() => {
    if (!tasks) return null;
    const areaMap = new Map((areas || []).map((a) => [a.id, a.name]));
    return tasks
      .map((t) => complianceApi.toInstance(t, { areaMap, employeeNames, periodKey }))
      .filter((i) => i.frequency === frequency && i.active);
  }, [tasks, areas, employeeNames, frequency, periodKey]);

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
