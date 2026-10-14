/* ═══════════════════════════════════════════════════════════════════
   ID CARD FIELD CATALOG — every field a school can choose to show on a
   Student or Staff ID card, grouped exactly as requested, each backed
   by a real property already present on the existing student/employee
   data models (see StuStudentModal's onSave payload in Students.jsx
   and AddEmployeeModal's `form` in HumanResource.jsx). Fields with no
   backing data on the CURRENT model (e.g. Student Blood Group, Student
   Transport Route — neither field exists on a student record today)
   are still listed, per spec, but flagged `unavailable: true` so the
   Designer can grey them out instead of inventing data — flip that
   flag the day the underlying field is added to the data model.

   `getValue(entity, ctx)` — entity is the student/employee record;
   ctx carries the extra context a field needs (class/dept/school/etc).
   Returning '' / null / undefined means "no data" — IdCardFace and the
   print builder both skip a selected-but-empty field automatically.
   ═══════════════════════════════════════════════════════════════════ */

const fullName = (s) => s.name || `${s.first || ''} ${s.last || ''}`.trim();

export const STUDENT_FIELD_GROUPS = [
  {
    id: 'basic', label: 'Basic Information',
    fields: [
      { key: 'photo',        label: 'Student Photo',      kind: 'photo' },
      { key: 'fullName',     label: 'Student Full Name',  getValue: (s) => fullName(s) },
      { key: 'firstName',    label: 'First Name',         getValue: (s) => s.first },
      { key: 'lastName',     label: 'Last Name',          getValue: (s) => s.last },
      { key: 'reg',          label: 'Registration Number',getValue: (s) => s.reg },
      { key: 'adm',          label: 'Admission Number',   getValue: (s) => s.adm },
      { key: 'classSection', label: 'Class & Section',    getValue: (s, ctx) => [ctx.cls?.cls, ctx.cls?.sec ? `(${ctx.cls.sec})` : ''].filter(Boolean).join(' ') },
      { key: 'session',      label: 'Academic Session',   getValue: (s, ctx) => ctx.school?.session },
      { key: 'dob',          label: 'Date of Birth',      getValue: (s) => s.dob },
      { key: 'gender',       label: 'Gender',             getValue: (s) => s.gender },
      { key: 'bloodGroup',   label: 'Blood Group',        getValue: () => undefined, unavailable: true },
    ],
  },
  {
    id: 'parent', label: 'Parent & Guardian Information',
    fields: [
      { key: 'father',    label: "Father's Name",              getValue: (s) => s.father },
      { key: 'mother',    label: "Mother's Name",               getValue: (s) => s.mother },
      { key: 'guardian',  label: "Guardian's Name",             getValue: (s) => s.guardian },
      { key: 'gcontact',  label: 'Parent / Guardian Contact',   getValue: (s) => s.gcontact || s.mobile },
    ],
  },
  {
    /* School Name / Logo / Address / Contact Number / Email are governed
       by the dedicated "School Branding" panel (design.branding) instead
       of living in this ordered field list — they're letterhead chrome
       every theme places in its own header/footer, not a body row a
       school would want to drag between "Father's Name" and "DOB". Only
       Campus Name behaves like a normal orderable body field. */
    id: 'school', label: 'School Information',
    fields: [
      { key: 'campus', label: 'Campus Name', getValue: (s, ctx) => ctx.school?.campus },
    ],
  },
  {
    id: 'additional', label: 'Additional Information',
    fields: [
      { key: 'address',        label: 'Student Address',    getValue: (s) => s.address },
      { key: 'emergency',      label: 'Emergency Contact',  getValue: () => undefined, unavailable: true },
      { key: 'transportRoute', label: 'Transport Route',    getValue: () => undefined, unavailable: true },
      { key: 'houseGroup',     label: 'House / Group',      getValue: () => undefined, unavailable: true },
      { key: 'issueDate',      label: 'Issue Date',         getValue: (s, ctx) => ctx.issueDate },
      { key: 'expiryDate',     label: 'Expiry Date',        getValue: (s, ctx) => ctx.expiryDate },
    ],
  },
];

