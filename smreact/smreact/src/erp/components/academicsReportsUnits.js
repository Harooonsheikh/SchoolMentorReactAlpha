/* Notebook / Question Bank unit helpers — copied from the demo's
   pages/Dashboard/academicsDashboardExtra.js (nbUnitItems / nbUnitStatus)
   so the Reports tab does not depend on the Dashboard module.
   Rule: a unit counts as "submitted" once EVERY item inside it is submitted. */
export function nbUnitItems(unit) {
  return (unit.questionTypes || []).flatMap((qt) => qt.items || []);
}

export function nbUnitStatus(unit) {
  const items = nbUnitItems(unit);
  return items.length && items.every((i) => i.status === 'submitted') ? 'submitted' : 'pending';
}
