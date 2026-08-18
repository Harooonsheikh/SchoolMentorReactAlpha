/* ═══════════════════════════════════════════════════════════════════
   DEFAULT SEARCH PROVIDERS — one per ERP module.

   Each provider is a small object that knows how to search its
   module's data. Today these read from the mock seed files; backend
   integration is a one-file change per provider: replace the body of
   `search()` with an HTTP call to the corresponding service.

   Registered eagerly via `registerAllDefaultProviders()` (called from
   the UniversalSearch component on mount). Backend developers can:
     • Replace any provider's search() with an API call
     • Add new providers for new modules via registerSearchProvider()
     • Override an existing provider by registering a fresh one with
       the same moduleId
   ═══════════════════════════════════════════════════════════════════ */

import { registerSearchProvider, matchAny } from './searchService';
import * as studentService from './studentService';
import * as hrService from './hrService';
import * as feeService from './feeService';
import * as accountsService from './accountsService';
import * as attendanceService from './attendanceService';
import * as timeTableService from './timeTableService';
import * as rolesService from './rolesService';

/* ─── Tiny lazy-load helpers — avoid bundling every mock until a real
       search runs. CRA's webpack hoists these into the main chunk
       anyway, but keeping the call structure makes the API-ready story
       obvious. */
const lazyMock = (loader) => {
  let cached = null;
  return async () => {
    if (cached) return cached;
    cached = await loader();
    return cached;
  };
};

/* ─── REAL-API loaders with a short TTL cache. Students + Employees are
       fetched from the live services (not mock), but cached for `ttl` ms so
       every debounced keystroke doesn't re-hit the API. On any failure we
       fall back to an empty list (search simply returns no hits, never
       throws). Add a student/employee then wait ≤60s and it appears. */
const cachedApi = (loader, ttl = 60000) => {
  let data = null;
  let ts = 0;
  return async () => {
    const now = Date.now();
    if (data && now - ts < ttl) return data;
    try {
      data = await loader();
    } catch {
      data = [];
    }
    ts = now;
    return data;
  };
};
const loadRealStudents  = cachedApi(() => studentService.getStuClasses());
const loadRealEmployees = cachedApi(() => hrService.getHrEmployees());
const loadRealDepts     = cachedApi(() => hrService.getHrDepts());
const loadRealDesigs    = cachedApi(() => hrService.getHrDesigs());
const loadRealFeeClasses = cachedApi(() => feeService.getFeeClasses());
const loadRealFamilies   = cachedApi(() => studentService.getStuFamilies());
const loadRealAccTypes   = cachedApi(() => accountsService.getAccTypes());
const loadRealAccTxns    = cachedApi(() => accountsService.getAccTxns());
const loadRealAttClasses = cachedApi(() => attendanceService.getClassesForBranch());
const loadRealTTClasses  = cachedApi(() => timeTableService.getTimeTableClasses());
const loadRealRoles      = cachedApi(() => rolesService.getRolesByBranch());

const loadLP       = lazyMock(() => import('../mock/lessonPlans'));
const loadExams    = lazyMock(() => import('../mock/exams'));
const loadInv      = lazyMock(() => import('../mock/inventory'));
const loadCrm      = lazyMock(() => import('../mock/admissionCrm'));
const loadAppraisal= lazyMock(() => import('../mock/appraisal'));
const loadPapers   = lazyMock(() => import('../mock/papers'));
const loadAcad     = lazyMock(() => import('../mock/academics'));