export const STAFF_FIELD_GROUPS = [
  {
    id: 'basic', label: 'Basic Information',
    fields: [
      { key: 'photo',       label: 'Employee Photo',     kind: 'photo' },
      { key: 'fullName',    label: 'Employee Full Name', getValue: (e) => `${e.firstName || e.name || ''}${e.lastName ? ' ' + e.lastName : ''}`.trim() },
      { key: 'eid',         label: 'Employee ID',        getValue: (e) => e.eid },
      { key: 'empCode',     label: 'Employee Code',      getValue: (e) => e.eid },
      { key: 'designation', label: 'Designation',        getValue: (e, ctx) => ctx.desigName },
      { key: 'department',  label: 'Department',         getValue: (e, ctx) => ctx.deptName },
      { key: 'empType',     label: 'Employee Type',      getValue: (e) => e.type },
      { key: 'joinDate',    label: 'Joining Date',       getValue: (e) => e.join },
      { key: 'dob',         label: 'Date of Birth',      getValue: (e) => e.dob },
      { key: 'gender',      label: 'Gender',             getValue: (e) => e.gender },
      { key: 'bloodGroup',  label: 'Blood Group',        getValue: (e) => e.blood },
    ],
  },
  {
    id: 'contact', label: 'Contact Information',
    fields: [
      { key: 'phone',     label: 'Employee Contact Number', getValue: (e) => e.phone },
      { key: 'emergency', label: 'Emergency Contact',       getValue: (e) => e.emergency },
      { key: 'email',     label: 'Email Address',           getValue: (e) => e.email },
      { key: 'address',   label: 'Residential Address',     getValue: (e) => e.address },
    ],
  },
  {
    /* Same note as the student catalog: School Name/Logo/Address/
       Contact/Email live in design.branding, not this ordered list. */
    id: 'school', label: 'School Information',
    fields: [
      { key: 'campus', label: 'Campus Name', getValue: (e, ctx) => ctx.school?.campus },
    ],
  },
  {
    id: 'additional', label: 'Additional Information',
    fields: [
      { key: 'qual',         label: 'Qualification',       getValue: (e) => e.qual },
      { key: 'status',       label: 'Employment Status',   getValue: (e) => e.status },
      { key: 'staffCategory',label: 'Staff Category',      getValue: (e, ctx) => ctx.deptName },
      { key: 'issueDate',    label: 'Issue Date',          getValue: (e, ctx) => ctx.issueDate },
      { key: 'expiryDate',   label: 'Expiry Date',         getValue: (e, ctx) => ctx.expiryDate },
    ],
  },
];

export function fieldGroups(kind) {
  return kind === 'staff' ? STAFF_FIELD_GROUPS : STUDENT_FIELD_GROUPS;
}

export function allFields(kind) {
  return fieldGroups(kind).flatMap((g) => g.fields.map((f) => ({ ...f, group: g.label })));
}

export function findField(kind, key) {
  return allFields(kind).find((f) => f.key === key);
}

/* Resolve the user's selected+ordered field keys into display-ready
   rows for the current entity, skipping special kinds (photo/logo/qr/
   barcode — each layout renders those itself) and skipping any field
   that resolves to no data (unless it was explicitly forced on via
   `showEmpty`, e.g. so a school can still show an "Emergency Contact:"
   label as a fill-in-by-hand blank line if it really wants to). */
export function resolveDisplayFields(kind, fieldKeys, entity, ctx, showEmpty = false) {
  const catalog = allFields(kind);
  return (fieldKeys || [])
    .map((key) => catalog.find((f) => f.key === key))
    .filter((f) => f && !f.kind && !f.unavailable)
    .map((f) => ({ key: f.key, label: f.label, value: f.getValue ? f.getValue(entity, ctx) : undefined }))
    .filter((row) => showEmpty || (row.value !== undefined && row.value !== null && String(row.value).trim() !== ''));
}

/* Sensible starting selection + order for a brand-new (never-saved)
   design, per module — matches the example order given in the spec
   (photo, name, id, class/section, father, contact, ...). */
export const DEFAULT_FIELD_ORDER = {
  student: ['photo', 'fullName', 'reg', 'classSection', 'father', 'gcontact', 'dob', 'session'],
  staff: ['photo', 'fullName', 'eid', 'designation', 'department', 'phone', 'joinDate'],
};

/* Split a field-key list into { orderable, special } — special being
   photo (QR/barcode are no longer part of `fields` at all — see
   design.qr/design.barcode below), which every theme places in a fixed
   slot of its own rather than a reorderable body row. */
export function splitFieldKinds(kind, keys) {
  const catalog = allFields(kind);
  const orderable = [];
  const special = [];
  (keys || []).forEach((key) => {
    const f = catalog.find((x) => x.key === key);
    if (!f) return;
    (f.kind ? special : orderable).push(key);
  });
  return { orderable, special };
}