/* ─── STUDENTS ────────────────────────────────────────────────── */
const studentsProvider = {
  moduleId:    'students',
  navTarget:   'students',
  moduleLabel: 'Students',
  icon:        'fa-user-graduate',
  accent:      '#2563EB',
  priority:    100,
  async search(query, ctx) {
    const classes = await loadRealStudents();   /* live class/section students */
    const out = [];
    for (const cls of (classes || [])) {
      for (const s of (cls.students || [])) {
        const full = `${s.first || ''} ${s.last || ''}`.trim();
        if (matchAny(
          query,
          full, s.first, s.last, s.father, s.mother, s.guardian,
          s.reg, s.adm, s.mobile, s.gcontact, s.pcontact,
          s.bform, s.fcnic, s.mcnic, s.email,
        )) {
          out.push({
            id:       `stu-${s.reg}`,
            title:    full || s.reg,
            subtitle: `${cls.cls} ${cls.sec} · Reg ${s.reg}${s.adm ? ` · Adm ${s.adm}` : ''}`,
            preview:  [s.father && `Father: ${s.father}`, s.mobile && `Mobile: ${s.mobile}`]
                        .filter(Boolean).join('  ·  '),
            path:     ['Students', 'Active Students', `${cls.cls} ${cls.sec}`],
            navParams:{ studentReg: s.reg, classKey: cls.key },
          });
          if (out.length >= ctx.limit) return out;
        }
      }
    }
    return out;
  },
};

/* ─── HUMAN RESOURCE ──────────────────────────────────────────── */
const hrProvider = {
  moduleId:    'hr',
  navTarget:   'hr',
  moduleLabel: 'Human Resource',
  icon:        'fa-users',
  accent:      '#7C2D92',
  priority:    90,
  async search(query, ctx) {
    const [emps, depts, desigs] = await Promise.all([
      loadRealEmployees(), loadRealDepts(), loadRealDesigs(),
    ]);
    const out = [];
    /* Employees (live — active + inactive) */
    for (const e of (emps || [])) {
      const full = `${e.firstName || ''} ${e.lastName || ''}`.trim();
      if (matchAny(
        query,
        full, e.firstName, e.lastName, e.fn, e.eid, e.cnic,
        e.phone, e.email, e.bankAcc,
      )) {
        out.push({
          id:       `hr-emp-${e.id || e.eid}`,
          title:    full,
          /* eid + (inactive flag) — status only shown when NOT active. */
          subtitle: [e.eid, e.status && e.status !== 'Active' ? e.status : null]
                      .filter(Boolean).join(' · '),
          preview:  [e.phone && `Phone: ${e.phone}`, e.email, e.fn && `Father: ${e.fn}`]
                      .filter(Boolean).join('  ·  '),
          path:     ['Human Resource', 'Employee Management'],
          navParams:{ empId: e.id },
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    /* Departments + designations (live) */
    for (const d of (depts || [])) {
      if (matchAny(query, d.name, d.desc)) {
        out.push({
          id:       `hr-dept-${d.id}`,
          title:    d.name,
          subtitle: 'Department',
          preview:  d.desc || '',
          path:     ['Human Resource', 'HR Basics', 'Departments'],
        });
      }
    }
    for (const d of (desigs || [])) {
      if (matchAny(query, d.name, d.desc)) {
        out.push({
          id:       `hr-desig-${d.id}`,
          title:    d.name,
          subtitle: 'Designation',
          path:     ['Human Resource', 'HR Basics', 'Designations'],
        });
      }
    }
    return out.slice(0, ctx.limit);
  },
};

/* ─── ACADEMICS — lesson plans + notebook plans + activities ──── */
const academicsProvider = {
  moduleId:    'academics',
  navTarget:   'acad',
  moduleLabel: 'Academics',
  icon:        'fa-book-open-reader',
  accent:      '#1E40AF',
  priority:    80,
  async search(query, ctx) {
    const lp   = await loadLP();
    const acad = await loadAcad();
    const out  = [];
    /* Lesson-plan units */
    for (const u of (lp.mockUnits || [])) {
      if (matchAny(query, u.title, u.cls, u.subject, u.topic)) {
        out.push({
          id:       `lp-${u.id || u.title}`,
          title:    u.title || u.topic,
          subtitle: [u.cls, u.subject].filter(Boolean).join(' · ') || 'Lesson Plan',
          path:     ['Academics', 'Lesson Plans'],
          icon:     'fa-book-open',
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    /* Notebook-plan units */
    for (const u of (lp.mockNbUnits || [])) {
      if (matchAny(query, u.title, u.cls, u.subject, u.topic)) {
        out.push({
          id:       `nb-${u.id || u.title}`,
          title:    u.title || u.topic,
          subtitle: [u.cls, u.subject].filter(Boolean).join(' · ') || 'Notebook Plan',
          path:     ['Academics', 'Notebook Plans'],
          icon:     'fa-pen-clip',
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    /* Activities */
    for (const a of (acad.mockActivities || [])) {
      if (matchAny(query, a.title, a.name, a.desc, a.category)) {
        out.push({
          id:       `act-${a.id || a.title || a.name}`,
          title:    a.title || a.name,
          subtitle: a.category || 'Activity',
          preview:  a.desc || '',
          path:     ['Academics', 'Activity Calendar'],
          icon:     'fa-calendar-day',
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── EXAMINATION ─────────────────────────────────────────────── */
const examinationProvider = {
  moduleId:    'examination',
  navTarget:   'exam',
  moduleLabel: 'Examination',
  icon:        'fa-file-pen',
  accent:      '#4F46E5',
  priority:    70,
  async search(query, ctx) {
    const m = await loadExams();
    const out = [];
    for (const ex of (m.mockExams || [])) {
      if (matchAny(query, ex.name, ex.term, ex.session)) {
        out.push({
          id:       `exam-${ex.id || ex.name}`,
          title:    ex.name,
          subtitle: [ex.term, ex.session].filter(Boolean).join(' · '),
          path:     ['Examination'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── PAPER GENERATOR ─────────────────────────────────────────── */
const paperGenProvider = {
  moduleId:    'paper_generator',
  navTarget:   'paper',
  moduleLabel: 'Paper Generator',
  icon:        'fa-scroll',
  accent:      '#7C3AED',
  priority:    60,
  async search(query, ctx) {
    const m = await loadPapers();
    const out = [];
    for (const p of (m.mockPapers || [])) {
      if (matchAny(query, p.title, p.subject, p.cls, p.session, p.code)) {
        out.push({
          id:       `pap-${p.id || p.code || p.title}`,
          title:    p.title || `${p.subject} — ${p.cls}`,
          subtitle: [p.cls, p.subject].filter(Boolean).join(' · '),
          preview:  p.code ? `Code: ${p.code}` : '',
          path:     ['Paper Generator'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── ATTENDANCE — classes ────────────────────────────────────── */
const attendanceProvider = {
  moduleId:    'attendance',
  navTarget:   'att',
  moduleLabel: 'Attendance',
  icon:        'fa-clipboard-check',
  accent:      '#16A34A',
  priority:    55,
  async search(query, ctx) {
    const classes = await loadRealAttClasses();   /* live class × section list */
    const out = [];
    for (const c of (classes || [])) {
      const label = c.label || `${c.className || ''} ${c.sectionName || ''}`.trim();
      if (matchAny(query, c.className, c.sectionName, label)) {
        out.push({
          id:       `att-${c.classID}-${c.sectionID}`,
          title:    label,
          subtitle: 'Class attendance',
          path:     ['Attendance', label],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── TIME TABLE ──────────────────────────────────────────────── */
const timeTableProvider = {
  moduleId:    'timetable',
  navTarget:   'tt',
  moduleLabel: 'Timetable',
  icon:        'fa-calendar-days',
  accent:      '#0891B2',
  priority:    50,
  async search(query, ctx) {
    const classes = await loadRealTTClasses();   /* live class × section list */
    const out = [];
    for (const c of (classes || [])) {
      const label = `${c.name || ''}${c.section ? ' ' + c.section : ''}`.trim();
      if (matchAny(query, c.name, c.section, label)) {
        out.push({
          id:       `tt-${c.id}-${c.sectionID}`,
          title:    label,
          subtitle: 'Class timetable',
          path:     ['Timetable', label],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── FEE ─────────────────────────────────────────────────────── */
const feeProvider = {
  moduleId:    'fee',
  navTarget:   'fee',
  moduleLabel: 'Fee',
  icon:        'fa-money-bill-wave',
  accent:      '#D97706',
  priority:    45,
  async search(query, ctx) {
    const [classes, families] = await Promise.all([
      loadRealFeeClasses(), loadRealFamilies(),
    ]);
    const out = [];
    for (const c of (classes || [])) {
      const label = `${c.cls || ''} ${c.sec || ''}`.trim();
      if (matchAny(query, c.cls, c.sec, c.name, label)) {
        out.push({
          id:       `fee-class-${c.cls || c.name}-${c.sec || ''}`,
          title:    c.name || label || c.cls,
          subtitle: 'Class fee structure',
          path:     ['Fee', 'Classes'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    for (const f of (families || [])) {
      if (matchAny(query, f.name, f.guardian, f.contact, f.email, f.id)) {
        out.push({
          id:       `fee-fam-${f.id}`,
          title:    f.name || f.guardian || `Family ${f.id}`,
          subtitle: `Family · ${f.id || ''}`,
          preview:  f.contact ? `Phone: ${f.contact}` : '',
          path:     ['Fee', 'Family Challan'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── ACCOUNTS ────────────────────────────────────────────────── */
const accountsProvider = {
  moduleId:    'accounts',
  navTarget:   'accounts',
  moduleLabel: 'Accounts',
  icon:        'fa-calculator',
  accent:      '#0F766E',
  priority:    40,
  async search(query, ctx) {
    const [types, txns] = await Promise.all([
      loadRealAccTypes(), loadRealAccTxns(),
    ]);
    const out = [];
    /* Account types + their heads (live). */
    for (const t of (types || [])) {
      if (matchAny(query, t.name, t.key)) {
        out.push({
          id:       `acc-type-${t.id || t.name}`,
          title:    t.name,
          subtitle: 'Account type',
          path:     ['Accounts', 'Heads'],
        });
        if (out.length >= ctx.limit) return out;
      }
      for (const h of (t.heads || [])) {
        if (matchAny(query, h.name, h.no)) {
          out.push({
            id:       `acc-head-${h.recordId || h.no || h.name}`,
            title:    h.name,
            subtitle: `Account head · ${t.name}`,
            path:     ['Accounts', 'Heads'],
          });
          if (out.length >= ctx.limit) return out;
        }
      }
    }
    /* Voucher / day-book entries — real API returns a flat array; the old
       mock was an object keyed by date. Handle both shapes. */
    const txnList = Array.isArray(txns) ? txns : Object.values(txns || {}).flat();
    for (const v of txnList) {
      if (matchAny(query, v.head, v.detail, v.narr, v.voucher, v.createdBy)) {
        out.push({
          id:       `acc-vch-${v.id || v.voucher || v.head}`,
          title:    v.voucher || v.head || 'Voucher',
          subtitle: [v.head, v.date].filter(Boolean).join(' · '),
          preview:  v.detail || v.narr || '',
          path:     ['Accounts', 'Day Book'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── INVENTORY ───────────────────────────────────────────────── */
const inventoryProvider = {
  moduleId:    'inventory',
  navTarget:   'inventory',
  moduleLabel: 'Inventory',
  icon:        'fa-boxes-stacked',
  accent:      '#EA580C',
  priority:    35,
  async search(query, ctx) {
    const m = await loadInv();
    const out = [];
    for (const it of (m.mockInvItems || [])) {
      if (matchAny(query, it.name, it.code, it.category, it.sku)) {
        out.push({
          id:       `inv-${it.id || it.code}`,
          title:    it.name,
          subtitle: [it.category, it.code].filter(Boolean).join(' · '),
          path:     ['Inventory', 'Items'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    for (const p of (m.mockInvProducts || [])) {
      if (matchAny(query, p.name, p.code)) {
        out.push({
          id:       `inv-prod-${p.id || p.code}`,
          title:    p.name,
          subtitle: 'Product',
          path:     ['Inventory', 'Products'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── ADMISSION CRM ───────────────────────────────────────────── */
const admissionCrmProvider = {
  moduleId:    'admission_crm',
  navTarget:   'crm',
  moduleLabel: 'Admission CRM',
  icon:        'fa-user-plus',
  accent:      '#E11D48',
  priority:    30,
  async search(query, ctx) {
    const m = await loadCrm();
    const out = [];
    for (const l of (m.mockCrmLeads || [])) {
      const childName = l.childName || l.studentName || '';
      const parent    = l.parentName || l.father || '';
      if (matchAny(query, childName, parent, l.phone, l.email, l.cnic, l.source, l.classApplied)) {
        out.push({
          id:       `crm-${l.id}`,
          title:    childName || parent || `Lead ${l.id}`,
          subtitle: [l.classApplied, l.status].filter(Boolean).join(' · ') || 'Lead',
          preview:  [parent && `Parent: ${parent}`, l.phone].filter(Boolean).join('  ·  '),
          path:     ['Admission CRM', 'Leads'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── STAFF APPRAISALS ────────────────────────────────────────── */
const appraisalsProvider = {
  moduleId:    'appraisals',
  navTarget:   'appraisal',
  moduleLabel: 'Staff Appraisals',
  icon:        'fa-star-half-stroke',
  accent:      '#B45309',
  priority:    25,
  async search(query, ctx) {
    const m = await loadAppraisal();
    const out = [];
    for (const a of (m.mockAppraisals || [])) {
      if (matchAny(query, a.name, a.empName, a.empId, a.period, a.status)) {
        out.push({
          id:       `apr-${a.id}`,
          title:    a.name || a.empName || `Appraisal ${a.id}`,
          subtitle: [a.period, a.status].filter(Boolean).join(' · '),
          path:     ['Staff Appraisals', 'Appraisals'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── SCHOOL SOPs (data lives inside the page component) ──────── */
const schoolSopsProvider = {
  moduleId:    'school_sops',
  navTarget:   'sops',
  moduleLabel: 'School SOPs',
  icon:        'fa-book-open',
  accent:      '#475569',
  priority:    20,
  async search(query, ctx) {
    const mod = await import('../pages/SchoolMentor/SchoolSOPs');
    const list = mod.SOPS_DATA || mod.SOPS || mod.default?.SOPS_DATA || [];
    const out = [];
    for (const s of list) {
      if (matchAny(query, s.title, s.category, s.version, s.status)) {
        out.push({
          id:       `sop-${s.id || s.title}`,
          title:    s.title,
          subtitle: [s.category, s.version].filter(Boolean).join(' · '),
          preview:  s.status ? `Status: ${s.status}` : '',
          path:     ['School SOPs', s.category || 'Library'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── TEACHER TRAININGS ───────────────────────────────────────── */
const teacherTrainingsProvider = {
  moduleId:    'teacher_trainings',
  navTarget:   'trainings',
  moduleLabel: 'Teacher Trainings',
  icon:        'fa-chalkboard-user',
  accent:      '#8B5CF6',
  priority:    15,
  async search(query, ctx) {
    const mod = await import('../pages/SchoolMentor/TeacherTrainings');
    const list = mod.TRAININGS_DATA || mod.TRAININGS || mod.default?.TRAININGS_DATA || [];
    const out = [];
    for (const t of list) {
      if (matchAny(query, t.topic, t.title, t.description, t.category, t.trainer, t.trainerDesignation)) {
        out.push({
          id:       `trn-${t.id || t.topic || t.title}`,
          title:    t.topic || t.title,
          subtitle: [t.category, t.trainer].filter(Boolean).join(' · '),
          preview:  t.description || '',
          path:     ['Teacher Trainings', `${t.category || 'Trainings'}`],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── AUDIT LOGS ──────────────────────────────────────────────── */
const auditLogsProvider = {
  moduleId:    'audit_logs',
  navTarget:   'audit',
  moduleLabel: 'Audit Logs',
  icon:        'fa-clipboard-list',
  accent:      '#DC2626',
  priority:    10,
  async search(query, ctx) {
    const mod  = await import('../pages/AuditLogs/auditLogsData');
    const list = mod.MOCK_LOGS || mod.AUDIT_LOGS || mod.LOGS || mod.default?.MOCK_LOGS || [];
    const out = [];
    for (const l of list) {
      if (matchAny(query, l.action, l.actor, l.target, l.module, l.user, l.detail, l.severity)) {
        out.push({
          id:       `log-${l.id}`,
          title:    l.action || `Log #${l.id}`,
          subtitle: [l.module, l.actor || l.user].filter(Boolean).join(' · '),
          preview:  l.detail || '',
          path:     ['Audit Logs'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── USER PERMISSIONS — users + roles ────────────────────────── */
const userPermissionsProvider = {
  moduleId:    'user_permissions',
  navTarget:   'perm',
  moduleLabel: 'User Permissions',
  icon:        'fa-shield-halved',
  accent:      '#1E3A8A',
  priority:    5,
  async search(query, ctx) {
    const mod = await import('../pages/UserPermissions/permissionsData');
    const out = [];
    const users = mod.MOCK_USERS || mod.USERS || [];
    for (const u of users) {
      const full = u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (matchAny(query, full, u.email, u.role, u.empId, u.dept)) {
        out.push({
          id:       `perm-u-${u.id || u.email}`,
          title:    full,
          subtitle: [u.role, u.dept].filter(Boolean).join(' · '),
          preview:  u.email || '',
          path:     ['User Permissions', 'Users'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    /* Roles — LIVE from /get-roles-by-branch (users above stay mock: no
       live users endpoint yet). */
    const roles = await loadRealRoles();
    for (const r of (roles || [])) {
      const name = r.roleName || r.name;
      if (matchAny(query, name, r.description, r.scope)) {
        out.push({
          id:       `perm-r-${r.id || name}`,
          title:    name,
          subtitle: 'Role',
          preview:  r.description || '',
          path:     ['User Permissions', 'Roles'],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── SETTINGS ────────────────────────────────────────────────── */
const settingsProvider = {
  moduleId:    'settings',
  navTarget:   'settings',
  moduleLabel: 'Settings',
  icon:        'fa-gear',
  accent:      '#64748B',
  priority:    3,
  async search(query, ctx) {
    try {
      const mod = await import('../pages/Settings/settingsStore');
      const sessions   = mod.getSessions   ? mod.getSessions()   : (mod.SESSIONS   || []);
      const signatures = mod.getSignatures ? mod.getSignatures() : (mod.SIGNATURES || []);
      const out = [];
      for (const s of sessions) {
        if (matchAny(query, s.label, s.code, s.from, s.to)) {
          out.push({
            id:       `set-ses-${s.id}`,
            title:    s.label || `Session ${s.id}`,
            subtitle: 'Academic Session',
            path:     ['Settings', 'Session Management'],
          });
          if (out.length >= ctx.limit) return out;
        }
      }
      for (const s of signatures) {
        if (matchAny(query, s.name, s.title, s.designation, s.email)) {
          out.push({
            id:       `set-sig-${s.id}`,
            title:    s.name,
            subtitle: s.designation || s.title || 'Signature',
            path:     ['Settings', 'Signature Management'],
          });
          if (out.length >= ctx.limit) return out;
        }
      }
      return out;
    } catch {
      return [];
    }
  },
};

/* ─── LAUNCH SETUP — searches over the activation registry ────── */
const launchSetupProvider = {
  moduleId:    'launch_setup',
  navTarget:   'launch',
  moduleLabel: 'Launch Setup',
  icon:        'fa-rocket',
  accent:      '#1E40AF',
  priority:    2,
  async search(query, ctx) {
    const mod = await import('../config/moduleConfig');
    const reg = mod.MODULE_REGISTRY || [];
    const out = [];
    for (const m of reg) {
      if (matchAny(query, m.label, m.group, m.id)) {
        out.push({
          id:       `launch-${m.id}`,
          title:    m.label,
          subtitle: `${m.group} · Module`,
          preview:  m.coreLocked ? 'Core module — always active' : 'Module activation',
          path:     ['Launch Setup', m.group],
        });
        if (out.length >= ctx.limit) return out;
      }
    }
    return out;
  },
};

/* ─── Register all defaults once. Idempotent — repeated calls
       (e.g. hot reload) just overwrite the same registry slots. */
let _registered = false;
export function registerAllDefaultProviders() {
  if (_registered) return;
  _registered = true;
  [
    studentsProvider, hrProvider, academicsProvider, examinationProvider,
    paperGenProvider, attendanceProvider, timeTableProvider, feeProvider,
    accountsProvider, inventoryProvider, admissionCrmProvider,
    appraisalsProvider, schoolSopsProvider, teacherTrainingsProvider,
    auditLogsProvider, userPermissionsProvider, settingsProvider,
    launchSetupProvider,
  ].forEach(registerSearchProvider);
}
