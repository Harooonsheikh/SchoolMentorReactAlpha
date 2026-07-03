  import React, { useState, useMemo, useCallback, useEffect } from "react";
  import { createPortal } from "react-dom";
  import Tooltip from "./Tooltip";
  import TutorialModal from "./TutorialModal";
  import * as attendanceService from "../services/attendanceService";
  import useAsync from "../hooks/useAsync";

  /* ============================================================================
    SchoolMentor ERP — Attendance Module (React / JSX)
    ----------------------------------------------------------------------------
    Faithful React port of the original vanilla-JS Attendance screen.
    - Vanilla DOM manipulation (getElementById / innerHTML / onclick) has been
      replaced with React state (useState) and real event handlers.
    - Four tabs: Holidays Setup · Student Attendance · Staff Attendance · Reports
    - Inline styles + CSS variables, matching the original blue-gradient design.

    Drop-in usage:
        import Attendance from "./Attendance";
        <Attendance onToast={(msg, type) => ...} />

    The optional `onToast(message, type)` prop lets a parent shell show toasts.
    ========================================================================== */

  /* ─── Design tokens (scoped, mirrors :root from the original) ─────────────── */
  /* Design tokens — wired to global CSS variables so dark mode just works.
    The fallback after each `var(...)` keeps storybook / isolated previews
    readable when the global stylesheet is not loaded. */
  const T = {
    brandPrimary:  "var(--brand-primary, #1E3A8A)",
    brandDark:     "var(--brand-dark, #1E40AF)",
    brandMid:      "var(--brand-mid, #2563EB)",
    brandLight:    "var(--brand-light, #DBEAFE)",
    bgBase:        "var(--bg-base, #F0F4FF)",
    bgCard:        "var(--bg-card, #FFFFFF)",
    bgMuted:       "var(--bg-muted, #EFF6FF)",
    textPrimary:   "var(--text-primary, #0F172A)",
    textSecondary: "var(--text-secondary, #1E3A5F)",
    textMuted:     "var(--text-muted, #64748B)",
    success:       "var(--success, #16A34A)",
    warning:       "var(--warning, #D97706)",
    error:         "var(--error, #DC2626)",
    borderLight:   "var(--border-light, #BFDBFE)",
    borderMed:     "var(--border-med, #93C5FD)",
    radiusMd:      "var(--radius-md, 10px)",
    radiusLg:      "var(--radius-lg, 14px)",
    radiusFull:    "var(--radius-full, 9999px)",
    shadowXs:      "var(--shadow-xs, 0 1px 2px rgba(0,0,0,.06))",
    shadowSm:      "var(--shadow-sm, 0 2px 6px rgba(30,58,138,.18), 0 1px 2px rgba(0,0,0,.05))",
    font:          "var(--font-body, 'Plus Jakarta Sans', system-ui, sans-serif)",
    tr:            "var(--tr, all .2s cubic-bezier(.4,0,.2,1))",
  };

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DAYS_S = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAYS_F = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const DAY_ICONS = ["📅", "📆", "📅", "📆", "📅", "🏖️", "🏡"];

  /* ─── Seed data (ported from the original ATT object) ─────────────────────── */
  /* Holidays, student & staff attendance now load via attendanceService
    (src/services/attendanceService.js). Local mutations stay in-memory
    until backend wires the matching endpoints. */

  const REPORT_GROUPS = [
    {
      title: "Student Attendance Report",
      sub: "Daily, monthly and class-wise student reports",
      icon: "fa-user-graduate",
      gradient: "linear-gradient(135deg,#1E3A8A,#2563EB)",
      accent: "#1E40AF",
      reports: [
        { key:"studentDaily",     label:"Daily Attendance",   icon:"fa-calendar-day",  filters:[{ k:"Select Date",  field:"date",  type:"date"  }] },
        { key:"studentMonthly",   label:"Monthly Attendance", icon:"fa-calendar-days", filters:[{ k:"Select Month", field:"month", type:"month" }] },
        { key:"studentClasswise", label:"Class-wise Report",  icon:"fa-layer-group",   filters:[{ k:"Class",     field:"class", type:"class" }, { k:"From Date", field:"from", type:"date" }, { k:"To Date", field:"to", type:"date" }] },
        { key:"studentSummary",   label:"Summary Report",     icon:"fa-chart-pie",     filters:[{ k:"From Date", field:"from", type:"date" }, { k:"To Date", field:"to", type:"date" }] },
      ],
    },
    {
      title: "Staff Attendance Report",
      sub: "Daily, monthly and summary staff reports",
      icon: "fa-users",
      gradient: "linear-gradient(135deg,#065f46,#059669)",
      accent: "#059669",
      reports: [
        { key:"staffDaily",   label:"Daily Attendance",     icon:"fa-calendar-day",  filters:[{ k:"Select Date",  field:"date",  type:"date"  }] },
        { key:"staffMonthly", label:"Monthly Attendance",   icon:"fa-calendar-days", filters:[{ k:"Select Month", field:"month", type:"month" }] },
        { key:"staffSummary", label:"Attendance Summary",   icon:"fa-chart-pie",     filters:[{ k:"Select Month", field:"month", type:"month" }] },
      ],
    },
    {
      title: "Monthly Class Reports",
      sub: "Class overview, comparison and alert reports",
      icon: "fa-chalkboard-user",
      gradient: "linear-gradient(135deg,#7c3aed,#8b5cf6)",
      accent: "#7c3aed",
      reports: [
        { key:"classOverview",   label:"Class Overview",        icon:"fa-chart-bar",            filters:[{ k:"Select Month", field:"month", type:"month" }] },
        { key:"classComparison", label:"Class Comparison",      icon:"fa-code-compare",         filters:[{ k:"Select Month", field:"month", type:"month" }] },
        { key:"lowAttendance",   label:"Low Attendance Alert",  icon:"fa-triangle-exclamation", filters:[{ k:"Select Month", field:"month", type:"month" }], altGradient:"linear-gradient(135deg,#b45309,#d97706)", altAccent:"#D97706" },
      ],
    },
    {
      title: "Holidays Report",
      sub: "Yearly and monthly holiday summaries",
      icon: "fa-calendar-xmark",
      gradient: "linear-gradient(135deg,#be123c,#e11d48)",
      accent: "#be123c",
      reports: [
        { key:"holidayYearly",  label:"Yearly Holidays",  icon:"fa-calendar-xmark", filters:[{ k:"Academic Year", field:"year",  type:"year"  }] },
        { key:"holidayMonthly", label:"Monthly Holidays", icon:"fa-calendar-minus", filters:[{ k:"Select Month",  field:"month", type:"month" }] },
      ],
    },
  ];

  const CLASS_OPTIONS = ["All Classes", "Class I", "Class II", "Class III", "Class IV", "Class V"];
  // Month options span several years (not just 2026) → har saal ke months.
  const genMonthYearOptions = (back = 3, fwd = 3) => {
    const y = new Date().getFullYear();
    const out = [];
    for (let yr = y - back; yr <= y + fwd; yr++) MONTHS.forEach((m) => out.push(`${m} ${yr}`));
    return out;
  };
  const MONTH_OPTIONS = genMonthYearOptions();
  const CURRENT_MONTH_LABEL = `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;
  const YEAR_OPTIONS  = ["2025-2026", "2024-2025", "2023-2024"];

  /* "July 2026" → { year: 2026, monthIdx0: 6 } for month-range attendance fetch. */
  const parseMonthLabel = (label) => {
    const [mName, yr] = String(label || "").trim().split(/\s+/);
    const monthIdx0 = MONTHS.indexOf(mName);
    return {
      year: Number(yr) || new Date().getFullYear(),
      monthIdx0: monthIdx0 < 0 ? new Date().getMonth() : monthIdx0,
    };
  };

  /* Individual Reports rosters */
  const RPT_STUDENTS_BY_CLASS = [
    { cls:"Class I",   sec:"Red",   total:38, teacher:"Ms. Ayesha Raza", students:[
      { name:"Ali Hassan",   fn:"Hassan Ali",   roll:"2024-001", adm:"2024-001" },
      { name:"Bilal Ahmed",  fn:"Ahmed Bilal",  roll:"2024-002", adm:"2024-002" },
    ]},
    { cls:"Class I",   sec:"Blue",  total:36, teacher:"Ms. Ayesha Raza", students:[
      { name:"Sara Khan",    fn:"Khan Sara",    roll:"2024-003", adm:"2024-003" },
      { name:"Fatima Malik", fn:"Malik Fatima", roll:"2024-004", adm:"2024-004" },
    ]},
    { cls:"Class II",  sec:"Blue",  total:35, teacher:"Mr. Bilal Ahmed", students:[
      { name:"Umar Sheikh",  fn:"Sheikh Umar",  roll:"2024-005", adm:"2024-005" },
      { name:"Ayesha Raza",  fn:"Raza Ayesha",  roll:"2024-006", adm:"2024-006" },
    ]},
    { cls:"Class III", sec:"White", total:42, teacher:"Ms. Sana Tariq",  students:[
      { name:"Hira Butt",    fn:"Butt Hira",    roll:"2024-008", adm:"2024-008" },
      { name:"Omar Farooq",  fn:"Farooq Omar",  roll:"2024-009", adm:"2024-009" },
    ]},
    { cls:"Class IV",  sec:"Green", total:39, teacher:"Ms. Sana Tariq",  students:[
      { name:"Zain Qureshi", fn:"Qureshi Zain", roll:"2024-007", adm:"2024-007" },
      { name:"Nadia Shah",   fn:"Shah Nadia",   roll:"2024-010", adm:"2024-010" },
    ]},
  ];

  /* ─── Helpers ─────────────────────────────────────────────────────────────── */
  const fmtTime = (t) => {
    if (!t || !t.includes(":")) return t || "—";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m < 10 ? "0" + m : m} ${ampm}`;
  };
  const platIcon = (p) => (p === "ERP" ? "💻" : p === "Mobile App" ? "📱" : p === "Biometric" ? "🖐️" : "—");

  /* Resolve a ClassID+SectionID to a readable "Class - Section" label using
    the branch class list (from getClassesForBranch). Falls back to raw IDs. */
  const labelForClass = (classList, classID, sectionID) => {
    const found = (classList || []).find(
      (c) => String(c.classID) === String(classID) && String(c.sectionID) === String(sectionID)
    );
    return found ? found.label : `Class ${classID} - Sec ${sectionID}`;
  };

  /* The /api/attendance-monthly-setup "get" response is FLAT — one row per
    holiday × class × section. Group by holiday ID so each holiday appears
    ONCE with all its class+section pairs collected under selectedClasses. */
  function groupHolidayRows(rows, classList) {
    const byId = new Map();
    (rows || []).forEach((r) => {
      const id = r.ID ?? r.id;
      if (id == null) return;
      if (!byId.has(id)) {
        const from = String(r.DateFrom ?? r.dateFrom ?? "").slice(0, 10);
        const to   = String(r.DateTo ?? r.dateTo ?? "").slice(0, 10);
        const monthNum = r.Month ?? r.month;
        const month = monthNum != null && monthNum !== ""
          ? Number(monthNum) - 1                       // API month is 1-based
          : (from ? new Date(from).getMonth() : 0);
        byId.set(id, {
          id,
          title: r.HolidayTitle ?? r.holidayTitle ?? "",
          desc: r.Description ?? r.description ?? "",
          from, to, month,
          selectedClasses: [],
        });
      }
      const classID   = r.ClassID ?? r.classID;
      const sectionID = r.SectionID ?? r.sectionID;
      if (classID != null && sectionID != null) {
        const h = byId.get(id);
        const dup = h.selectedClasses.some(
          (c) => String(c.classID) === String(classID) && String(c.sectionID) === String(sectionID)
        );
        if (!dup) h.selectedClasses.push({ classID, sectionID, label: labelForClass(classList, classID, sectionID) });
      }
    });
    const list = [...byId.values()];
    list.forEach((h) => { h.classes = h.selectedClasses.map((c) => c.label); });
    return list;
  }

  /* Section removed — Tab 1/2/3/4 use att-section directly. */

  // InfoBar/ReportBtn/StatusBadge removed — superseded by att-* CSS classes.

  /* ─── Tab 1: Holidays Setup ─────────────────────────────────────────────────
    Pixel-faithful port of the HTML reference. Uses att-* classes + FA icons. */

  function HolidaysTab({ weeklyOff, requestToggleDay, holidays, openHolModal, requestDeleteHoliday, openReportPicker, toast  , onSaveWeeklyOff, onExpandMonth, loadingMonth }) {
    const [openMonth, setOpenMonth] = useState(null);
    const [holYear, setHolYear] = useState("");
    const [sessions, setSessions] = useState([]); // [{ ID, SessionName, ... }]

    // Session dropdown: list all branch sessions, default-select the active one.
    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const [list, active] = await Promise.all([
            attendanceService.getSessionsForBranch(),
            attendanceService.getActiveSession(),
          ]);
          if (!alive) return;
          setSessions(list);
          const activeName = active?.SessionName
            || list.find((s) => String(s.ID) === String(active?.ID))?.SessionName;
          if (activeName) setHolYear(activeName);
        } catch (err) {
          console.error("Could not load sessions", err);
        }
      })();
      return () => { alive = false; };
    }, []);

    return (
      <>
        {/* Weekly Off Days */}
        <div className="att-section">
          <div className="att-section-header">
            <div className="att-section-title">
              <div className="att-section-icon"><i className="fa-solid fa-calendar-week"></i></div>
              <div>
                <div className="att-section-name">Weekly Off Days</div>
                <div className="att-section-sub">Select regular weekly off days for this school</div>
              </div>
            </div>
            <Tooltip text="Save the selected weekly off days">
            <button
    className="att-btn-save-small"
    onClick={() => {
    // YEH LINE HATADO: toast("Weekly off days saved", "success");
    onSaveWeeklyOff(); // SIRF YEH RAHE
  }}
  >
    <i className="fa-solid fa-floppy-disk"></i>
    Save & Update
  </button>
            </Tooltip>
          </div>
          <div className="att-section-body">
            <div className="att-info">
              <i className="fa-solid fa-circle-info"></i>
              <span>Weekly off days will automatically appear as holidays in all attendance calendars.</span>
            </div>
            <div className="att-days-grid">
              {DAYS_F.map((day, i) => {
                const off = weeklyOff.includes(i);
                return (
                  <Tooltip key={day} text={off ? `Mark ${day} as a working day` : `Mark ${day} as a weekly off`}>
                    <div
                      className={`att-day-card${off ? " selected" : ""}`}
                      onClick={() => requestToggleDay(i)}
                    >
                      <div className="att-day-icon">{DAY_ICONS[i]}</div>
                      <div className="att-day-name">{day.slice(0, 3)}</div>
                      <div className="att-day-off">{off ? "OFF ✓" : "Working"}</div>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {/* Special Holidays */}
        <div className="att-section">
          <div className="att-section-header">
            <div className="att-section-title">
              <div className="att-section-icon"><i className="fa-solid fa-star"></i></div>
              <div>
                <div className="att-section-name">Special Holidays</div>
                <div className="att-section-sub">National, religious &amp; school-specific holidays by month</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div className="att-select-wrap">
                <select className="att-select" value={holYear} onChange={(e) => setHolYear(e.target.value)} style={{ minWidth: 130 }}>
                  {sessions.length === 0
                    ? <option value={holYear}>{holYear || "Loading…"}</option>
                    : sessions.map((s) => <option key={s.ID} value={s.SessionName}>{s.SessionName}</option>)}
                </select>
                <i className="fa-solid fa-chevron-down att-select-arrow"></i>
              </div>
              <Tooltip text="Download a PDF of all holidays for the selected year">
                <button
                  className="att-btn-report"
                  onClick={() => openReportPicker({ title: "Yearly Holiday Report", context: "holidayYearly", defaultYear: holYear })}
                >
                  <i className="fa-solid fa-file-pdf"></i> Yearly Report
                </button>
              </Tooltip>
            </div>
          </div>
          <div className="att-section-body">
            <div className="att-info">
              <i className="fa-solid fa-circle-info"></i>
              <span>Special holidays will apply only to selected classes. Tap a month to expand.</span>
            </div>
            <div className="att-months-grid">
              {MONTHS.map((m, i) => {
                const hols = holidays.filter((h) => h.month === i);
                const isOpen = openMonth === i;
                return (
                  <div key={m} className="att-month-card">
                    <div className="att-month-header" onClick={() => { const next = isOpen ? null : i; setOpenMonth(next); if (next !== null) onExpandMonth?.(i); }}>
                      <div className="att-month-left">
                        <div className="att-month-dot" style={{ background: hols.length ? "linear-gradient(135deg,#1E3A8A,#1E40AF)" : "#94A3B8" }} />
                        <div>
                          <div className="att-month-name">{m}</div>
                          <div className="att-month-count">{hols.length} holiday{hols.length !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      <div className="att-month-actions">
                        <Tooltip text={`Add a new holiday in ${m}`}>
                          <button
                            className="att-add-holiday-btn"
                            onClick={(e) => { e.stopPropagation(); openHolModal(null, i); }}
                          >
                            <i className="fa-solid fa-plus"></i> Add Holiday
                          </button>
                        </Tooltip>
                        <Tooltip text={isOpen ? "Collapse month" : "Expand month"}>
                          <button className={`att-chevron-btn${isOpen ? " open" : ""}`} aria-label="Toggle">
                            <i className="fa-solid fa-chevron-down"></i>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    <div className={`att-holiday-list${isOpen ? " open" : ""}`}>
                      {loadingMonth === i ? (
                        <div style={{ padding: "12px 6px", fontSize: 12.5, color: T.textMuted, fontStyle: "italic" }}>
                          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                          Loading holidays…
                        </div>
                      ) : hols.length === 0 ? (
                        <div style={{ padding: "12px 6px", fontSize: 12.5, color: T.textMuted, fontStyle: "italic" }}>
                          No holidays added for this month.
                        </div>
                      ) : (
                        hols.map((h) => (
                          <div key={h.id} className="att-holiday-row">
                            <div>
                              <div className="att-holiday-title">{h.title}</div>
                              <div className="att-holiday-desc">{h.desc}</div>
                            </div>
                            <div className="att-holiday-date">{h.from}</div>
                            <div className="att-holiday-date">{h.to}</div>
                            <div>
                              {h.classes.map((c) => (
                                <span key={c} className="att-holiday-class-pill" style={{ marginRight: 4 }}>{c}</span>
                              ))}
                            </div>
                            <Tooltip text="Edit holiday">
                              <button className="att-icon-btn" onClick={() => openHolModal(h.id)}>
                                <i className="fa-solid fa-pen"></i>
                              </button>
                            </Tooltip>
                            <Tooltip text="Delete holiday">
                              <button className="att-icon-btn del" onClick={() => requestDeleteHoliday(h.id)}>
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </Tooltip>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ─── Holiday Add/Edit modal ─────────────────────────────────────────────── */
  // Special sentinel: selecting this applies the holiday to every class+section.
  const WHOLE_SCHOOL_OPT = { classID: -1, sectionID: -1, label: "Whole School", whole: true };

  function HolidayModal({ initial, defaultMonth, onClose, onSave }) {
    const isEdit = !!initial;
    const [title, setTitle] = useState(initial?.title || "");
    const [desc, setDesc]   = useState(initial?.desc  || "");
    const [from, setFrom]   = useState(initial?.from  || "");
    const [to, setTo]       = useState(initial?.to    || "");
    // Selected classes are stored as objects: { classID, sectionID, label }
    const [classes, setClasses] = useState(initial?.selectedClasses || []);
    // Class+section options fetched from the API when the modal opens.
    const [classOpts, setClassOpts]       = useState([]);
    const [classLoading, setClassLoading] = useState(true);
    const [saving, setSaving]             = useState(false);

    const optKey = (c) => `${c.classID}-${c.sectionID}`;

    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // Add Holiday par click hote hi classes wali API call karke options bharo.
    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          setClassLoading(true);
          const opts = await attendanceService.getClassesForBranch();
          if (alive) setClassOpts(opts);
        } catch (err) {
          console.error("Could not load classes", err);
          if (alive) setClassOpts([]);
        } finally {
          if (alive) setClassLoading(false);
        }
      })();
      return () => { alive = false; };
    }, []);

    const removeChip = (c) => setClasses((prev) => prev.filter((x) => optKey(x) !== optKey(c)));
    const addChip = (c) => {
      setClasses((prev) => {
        // Whole School clears individual selections; picking a class clears Whole School.
        if (c.whole) return [WHOLE_SCHOOL_OPT];
        if (prev.some((x) => optKey(x) === optKey(c))) return prev;
        return [...prev.filter((x) => !x.whole), c];
      });
    };

    const save = async () => {
      if (!title.trim()) return;
      if (!from || !to) return;
      if (from > to) return;
      if (saving) return;
      // New holiday → month = jis month CARD par "Add Holiday" click hua (defaultMonth).
      // Edit → Date From se derive (taake date badalne par month update ho jaye).
      const monthIdx = (!isEdit && defaultMonth != null)
        ? defaultMonth
        : (from ? new Date(from).getMonth() : (initial?.month ?? defaultMonth ?? 0));
      // Whole School → expand to EVERY class+section pair for the API + display.
      const finalClasses = classes.some((c) => c.whole)
        ? classOpts.map((c) => ({ classID: c.classID, sectionID: c.sectionID, label: c.label }))
        : classes;
      setSaving(true);
      try {
        await onSave({
          id: initial?.id,
          title: title.trim(),
          desc: desc.trim(),
          from, to,
          month: monthIdx,
          selectedClasses: finalClasses,
        });
      } finally {
        setSaving(false);
      }
    };

    return createPortal(
      <div className="att-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="att-modal">
          <div className="att-modal-header">
            <div className="att-modal-header-left">
              <div className="att-modal-header-icon"><i className="fa-solid fa-star"></i></div>
              <div>
                <div className="att-modal-title">{isEdit ? "Edit Holiday" : "Add Holiday"}</div>
                <div className="att-modal-sub">{isEdit ? "Update this special holiday" : "Add a special holiday for selected classes"}</div>
              </div>
            </div>
            <Tooltip text="Close"><button className="att-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
          </div>
          <div className="att-modal-body">
            <div className="att-info" style={{ marginBottom: 14 }}>
              <i className="fa-solid fa-circle-info"></i>
              <span>Special holidays will only apply to the selected classes. Use "Whole School" to apply to all.</span>
            </div>
            <div className="att-field-row full">
              <div>
                <label className="att-label">Holiday Title *</label>
                <input className="att-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Eid ul Fitr Holiday" />
              </div>
            </div>
            <div className="att-field-row full">
              <div>
                <label className="att-label">Description</label>
                <textarea className="att-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description..." />
              </div>
            </div>
            <div className="att-field-row">
              <div>
                <label className="att-label">Date From *</label>
                <input className="att-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="att-label">Date To *</label>
                <input className="att-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div className="att-field-row full">
              <div>
                <label className="att-label">Apply to Classes</label>
                <div className="att-class-select-wrap" style={{ minHeight: 46 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center", width: "100%" }}>
                    {classes.length === 0 && (
                      <span style={{ fontSize: 12, color: T.textMuted }}>Select one or more classes below</span>
                    )}
                    {classes.map((c) => (
                      <span key={optKey(c)} className="att-class-chip">
                        {c.label}
                        <span className="att-class-chip-x" onClick={() => removeChip(c)}>×</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {classLoading ? (
                    <span style={{ fontSize: 12, color: T.textMuted }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                      Loading classes…
                    </span>
                  ) : classOpts.length === 0 ? (
                    <span style={{ fontSize: 12, color: T.textMuted }}>No classes found.</span>
                  ) : (
                    <>
                      {(() => {
                        const active = classes.some((x) => x.whole);
                        return (
                          <button
                            className={`att-radio-btn${active ? " p active" : ""}`}
                            onClick={() => active ? removeChip(WHOLE_SCHOOL_OPT) : addChip(WHOLE_SCHOOL_OPT)}
                          >
                            <i className="fa-solid fa-school" style={{ marginRight: 5 }}></i>
                            Whole School
                          </button>
                        );
                      })()}
                      {classOpts.map((c) => {
                        const active = classes.some((x) => optKey(x) === optKey(c));
                        return (
                          <button
                            key={optKey(c)}
                            className={`att-radio-btn${active ? " p active" : ""}`}
                            onClick={() => active ? removeChip(c) : addChip(c)}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6 }}>
                  Tip: Selecting "Whole School" applies the holiday to every class &amp; section.
                </div>
                {defaultMonth != null && !isEdit && (
                  <div style={{ fontSize: 11, color: T.brandPrimary, marginTop: 4 }}>
                    <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }}></i>
                    This holiday will be added to {MONTHS[defaultMonth]}.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="att-modal-footer">
            <Tooltip text="Discard changes and close">
              <button className="att-btn-secondary" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={isEdit ? 'Save changes to this holiday' : 'Add this holiday to the calendar'}>
              <button className="att-btn-primary" onClick={save} disabled={saving}>
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving…</>
                  : <><i className="fa-solid fa-floppy-disk"></i> {isEdit ? "Update Holiday" : "Save Holiday"}</>}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* ─── Confirm dialogs (delete + day toggle) ──────────────────────────────── */
  function ConfirmDialog({
    iconClass = "fa-solid fa-trash-can",
    iconBg = "rgba(220,38,38,.1)",
    iconColor = "#DC2626",
    title,
    message,
    hintIcon = "fa-solid fa-triangle-exclamation",
    hintBg = "rgba(220,38,38,.06)",
    hintBorder = "rgba(220,38,38,.2)",
    hintColor = "#DC2626",
    hint,
    confirmLabel,
    confirmIcon = "fa-solid fa-check",
    confirmBg,
    onClose,
    onConfirm,
  }) {
    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    return createPortal(
      <div className="att-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="att-confirm">
          <div className="att-confirm-icon" style={{ background: iconBg, color: iconColor }}>
            <i className={iconClass}></i>
          </div>
          <div className="att-confirm-title">{title}</div>
          <div className="att-confirm-msg">{message}</div>
          {hint && (
            <div className="att-confirm-hint" style={{ background: hintBg, borderColor: hintBorder, color: hintColor }}>
              <i className={hintIcon}></i>
              <span>{hint}</span>
            </div>
          )}
          <div className="att-confirm-btns">
            <Tooltip text="Cancel and close">
              <button className="att-btn-secondary" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={`Confirm: ${confirmLabel}`}>
              <button
                className="att-btn-primary"
                onClick={onConfirm}
                style={confirmBg ? { background: confirmBg } : undefined}
              >
                <i className={confirmIcon}></i> {confirmLabel}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* ─── Report Picker modal — Step 1 (type) · Step 2 (filters) · Step 3 (style)
    Faithful port of the HTML reference. ─────────────────────────────────── */
  const RPT_CLASS_OPTS   = ["All Classes", "Class I", "Class II", "Class III", "Class IV", "Class V"];
  const RPT_SECTION_OPTS = ["All Sections", "Red", "Blue", "Green", "White"];
  const RPT_YEAR_OPTS    = ["2025-2026", "2024-2025", "2023-2024"];
  const RPT_MONTH_OPTS   = genMonthYearOptions();
  const RPT_DEPT_OPTS    = ["All Departments", "Primary", "Secondary", "Administration", "Support Staff"];

  function ReportPickerModal({ open, title, context, defaultYear, defaultMonth, defaultDate, forClass, forStaff, onClose, onGenerate, sessionOpts = [], holidayClassOpts = [], studentClassOpts = [], studentSectionOpts = [], staffDeptOpts = [] }) {
    /* Compact picker — only filters relevant to the current report context. */
    const todayStr = new Date().toISOString().split("T")[0];
    const currMonth = CURRENT_MONTH_LABEL;

    const [style, setStyle]   = useState("color");
    const [fYear, setFYear]   = useState(defaultYear  || "2025-2026");
    const [fMonth, setFMonth] = useState(defaultMonth || currMonth);
    const [fDate, setFDate]   = useState(defaultDate  || todayStr);
    const [fClass, setFClass] = useState(forClass ? forClass.cls : "All Classes");
    const [fSection, setFSection] = useState(forClass ? forClass.sec : "All Sections");
    const [fDept, setFDept]   = useState(forStaff ? forStaff.dept : "All Departments");

    useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    /* Reset selections each time the modal re-opens */
    useEffect(() => {
      if (!open) return;
      setStyle("color");
      setFYear(defaultYear  || "2025-2026");
      setFMonth(defaultMonth || currMonth);
      setFDate(defaultDate  || todayStr);
      setFClass(forClass ? forClass.cls : "All Classes");
      setFSection(forClass ? forClass.sec : "All Sections");
      setFDept(forStaff ? forStaff.dept : "All Departments");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, defaultYear, defaultMonth, defaultDate, forClass, forStaff]);

    if (!open) return null;

    const ctx = context || "holidayYearly";
    const isHolYearly = ctx === "holidayYearly";
    const isStDaily   = ctx === "studentDaily" || ctx === "studentDailyClass";
    const isStMonthly = ctx === "studentMonthly" || ctx === "studentMonthlyClass";
    const isSfDaily   = ctx === "staffDaily"   || ctx === "staffDailyOne";
    const isSfMonthly = ctx === "staffMonthly" || ctx === "staffMonthlyOne";
    const lockedClass = !!forClass;
    const lockedStaff = !!forStaff;

    const submit = () => {
      onGenerate({
        effective: ctx,
        style,
        filters: { year: fYear, month: fMonth, date: fDate, class: fClass, section: fSection, dept: fDept },
      });
    };

    return createPortal(
      <div
        className="att-overlay open"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="att-rpt-title"
      >
        <div className="att-rpt-picker" style={{ maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
          <div className="att-rpt-header">
            <div>
              <div className="att-rpt-title" id="att-rpt-title">{title || "Download Report"}</div>
              <div className="att-rpt-sub">Choose filters and print style, then generate.</div>
            </div>
            <Tooltip text="Close"><button className="att-rpt-close" onClick={onClose} aria-label="Close report dialog"><i className="fa-solid fa-xmark"></i></button></Tooltip>
          </div>

          <div className="att-rpt-body">
            {/* Filters */}
            <div className="att-rpt-section-lbl">Filters</div>
            <div className="att-rpt-filter-row">
              {isHolYearly && (
                <>
                  <FilterSelect label="Session" value={fYear}  onChange={setFYear}  opts={sessionOpts.length ? sessionOpts : RPT_YEAR_OPTS} />
                  <FilterSelect label="Class"   value={fClass} onChange={setFClass} opts={holidayClassOpts.length ? holidayClassOpts : RPT_CLASS_OPTS} />
                </>
              )}
              {isStDaily && (
                <>
                  <FilterInput label="Date" value={fDate} onChange={setFDate} type="date" />
                  {!lockedClass && (
                    <>
                      <FilterSelect label="Class"   value={fClass}   onChange={setFClass}   opts={studentClassOpts.length ? studentClassOpts : RPT_CLASS_OPTS} />
                      <FilterSelect label="Section" value={fSection} onChange={setFSection} opts={studentSectionOpts.length ? studentSectionOpts : RPT_SECTION_OPTS} />
                    </>
                  )}
                </>
              )}
              {isStMonthly && (
                <>
                  <FilterSelect label="Month" value={fMonth} onChange={setFMonth} opts={RPT_MONTH_OPTS} />
                  {!lockedClass && (
                    <>
                      <FilterSelect label="Class"   value={fClass}   onChange={setFClass}   opts={studentClassOpts.length ? studentClassOpts : RPT_CLASS_OPTS} />
                      <FilterSelect label="Section" value={fSection} onChange={setFSection} opts={studentSectionOpts.length ? studentSectionOpts : RPT_SECTION_OPTS} />
                    </>
                  )}
                </>
              )}
              {isSfDaily && (
                <>
                  <FilterInput label="Date" value={fDate} onChange={setFDate} type="date" />
                  {!lockedStaff && (
                    <FilterSelect label="Department" value={fDept} onChange={setFDept} opts={staffDeptOpts.length ? staffDeptOpts : RPT_DEPT_OPTS} />
                  )}
                </>
              )}
              {isSfMonthly && (
                <>
                  <FilterSelect label="Month" value={fMonth} onChange={setFMonth} opts={RPT_MONTH_OPTS} />
                  {!lockedStaff && (
                    <FilterSelect label="Department" value={fDept} onChange={setFDept} opts={staffDeptOpts.length ? staffDeptOpts : RPT_DEPT_OPTS} />
                  )}
                </>
              )}
            </div>

            {/* Print Style */}
            <div className="att-rpt-section-lbl" id="att-rpt-style-lbl">Print Style</div>
            <div className="att-rpt-grid" style={{ marginBottom: 4 }} role="radiogroup" aria-labelledby="att-rpt-style-lbl">
              <div
                className={`att-rpt-card${style === "color" ? " selected" : ""}`}
                onClick={() => setStyle("color")}
                role="radio"
                aria-checked={style === "color"}
                tabIndex={style === "color" ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); setStyle("color"); }
                  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setStyle("color"); }
                  else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setStyle("bw"); }
                }}
              >
                <div className="att-rpt-preview-color" aria-hidden="true">
                  <div className="att-rpt-mock-line"  style={{ width: "60%" }}></div>
                  <div className="att-rpt-mock-line2" style={{ width: "40%" }}></div>
                  <div className="att-rpt-mock-line2" style={{ width: "70%" }}></div>
                </div>
                <div className="att-rpt-card-text">
                  <div className="att-rpt-card-name"><i className="fa-solid fa-palette" style={{ color: "#1E40AF", marginRight: 6 }} aria-hidden="true"></i>Colorful Report</div>
                  <div className="att-rpt-card-desc">School branding, summary cards &amp; status badges</div>
                </div>
              </div>
              <div
                className={`att-rpt-card${style === "bw" ? " selected" : ""}`}
                onClick={() => setStyle("bw")}
                role="radio"
                aria-checked={style === "bw"}
                tabIndex={style === "bw" ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); setStyle("bw"); }
                  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setStyle("color"); }
                  else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setStyle("bw"); }
                }}
              >
                <div className="att-rpt-preview-bw" aria-hidden="true">
                  <div className="att-rpt-mock-line"  style={{ width: "60%" }}></div>
                  <div className="att-rpt-mock-line2" style={{ width: "40%" }}></div>
                  <div className="att-rpt-mock-line2" style={{ width: "70%" }}></div>
                </div>
                <div className="att-rpt-card-text">
                  <div className="att-rpt-card-name"><i className="fa-solid fa-circle-half-stroke" style={{ color: "#374151", marginRight: 6 }} aria-hidden="true"></i>Colorless Report</div>
                  <div className="att-rpt-card-desc">Low-ink layout — white background, light borders only</div>
                </div>
              </div>
            </div>
          </div>

          <div className="att-rpt-footer">
            <Tooltip text="Cancel and close">
              <button className="att-btn-secondary" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text="Generate the report and open print preview">
              <button className="att-btn-primary" onClick={submit}>
                <i className="fa-solid fa-file-pdf"></i> Generate &amp; Print
              </button>
            </Tooltip>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  function FilterInput({ label, value, onChange, type = "text" }) {
    return (
      <div className="att-rpt-filter-field">
        <div className="att-rpt-filter-lbl">{label}</div>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="att-input" style={{ height: 38, fontSize: 12.5, width: "100%" }} />
      </div>
    );
  }

  function FilterSelect({ label, value, onChange, opts }) {
    return (
      <div className="att-rpt-filter-field">
        <div className="att-rpt-filter-lbl">{label}</div>
        <div style={{ position: "relative" }}>
          <select className="att-select" value={value} onChange={(e) => onChange(e.target.value)} style={{ height: 38, fontSize: 12.5, width: "100%" }}>
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
          <i className="fa-solid fa-chevron-down att-select-arrow"></i>
        </div>
      </div>
    );
  }

  /* ─── Report Preview overlay (iframe + Print/Close) ─────────────────────── */
  function ReportPreviewOverlay({ open, title, html, onClose }) {
    const frameRef = React.useRef(null);

    useEffect(() => {
      if (!open) return;
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onKey);
        document.body.style.overflow = "";
      };
    }, [open, onClose]);

    const doPrint = () => {
      const fr = frameRef.current;
      if (fr && fr.contentWindow) {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); }
        catch {
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
      }
    };

    if (!open) return null;

    return createPortal(
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,.7)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: 16 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ width: "100%", maxWidth: 960, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#1E3A8A,#2563EB)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 16 }}>
              <i className="fa-solid fa-file-lines"></i>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{title}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>Preview — Click Print to print or save as PDF</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Tooltip text="Print the report or save it as PDF">
              <button
                onClick={doPrint}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", background: "linear-gradient(135deg,#1E3A8A,#2563EB)", color: "#fff", border: "none", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                <i className="fa-solid fa-print"></i> Print / Save PDF
              </button>
            </Tooltip>
            <Tooltip text="Close report preview">
              <button
                onClick={onClose}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(255,255,255,.12)", color: "#fff", border: "1.5px solid rgba(255,255,255,.2)", borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                <i className="fa-solid fa-xmark"></i> Close
              </button>
            </Tooltip>
          </div>
        </div>
        <iframe
          ref={frameRef}
          title="Attendance Report Preview"
          srcDoc={html}
          style={{ width: "100%", maxWidth: 960, flex: 1, border: "none", borderRadius: 12, background: "#fff", boxShadow: "0 20px 60px rgba(0,0,0,.4)", minHeight: 0 }}
        />
      </div>,
      document.body
    );
  }

  /* ─── Report HTML builders ───────────────────────────────────────────────── */
  function rptPageWrap({ rptLabel, period, isColor, content, school }) {
    /* Two coordinated palettes:
      • Colorful: brand-blue gradient header band, white text on blue.
      • Colorless: dedicated LOW-INK layout — white header with dark text
        and a thin gray bottom border; logo box swaps to a bordered outline;
        opacity-based subtitles become explicit dark-gray. No emoji icons. */
    const P = "#1E3A8A", S = "#1E40AF", A = "#2563EB";
    const hdrBg = isColor
      ? `background:linear-gradient(135deg,${P},${S},${A});color:#fff`
      : "background:#FFFFFF;color:#0F172A;border:1px solid #D1D5DB";
    const hdrSubColor = isColor ? "rgba(255,255,255,.75)" : "#4B5563";
    const hdrKickColor = isColor ? "rgba(255,255,255,.7)" : "#6B7280";
    const logoBg     = isColor ? "rgba(255,255,255,.18)" : "#FFFFFF";
    const logoBorder = isColor ? "rgba(255,255,255,.35)" : "#0F172A";
    const bdr = isColor ? "#BFDBFE" : "#D1D5DB";
    const styleLabel = isColor ? "Colorful" : "Colorless";
    /* Real branch header from /report-header (school), else generic fallback. */
    const schoolName = school?.name || "School Mentor";
    const schoolTagline = school?.address || "Pakistan's Most Trusted School Operating System";
    const logoHtml = school?.logo
      ? `<img src="${school.logo}" width="54" height="54" style="border-radius:11px;object-fit:cover;display:block" onerror="this.style.display='none'" />`
      : (isColor ? '🏫' : '');
    const genTime = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>SchoolMentor — ${rptLabel}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#0F172A;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media print{@page{margin:12mm 10mm;size:A4}body{padding:0}}
  </style></head><body>
  <div style="padding:22px 26px;max-width:880px;margin:0 auto">
    <div style="${hdrBg};border-radius:16px;padding:20px 26px;margin-bottom:22px;display:flex;justify-content:space-between;align-items:center;gap:16px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:54px;height:54px;border-radius:13px;background:${logoBg};border:2px solid ${logoBorder};display:flex;align-items:center;justify-content:center;font-size:26px;color:inherit;overflow:hidden">${logoHtml}</div>
        <div>
          <div style="font-size:21px;font-weight:800;letter-spacing:-.5px">${schoolName}</div>
          <div style="font-size:11px;color:${hdrSubColor};margin-top:2px">${schoolTagline}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;color:${hdrKickColor};letter-spacing:.5px;text-transform:uppercase;margin-bottom:3px">Report</div>
        <div style="font-size:15px;font-weight:800;line-height:1.2">${rptLabel}</div>
        <div style="font-size:11px;color:${hdrSubColor};margin-top:3px">${styleLabel} • ${period}</div>
      </div>
    </div>
    ${content}
    <div style="margin-top:32px;padding-top:18px;border-top:1.5px solid ${bdr};display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
      ${["Prepared By", "Verified By", "Principal Signature"].map((l) =>
        `<div style="text-align:center"><div style="border-bottom:1.5px solid #94A3B8;padding-bottom:36px;margin-bottom:8px"></div><div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px">${l}</div></div>`
      ).join("")}
    </div>
    <div style="margin-top:18px;text-align:center;font-size:10px;color:#94A3B8;padding-top:10px">
      Generated by SchoolMentor ERP • ${genTime} • Confidential School Document
    </div>
  </div></body></html>`;
  }

  function buildYearlyHolidayReportHTML({ holidays, weeklyOff, year, classFilter, isColor, branchSchool }) {
    const bdr = isColor ? "#BFDBFE" : "#D1D5DB";
    const RED = isColor ? "#DC2626" : "#374151";
    /* Colorless: white table head with dark text + thin border — no gray fill */
    const thBg = isColor ? "background:#EFF6FF;color:#1E3A8A" : "background:#FFFFFF;color:#111111;border-bottom:1.5px solid #0F172A";
    const th = (t, align = "left") =>
      `<th style="padding:9px 11px;text-align:${align};font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase;border:1px solid ${bdr};${thBg}">${t}</th>`;
    const td = (v, opts = "") =>
      `<td style="padding:8px 11px;border:1px solid ${bdr};${opts}">${v == null || v === "" ? "—" : v}</td>`;
    const weeklyOffDays = weeklyOff.map((i) => DAYS_F[i]).join(", ") || "—";

    const sorted = [...holidays].sort((a, b) => (a.from || "").localeCompare(b.from || ""));
    const holRows = sorted.map((h, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
      ${td(i + 1, "text-align:center;color:#94A3B8")}
      ${td(`<strong>${h.title}</strong>`)}
      ${td(h.desc || "—", "font-size:11px;color:#64748B")}
      ${td(h.from, "font-weight:600")}${td(h.to, "font-weight:600")}
      ${td((h.classes || []).join(", "), "font-size:11px")}
      ${td(MONTHS[h.month] || "—", "font-size:11px")}
    </tr>`).join("");

    const infoGrid = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
      ${[
        ["Academic Year", year || "—"],
        ["Total Holidays", String(holidays.length)],
        ["Weekly Off", weeklyOffDays],
        ["Class Filter", classFilter || "All Classes"],
      ].map(([l, v]) => `<div style="border:1.5px solid ${bdr};border-radius:10px;padding:11px 13px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:4px">${l}</div>
        <div style="font-size:12.5px;font-weight:700;color:#0F172A;line-height:1.3">${v}</div>
      </div>`).join("")}
    </div>`;

    const tableBlock = holidays.length === 0
      ? `<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13.5px"><i>No holidays found for this academic year.</i></div>`
      : `<div style="margin-bottom:14px;font-size:12px;font-weight:600;color:#1E3A5F">Weekly Off Days: <strong>${weeklyOffDays}</strong></div>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr>${[th("#", "center"), th("Holiday Name"), th("Description"), th("From"), th("To"), th("Applies To"), th("Month")].join("")}</tr></thead>
          <tbody>${holRows}</tbody>
        </table></div>`;

    return rptPageWrap({
      rptLabel: "Yearly Holiday Report",
      period: year || "2025-2026",
      isColor,
      school: branchSchool,
      content: infoGrid + tableBlock + (holidays.length > 0 ? `<div style="margin-top:18px;font-size:11.5px;color:#64748B"><strong style="color:${RED}">Note:</strong> Holidays apply to the listed classes only. "Whole School" entries apply to all classes.</div>` : ""),
    });
  }

  /* ─── Shared report-table helpers ───────────────────────────────────────── */
  /* Used by every Attendance report — fixing the colorless palette here makes
    ALL reports (daily/monthly student & staff, class overview, comparison,
    low-attendance, holidays, individual) print as a true low-ink layout
    in one shot. Colorless: thin gray borders, white th bg with dark text,
    bordered text-only status badges (no colored fill). */
  function rptTableHelpers(isColor) {
    const bdr = isColor ? "#BFDBFE" : "#D1D5DB";
    const GREEN = isColor ? "#16A34A" : "#111111";
    const RED   = isColor ? "#DC2626" : "#111111";
    const AMB   = isColor ? "#D97706" : "#4B5563";
    const thBg  = isColor ? "background:#EFF6FF;color:#1E3A8A" : "background:#FFFFFF;color:#111111";
    const th = (t, align = "left") =>
      `<th style="padding:9px 11px;text-align:${align};font-weight:700;font-size:10px;letter-spacing:.5px;text-transform:uppercase;border:1px solid ${bdr};${thBg}">${t}</th>`;
    const td = (v, opts = "") =>
      `<td style="padding:8px 11px;border:1px solid ${bdr};${opts}">${v == null || v === "" ? "—" : v}</td>`;
    const badge = (t, c) =>
      `<span style="padding:2px 9px;border-radius:999px;font-size:10.5px;font-weight:700;background:${isColor ? c + "18" : "transparent"};color:${isColor ? c : "#111111"};border:1px solid ${isColor ? c + "33" : "#9CA3AF"}">${t}</span>`;
    return { bdr, GREEN, RED, AMB, th, td, badge };
  }

  function rptInfoGrid(pairs, bdr) {
    return `<div style="display:grid;grid-template-columns:repeat(${Math.min(pairs.length, 4)},1fr);gap:10px;margin-bottom:20px">
      ${pairs.map(([l, v]) => `<div style="border:1.5px solid ${bdr};border-radius:10px;padding:11px 13px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:4px">${l}</div>
        <div style="font-size:12.5px;font-weight:700;color:#0F172A;line-height:1.3">${v}</div>
      </div>`).join("")}
    </div>`;
  }

  function rptStatsRow(items, bdr, isColor) {
    return `<div style="display:grid;grid-template-columns:repeat(${items.length},1fr);gap:10px;margin-bottom:22px">
      ${items.map(([l, v, c]) => `<div style="border-radius:12px;border:1.5px solid ${bdr};padding:14px;text-align:center${isColor ? `;background:${c}08` : ""}">
        <div style="font-size:26px;font-weight:900;color:${isColor ? c : "#333"}">${v}</div>
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-top:4px">${l}</div>
      </div>`).join("")}
    </div>`;
  }

  /* ─── Daily Student Attendance Report ─────────────────────────────────────
    `rows` = REAL per class+section aggregates for the SELECTED date, fetched
    from /api/student-attendance (action:"get"). Header = branch (branchSchool). */
  function buildDailyStudentReportHTML({ rows, date, classFilter, sectionFilter, forClass, isColor, branchSchool }) {
    const { bdr, GREEN, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const dateLabel = date
      ? new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    const filtered = (rows || []).filter((r) => {
      if (forClass) return r.cls === forClass.cls && r.sec === forClass.sec;
      const cMatch = !classFilter || classFilter === "All Classes" || r.cls === classFilter;
      const sMatch = !sectionFilter || sectionFilter === "All Sections" || r.sec === sectionFilter;
      return cMatch && sMatch;
    });

    const tableRows = filtered.map((r, i) => {
      const pc = r.marked && r.total > 0 ? Math.round((r.present / r.total) * 100) : 0;
      return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        ${td(i + 1, "text-align:center;color:#94A3B8")}
        ${td(`<strong>${r.cls}</strong>`)}${td(r.sec)}
        ${td(r.total, "text-align:center;font-weight:700")}
        ${td(r.marked ? `<strong style="color:${GREEN}">${r.present}</strong>` : "—", "text-align:center")}
        ${td(r.marked ? `<strong style="color:${RED}">${r.absent}</strong>`  : "—", "text-align:center")}
        ${td(r.marked ? `<strong style="color:${AMB}">${r.leave}</strong>`   : "—", "text-align:center")}
        ${td(r.marked ? badge(pc + "%", pc >= 90 ? GREEN : pc >= 75 ? AMB : RED) : badge("Not Marked", "#94A3B8"), "text-align:center")}
        ${td(r.markedBy || "—", "font-size:11px")}
      </tr>`;
    }).join("");

    const pres = filtered.filter((r) => r.marked).reduce((s, r) => s + r.present, 0);
    const abs  = filtered.filter((r) => r.marked).reduce((s, r) => s + r.absent, 0);
    const lv   = filtered.filter((r) => r.marked).reduce((s, r) => s + r.leave, 0);
    const tot  = filtered.reduce((s, r) => s + r.total, 0);

    const content = rptInfoGrid([
      ["Date", dateLabel],
      ["Class", forClass ? forClass.cls : (classFilter || "All Classes")],
      ["Section", forClass ? forClass.sec : (sectionFilter || "All Sections")],
      ["Total Students", String(tot)],
    ], bdr) +
    rptStatsRow([["Total", tot, "#374151"], ["Present", pres, GREEN], ["Absent", abs, RED], ["Leave", lv, AMB]], bdr, isColor) +
    (filtered.length === 0
      ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13.5px"><i>No attendance found for the selected date and filters.</i></div>`
      : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr>${[th("#", "center"), th("Class"), th("Section"), th("Total", "center"), th("Present", "center"), th("Absent", "center"), th("Leave", "center"), th("Attend %", "center"), th("Marked By")].join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>`);

    return rptPageWrap({ rptLabel: "Daily Student Attendance Report", period: dateLabel, isColor, school: branchSchool, content });
  }

  /* ─── Monthly Student Attendance Report ──────────────────────────────────── */
  function buildMonthlyStudentReportHTML({ studentData, month, classFilter, sectionFilter, forClass, isColor }) {
    const { bdr, GREEN, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const monthLabel = month || CURRENT_MONTH_LABEL;

    const rows = (studentData || []).filter((r) => {
      if (forClass) return r.cls === forClass.cls && r.sec === forClass.sec;
      const cMatch = !classFilter || classFilter === "All Classes" || r.cls === classFilter;
      const sMatch = !sectionFilter || sectionFilter === "All Sections" || r.sec === sectionFilter;
      return cMatch && sMatch;
    });

    /* Monthly aggregates — synthesize 22 working days per class. */
    const tableRows = rows.map((r, i) => {
      const workingDays = 22;
      const totalSessions = r.total * workingDays;
      const present = r.marked ? Math.round((r.present / r.total) * totalSessions) : 0;
      const absent  = r.marked ? Math.round((r.absent  / r.total) * totalSessions) : 0;
      const leave   = r.marked ? Math.round((r.leave   / r.total) * totalSessions) : 0;
      const pc = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;
      return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        ${td(i + 1, "text-align:center;color:#94A3B8")}
        ${td(`<strong>${r.cls}</strong>`)}${td(r.sec)}
        ${td(r.total, "text-align:center;font-weight:700")}
        ${td(workingDays, "text-align:center")}
        ${td(`<strong style="color:${GREEN}">${present}</strong>`, "text-align:center")}
        ${td(`<strong style="color:${RED}">${absent}</strong>`,    "text-align:center")}
        ${td(`<strong style="color:${AMB}">${leave}</strong>`,     "text-align:center")}
        ${td(badge(pc + "%", pc >= 90 ? GREEN : pc >= 75 ? AMB : RED), "text-align:center")}
      </tr>`;
    }).join("");

    const totStudents = rows.reduce((s, r) => s + r.total, 0);
    const content = rptInfoGrid([
      ["Month", monthLabel],
      ["Class", forClass ? forClass.cls : (classFilter || "All Classes")],
      ["Section", forClass ? forClass.sec : (sectionFilter || "All Sections")],
      ["Total Students", String(totStudents)],
    ], bdr) + (rows.length === 0
      ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13.5px"><i>No classes match the selected filters.</i></div>`
      : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr>${[th("#", "center"), th("Class"), th("Section"), th("Strength", "center"), th("Working Days", "center"), th("Present", "center"), th("Absent", "center"), th("Leave", "center"), th("Attend %", "center")].join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>`);

    return rptPageWrap({ rptLabel: "Monthly Student Attendance Report", period: monthLabel, isColor, content });
  }

  /* ─── Monthly Student Attendance — REAL class-wise summary ────────────────
    Har class+section: Strength, Working Days (jitne din us month attendance mark
    hui), Present/Absent/Leave (month ka total), aur Present %. Header = branch. */
  function buildStudentMonthlySummaryHTML({ rows, monthLabel, sessionName, branchSchool, isColor, classFilter, sectionFilter }) {
    const { bdr, GREEN, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const filtered = (rows || []).filter((r) => {
      const cMatch = !classFilter || classFilter === "All Classes" || r.cls === classFilter;
      const sMatch = !sectionFilter || sectionFilter === "All Sections" || r.sec === sectionFilter;
      return cMatch && sMatch;
    });

    const tableRows = filtered.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
      ${td(i + 1, "text-align:center;color:#94A3B8")}
      ${td(`<strong>${r.cls}</strong>`)}${td(r.sec)}
      ${td(r.strength, "text-align:center;font-weight:700")}
      ${td(r.workingDays, "text-align:center")}
      ${td(`<strong style="color:${GREEN}">${r.present}</strong>`, "text-align:center")}
      ${td(`<strong style="color:${RED}">${r.absent}</strong>`,    "text-align:center")}
      ${td(`<strong style="color:${AMB}">${r.leave}</strong>`,     "text-align:center")}
      ${td(badge(r.pct + "%", r.pct >= 90 ? GREEN : r.pct >= 75 ? AMB : RED), "text-align:center")}
    </tr>`).join("");

    const totStrength = filtered.reduce((s, r) => s + (r.strength || 0), 0);
    const content = rptInfoGrid([
      ["Session", sessionName || "—"],
      ["Month", monthLabel],
      ["Classes", String(filtered.length)],
      ["Total Students", String(totStrength)],
    ], bdr) + (filtered.length === 0
      ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13.5px"><i>No attendance data found for this month.</i></div>`
      : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr>${[th("#", "center"), th("Class"), th("Section"), th("Strength", "center"), th("Working Days", "center"), th("Present", "center"), th("Absent", "center"), th("Leave", "center"), th("Present %", "center")].join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>`);

    return rptPageWrap({
      rptLabel: "Monthly Student Attendance Report",
      period: `${sessionName ? sessionName + " · " : ""}${monthLabel}`,
      isColor, school: branchSchool, content,
    });
  }

  /* ─── Daily Staff Attendance Report ─────────────────────────────────────── */
  function buildDailyStaffReportHTML({ staffData, date, deptFilter, forStaff, isColor, branchSchool }) {
    const { bdr, GREEN, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const dateLabel = date
      ? new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

    const list = (staffData || []).filter((s) => {
      if (forStaff) return s.empId === forStaff.empId;
      return !deptFilter || deptFilter === "All Departments" || s.dept === deptFilter;
    });

    const statusBadge = (s) => {
      if (!s.marked) return badge("Not Marked", "#94A3B8");
      if (s.status === "present") return badge("Present", GREEN);
      if (s.status === "absent")  return badge("Absent",  RED);
      if (s.status === "leave")   return badge("Leave",   AMB);
      return badge("Pending", "#94A3B8");
    };

    const tableRows = list.map((s, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
      ${td(i + 1, "text-align:center;color:#94A3B8")}
      ${td(`<strong>${s.name}</strong><div style="font-size:10.5px;color:#64748B">${s.empId}</div>`)}
      ${td(s.desig)}
      ${td(s.dept)}
      ${td(statusBadge(s), "text-align:center")}
      ${td(s.inTime  ? fmtTime(s.inTime)  : "—", "text-align:center;font-weight:600")}
      ${td(s.outTime ? fmtTime(s.outTime) : "—", "text-align:center;font-weight:600")}
      ${td(s.from || "—", "font-size:11px")}
    </tr>`).join("");

    const present = list.filter((s) => s.marked && s.status === "present").length;
    const absent  = list.filter((s) => s.marked && s.status === "absent").length;
    const leave   = list.filter((s) => s.marked && s.status === "leave").length;
    const notMarked = list.filter((s) => !s.marked).length;

    const content = rptInfoGrid([
      ["Date",       dateLabel],
      ["Department", forStaff ? forStaff.dept : (deptFilter || "All Departments")],
      ["Total Staff", String(list.length)],
      ["Generated",  new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    ], bdr) +
    rptStatsRow([["Total", list.length, "#374151"], ["Present", present, GREEN], ["Absent", absent, RED], ["Leave", leave, AMB], ["Not Marked", notMarked, "#94A3B8"]], bdr, isColor) +
    (list.length === 0
      ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13.5px"><i>No staff match the selected filters.</i></div>`
      : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr>${[th("#", "center"), th("Staff Name"), th("Designation"), th("Department"), th("Status", "center"), th("In Time", "center"), th("Out Time", "center"), th("Marked From")].join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>`);

    return rptPageWrap({ rptLabel: "Daily Staff Attendance Report", period: dateLabel, isColor, school: branchSchool, content });
  }

  /* ─── Monthly Staff Attendance Report ─────────────────────────────────────
    `staffData` = REAL per-staff month aggregates (present/absent/leave, working
    days, present %) fetched from /api/staff-attendance across the month's dates.
    Header = branch (branchSchool). */
  function buildMonthlyStaffReportHTML({ staffData, month, deptFilter, forStaff, isColor, branchSchool }) {
    const { bdr, GREEN, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const monthLabel = month || CURRENT_MONTH_LABEL;

    const list = (staffData || []).filter((s) => {
      if (forStaff) return s.empId === forStaff.empId;
      return !deptFilter || deptFilter === "All Departments" || s.dept === deptFilter;
    });

    const tableRows = list.map((s, i) => {
      const workingDays = s.workingDays || 0;
      const present = s.present || 0, absent = s.absent || 0, leave = s.leave || 0;
      const pc = s.pct || 0;
      return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        ${td(i + 1, "text-align:center;color:#94A3B8")}
        ${td(`<strong>${s.name}</strong>`)}
        ${td(s.desig)}
        ${td(s.dept)}
        ${td(workingDays, "text-align:center")}
        ${td(`<strong style="color:${GREEN}">${present}</strong>`, "text-align:center")}
        ${td(`<strong style="color:${RED}">${absent}</strong>`,    "text-align:center")}
        ${td(`<strong style="color:${AMB}">${leave}</strong>`,     "text-align:center")}
        ${td(badge(pc + "%", pc >= 90 ? GREEN : pc >= 75 ? AMB : RED), "text-align:center")}
      </tr>`;
    }).join("");

    const content = rptInfoGrid([
      ["Month",       monthLabel],
      ["Department",  forStaff ? forStaff.dept : (deptFilter || "All Departments")],
      ["Total Staff", String(list.length)],
      ["Generated",   new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    ], bdr) + (list.length === 0
      ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13.5px"><i>No staff match the selected filters.</i></div>`
      : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr>${[th("#", "center"), th("Staff Name"), th("Designation"), th("Department"), th("Working Days", "center"), th("Present", "center"), th("Absent", "center"), th("Leave", "center"), th("Attend %", "center")].join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>`);

    return rptPageWrap({ rptLabel: "Monthly Staff Attendance Report", period: monthLabel, isColor, school: branchSchool, content });
  }

  /* ─── Class Overview (Monthly) Report ─────────────────────────────────────
    `rows` = REAL per class+section month aggregates (fetchMonthlyReportRows). */
  function buildClassOverviewHTML({ rows, month, isColor, branchSchool }) {
    const { bdr, GREEN, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const monthLabel = month || CURRENT_MONTH_LABEL;
    const list = rows || [];
    const workingDays = list[0]?.workingDays ?? 0;

    const tableRows = list.map((r, i) => {
      const pc = r.pct || 0;
      return `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
        ${td(i + 1, "text-align:center;color:#94A3B8")}
        ${td(`<strong>${r.cls}</strong>`)}${td(r.sec)}
        ${td(r.teacher || "—", "font-size:11px")}
        ${td(r.strength, "text-align:center;font-weight:700")}
        ${td(`<strong style="color:${GREEN}">${r.present}</strong>`, "text-align:center")}
        ${td(`<strong style="color:${RED}">${r.absent}</strong>`,    "text-align:center")}
        ${td(`<strong style="color:${AMB}">${r.leave}</strong>`,     "text-align:center")}
        ${td(badge(pc + "%", pc >= 90 ? GREEN : pc >= 75 ? AMB : RED), "text-align:center")}
      </tr>`;
    }).join("");

    const content = rptInfoGrid([
      ["Month", monthLabel],
      ["Total Classes", String(list.length)],
      ["Working Days", String(workingDays)],
      ["Generated", new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    ], bdr) +
    (list.length === 0
      ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13.5px"><i>No attendance data found for this month.</i></div>`
      : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <thead><tr>${[th("#", "center"), th("Class"), th("Section"), th("Teacher"), th("Strength", "center"), th("Present", "center"), th("Absent", "center"), th("Leave", "center"), th("Attend %", "center")].join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`);

    return rptPageWrap({ rptLabel: "Monthly Class Overview Report", period: monthLabel, isColor, school: branchSchool, content });
  }

  /* ─── Class Comparison Report ───────────────────────────────────────────── */
  function buildClassComparisonHTML({ rows, month, isColor, branchSchool }) {
    const { bdr, GREEN, RED, AMB, th, td } = rptTableHelpers(isColor);
    const monthLabel = month || CURRENT_MONTH_LABEL;

    const list = (rows || []).map((r) => ({ ...r, pc: r.pct || 0 })).sort((a, b) => b.pc - a.pc);

    const tableRows = list.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
      ${td(i + 1, "text-align:center;color:#94A3B8")}
      ${td(`<strong>${r.cls}</strong> · ${r.sec}`)}
      ${td(r.teacher || "—", "font-size:11px")}
      ${td(`<div style="background:#e2e8f0;height:10px;border-radius:5px;overflow:hidden"><div style="height:100%;width:${r.pc}%;background:${r.pc >= 90 ? GREEN : r.pc >= 75 ? AMB : RED}"></div></div>`, "min-width:160px")}
      ${td(`<strong style="color:${r.pc >= 90 ? GREEN : r.pc >= 75 ? AMB : RED}">${r.pc}%</strong>`, "text-align:center")}
    </tr>`).join("");

    const content = rptInfoGrid([
      ["Month", monthLabel],
      ["Classes Compared", String(list.length)],
      ["Top Class", list[0] ? `${list[0].cls} · ${list[0].sec} (${list[0].pc}%)` : "—"],
      ["Lowest Class", list[list.length - 1] ? `${list[list.length - 1].cls} · ${list[list.length - 1].sec} (${list[list.length - 1].pc}%)` : "—"],
    ], bdr) +
    (list.length === 0
      ? `<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13.5px"><i>No attendance data found for this month.</i></div>`
      : `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <thead><tr>${[th("#", "center"), th("Class / Section"), th("Teacher"), th("Attendance"), th("%", "center")].join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`);

    return rptPageWrap({ rptLabel: "Class Comparison Report", period: monthLabel, isColor, school: branchSchool, content });
  }

  /* ─── Low Attendance Alert Report ───────────────────────────────────────── */
  function buildLowAttendanceHTML({ rows, month, isColor, branchSchool }) {
    const { bdr, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const monthLabel = month || CURRENT_MONTH_LABEL;
    const threshold = 75;

    const list = (rows || []).map((r) => ({ ...r, pc: r.pct || 0 }))
      .filter((r) => r.pc < threshold).sort((a, b) => a.pc - b.pc);

    const tableRows = list.length === 0
      ? `<tr><td colspan="6" style="padding:24px;text-align:center;color:#94A3B8;font-style:italic">All classes are above the ${threshold}% threshold.</td></tr>`
      : list.map((r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
          ${td(i + 1, "text-align:center;color:#94A3B8")}
          ${td(`<strong>${r.cls}</strong> · ${r.sec}`)}
          ${td(r.teacher || "—", "font-size:11px")}
          ${td(r.strength, "text-align:center;font-weight:700")}
          ${td(`<strong style="color:${RED}">${r.absent}</strong>`, "text-align:center")}
          ${td(badge(r.pc + "%", r.pc >= 60 ? AMB : RED), "text-align:center")}
        </tr>`).join("");

    const content = rptInfoGrid([
      ["Month", monthLabel],
      ["Threshold", `< ${threshold}%`],
      ["Classes Flagged", String(list.length)],
      ["Generated", new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    ], bdr) +
    `<div style="background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:${RED};display:flex;align-items:center;gap:8px"><strong>Action required:</strong> Classes listed below have monthly attendance under ${threshold}%. Investigate causes and schedule remedial steps.</div>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <thead><tr>${[th("#", "center"), th("Class / Section"), th("Teacher"), th("Strength", "center"), th("Absent (Mo)", "center"), th("Attend %", "center")].join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`;

    return rptPageWrap({ rptLabel: "Low Attendance Alert Report", period: monthLabel, isColor, school: branchSchool, content });
  }

  /* ─── Monthly Holiday Report ───────────────────────────────────────────── */
  function buildMonthlyHolidayReportHTML({ holidays, weeklyOff, month, isColor, branchSchool }) {
    const { bdr, th, td } = rptTableHelpers(isColor);
    const monthLabel = month || CURRENT_MONTH_LABEL;
    const monthIdx = MONTHS.indexOf(monthLabel.split(" ")[0]);
    const list = (holidays || []).filter((h) => h.month === monthIdx);
    const weeklyOffDays = weeklyOff.map((i) => DAYS_F[i]).join(", ") || "—";

    const tableRows = list.length === 0
      ? `<tr><td colspan="7" style="padding:24px;text-align:center;color:#94A3B8;font-style:italic">No special holidays scheduled for this month.</td></tr>`
      : list.map((h, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">
          ${td(i + 1, "text-align:center;color:#94A3B8")}
          ${td(`<strong>${h.title}</strong>`)}
          ${td(h.desc || "—", "font-size:11px;color:#64748B")}
          ${td(h.from, "font-weight:600")}${td(h.to, "font-weight:600")}
          ${td((h.classes || []).join(", "), "font-size:11px")}
          ${td(MONTHS[h.month] || "—", "font-size:11px")}
        </tr>`).join("");

    const content = rptInfoGrid([
      ["Month",         monthLabel],
      ["Holidays",      String(list.length)],
      ["Weekly Off",    weeklyOffDays],
      ["Generated",     new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })],
    ], bdr) +
    `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <thead><tr>${[th("#", "center"), th("Holiday Name"), th("Description"), th("From"), th("To"), th("Applies To"), th("Month")].join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`;

    return rptPageWrap({ rptLabel: "Monthly Holiday Report", period: monthLabel, isColor, school: branchSchool, content });
  }

  /* ─── Individual (Student/Staff) Date-Range Report ──────────────────────── */
  function buildIndividualReportHTML({ target, fromDate, toDate, weeklyOff, holidays, isColor, records, branchSchool }) {
    const { bdr, GREEN, RED, AMB, th, td, badge } = rptTableHelpers(isColor);
    const titleType = target.type === "student" ? "Student" : "Staff";
    const dateLabel = `${fromDate} → ${toDate}`;
    const recs = records || {};

    /* Generate the date sequence */
    const start = new Date(`${fromDate}T00:00:00`);
    const end   = new Date(`${toDate}T00:00:00`);
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    const STLABEL = { present: "Present", absent: "Absent", leave: "Leave", late: "Late" };
    const WDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    let present = 0, absent = 0, leave = 0, wDays = 0, wOff = 0, hols = 0;
    const tableRows = dates.map((d, i) => {
      const dow = (d.getDay() + 6) % 7;
      const isOff = weeklyOff.includes(dow);
      const hol = (holidays || []).find((h) => {
        const f = new Date(`${h.from}T00:00:00`), t2 = new Date(`${h.to}T00:00:00`);
        return d >= f && d <= t2;
      });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const rec = recs[key]; // { status, platform, inTime, outTime } | undefined
      const dStr = `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
      const dowName = WDAYS[d.getDay()];
      let dType = "Working Day", dColor = isColor ? "#16A34A" : "#333";
      if (isOff)      { dType = "Weekly Off"; dColor = "#94A3B8"; wOff++; }
      else if (hol)   { dType = "Holiday";    dColor = isColor ? "#3B82F6" : "#555"; hols++; }
      else            { wDays++; }

      // Real status: weekly-off/holiday → "—"; warna record se; record na ho → "Not Marked".
      const stKey = rec ? rec.status : "";
      const st = (isOff || hol) ? "—" : (STLABEL[stKey] || (rec ? "Marked" : "Not Marked"));
      const pl = (isOff || hol) ? "—" : (rec?.platform || "—");
      const inT = target.type === "staff" && rec?.inTime ? fmtTime(rec.inTime) : "—";
      const outT = target.type === "staff" && rec?.outTime ? fmtTime(rec.outTime) : "—";

      if (!isOff && !hol && rec) {
        if (stKey === "present") present++;
        else if (stKey === "absent") absent++;
        else if (stKey === "leave") leave++;
      }
      const sc = st === "Present" ? GREEN : st === "Absent" ? RED : st === "Leave" ? AMB : "#94A3B8";
      const bg = isOff ? "#f8fafc" : i % 2 === 0 ? "#fff" : "#f9fafb";

      return `<tr style="background:${bg}">
        ${td(i + 1, "text-align:center;color:#94A3B8")}
        ${td(dStr, "font-weight:600")}
        ${td(dowName, "font-size:11px;color:#64748B")}
        ${td(`<span style="color:${dColor};font-weight:700">${dType}</span>${hol ? `<div style="font-size:10px;color:#64748B;margin-top:2px">${hol.title}</div>` : ""}`)}
        ${td(st === "—" ? "—" : badge(st, sc), "text-align:center")}
        ${target.type === "staff" ? td(inT, "text-align:center;font-size:11px") : ""}
        ${target.type === "staff" ? td(outT, "text-align:center;font-size:11px") : ""}
        ${td(pl, "font-size:11px")}
      </tr>`;
    }).join("");

    const totalDays = dates.length;
    const pc = wDays > 0 ? Math.round((present / wDays) * 100) : 0;

    const content = rptInfoGrid([
      [titleType + " Name", target.name],
      ["Detail",            target.detail],
      ["ID",                target.id],
      ["Period",            dateLabel],
    ], bdr) +
    rptStatsRow([
      ["Total Days",   totalDays, "#374151"],
      ["Working",      wDays,     "#1E40AF"],
      ["Weekly Off",   wOff,      "#94A3B8"],
      ["Holidays",     hols,      "#3B82F6"],
      ["Attend %",     pc + "%",  pc >= 90 ? GREEN : pc >= 75 ? AMB : RED],
    ], bdr, isColor) +
    rptStatsRow([
      ["Present", present, GREEN],
      ["Absent",  absent,  RED],
      ["Leave",   leave,   AMB],
    ], bdr, isColor) +
    `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <thead><tr>${[
        th("#", "center"),
        th("Date"),
        th("Day"),
        th("Type"),
        th("Status", "center"),
        ...(target.type === "staff" ? [th("In Time", "center"), th("Out Time", "center")] : []),
        th("Platform"),
      ].join("")}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table></div>`;

    return rptPageWrap({ rptLabel: `Individual ${titleType} Attendance Report`, period: dateLabel, isColor, school: branchSchool, content });
  }

  /* ─── Shared month-calendar grid (student + staff) ────────────────────────── */
  function CalendarGrid({ type, month, weeklyOff, holidays, selected, onSelect, onFutureError }) {
    const cells = useMemo(() => {
      const [monName, yrStr] = month.split(" ");
      const monthIdx = MONTHS.indexOf(monName);
      const year = parseInt(yrStr) || 2026;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      const firstDow = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // 0 = Mon
      const today = new Date();
      const tY = today.getFullYear(), tM = today.getMonth(), tD = today.getDate();
      const out = [];
      for (let b = 0; b < firstDow; b++) out.push({ blank: true, key: `b${b}` });
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, monthIdx, d);
        const dow = (date.getDay() + 6) % 7;
        const isOff = weeklyOff.includes(dow);
        const isToday = year === tY && monthIdx === tM && d === tD;
        const isFuture = year > tY || (year === tY && monthIdx > tM) || (year === tY && monthIdx === tM && d > tD);
        const isPast = year < tY || (year === tY && monthIdx < tM) || (year === tY && monthIdx === tM && d < tD);
        const holMatch = holidays.find((h) => { const f = new Date(h.from), t = new Date(h.to); return date >= f && date <= t; });
        const isHol = !!holMatch;
        const isMarked = !isOff && !isHol && isPast;
        const isPending = !isOff && !isHol && isFuture;
        out.push({ key: `d${d}`, d, dow, year, monthIdx, isOff, isToday, isFuture, isPast, isHol, isMarked, isPending, tip: holMatch ? holMatch.title : "" });
      }
      return out;
    }, [month, weeklyOff, holidays]);

    const cellBg = (c) => {
      if (c.isOff) return { bg: T.bgMuted, border: T.borderLight, dot: "#94A3B8", op: 0.85 };
      if (c.isHol) return { bg: "rgba(59,130,246,.08)", border: T.borderMed, dot: T.brandMid, op: 1 };
      if (c.isToday) return { bg: "rgba(139,92,246,.1)", border: "#8B5CF6", dot: "#8B5CF6", op: 1 };
      if (c.isMarked) return { bg: "rgba(22,163,74,.07)", border: "rgba(22,163,74,.3)", dot: T.success, op: 1 };
      if (c.isPending) return { bg: T.bgCard, border: T.borderLight, dot: T.error, op: 1 };
      return { bg: T.bgCard, border: T.borderLight, dot: "transparent", op: 1 };
    };

    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
          {DAYS_S.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: ".5px", padding: "4px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {cells.map((c) => {
            if (c.blank) return <div key={c.key} style={{ opacity: 0.2 }} />;
            const st = cellBg(c);
            const isSel = selected && selected.day === c.d;
            const clickable = (!c.isOff && !c.isFuture) || c.isToday;
            return (
              <Tooltip key={c.key} text={c.tip || ''}>
                <div
                  onClick={() => { if (clickable) onSelect({ year: c.year, monthIdx: c.monthIdx, day: c.d, isToday: c.isToday, isPast: c.isPast }); else if (c.isFuture) onFutureError(); }}
                  style={{
                    position: "relative", textAlign: "center", padding: "8px 2px 7px", borderRadius: T.radiusMd,
                    border: `1.5px solid ${isSel ? T.brandPrimary : st.border}`, background: isSel ? T.brandLight : st.bg,
                    opacity: st.op, cursor: clickable ? "pointer" : c.isFuture ? "not-allowed" : "default", transition: T.tr,
                    boxShadow: isSel ? `0 0 0 2px ${T.brandPrimary}33` : "none",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: c.isToday ? "#8B5CF6" : T.textPrimary }}>{c.d}</div>
                  <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase" }}>{DAYS_S[c.dow]}</div>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, margin: "4px auto 0" }} />
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  const LEGEND = [
    ["#16A34A", "Marked"], ["#DC2626", "Pending"], ["#94A3B8", "Weekly Off"], ["#3B82F6", "Holiday"], ["#8B5CF6", "Today"],
  ];
  function CalLegend() {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {LEGEND.map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />{l}
          </div>
        ))}
      </div>
    );
  }

  /* ─── Selected-date detail panel (student) ────────────────────────────────── */
  /* ─── Sample roster used for the mark-attendance modal + expanded class detail
    (matches the HTML reference's ST_NAMES / ST_STATUSES seed) ─────────────── */
  const ST_NAMES = [
    ["Ali Hassan", "Hassan Ali"],
    ["Bilal Ahmed", "Ahmed Bilal"],
    ["Sara Khan", "Khan Sara"],
    ["Umar Sheikh", "Sheikh Umar"],
    ["Ayesha Raza", "Raza Ayesha"],
    ["Fatima Malik", "Malik Fatima"],
    ["Zain Qureshi", "Qureshi Zain"],
    ["Hira Butt", "Butt Hira"],
  ];

  /* Attendance status ↔ API numeric code: P=1, A=2, L=3, Late=4 */
  const ST_STATUS_TO_CODE = { present: 1, absent: 2, leave: 3, late: 4 };
  const ST_CODE_TO_STATUS = { "1": "present", "2": "absent", "3": "leave", "4": "late" };

  function rosterForClass(row) {
    // Real roster from the API (get-class-section-studentlist-by-branch).
    if (Array.isArray(row?.students) && row.students.length) return row.students;
    // Fallback sample roster (demo/mock rows without a real student list).
    const n = Math.min(row?.total || 0, 8);
    return Array.from({ length: n }, (_, j) => {
      const [name, father] = ST_NAMES[j % ST_NAMES.length];
      return { idx: j + 1, reg: `2024-${String(j + 1).padStart(3, "0")}`, name, father };
    });
  }

  /* ─── Month navigator (prev/next arrows) — like the Academics activity calendar.
    Works with the "Month Year" string format the calendar already uses, and lets
    the user reach ANY year's month (not just 2026). ─────────────────────────── */
  function MonthNav({ month, onChange }) {
    const [monName, yrStr] = month.split(" ");
    const idx = MONTHS.indexOf(monName);
    const year = parseInt(yrStr) || new Date().getFullYear();
    const shift = (delta) => {
      let m = idx + delta, y = year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      onChange(`${MONTHS[m]} ${y}`);
    };
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Tooltip text="Previous month">
          <button className="att-chevron-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
        </Tooltip>
        <div style={{ minWidth: 140, textAlign: "center", fontSize: 14, fontWeight: 800, color: T.textPrimary }}>
          {monName} {year}
        </div>
        <Tooltip text="Next month">
          <button className="att-chevron-btn" onClick={() => shift(1)} aria-label="Next month">
            <i className="fa-solid fa-chevron-right"></i>
          </button>
        </Tooltip>
      </div>
    );
  }

  /* ─── Tab 2: Student Attendance ─────────────────────────────────────────────
    HTML-faithful: att-section, att-st-row table, expandable detail panels,
    per-class Mark/Update Attendance button, calendar with date detail. */
  function StudentTab({ weeklyOff, holidays, studentData, openMarkSt, openReportPicker, toast, onExpandClass, teacherMap = {}, onSelectDate, dateAttendance }) {
    const [month, setMonth] = useState(CURRENT_MONTH_LABEL);
    const [selected, setSelected] = useState(null);
    const [openClassIdx, setOpenClassIdx] = useState(null);

    return (
      <>
        {/* Filter bar */}
        <div className="att-section">
          <div className="att-section-body" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <MonthNav month={month} onChange={(m) => { setMonth(m); setSelected(null); }} />
              <Tooltip text="Download monthly student attendance as PDF">
                <button
                  className="att-btn-report"
                  style={{ marginLeft: "auto" }}
                  onClick={() => openReportPicker({
                    title: "Monthly Student Attendance Report",
                    context: "studentMonthly",
                    defaultMonth: month,
                  })}
                >
                  <i className="fa-solid fa-file-pdf"></i> PDF Report
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="att-section">
          <div className="att-section-header">
            <div className="att-section-title">
              <div className="att-section-icon"><i className="fa-solid fa-calendar-days"></i></div>
              <div>
                <div className="att-section-name">{month} — Calendar</div>
                <div className="att-section-sub">Tap any date to view or mark attendance</div>
              </div>
            </div>
          </div>
          <div className="att-section-body" style={{ padding: "16px 18px 18px" }}>
            <CalLegend />
            <CalendarGrid
              type="student"
              month={month}
              weeklyOff={weeklyOff}
              holidays={holidays}
              selected={selected}
                onSelect={(s) => {
                  setSelected(s);
                  const dateStr = `${s.year}-${String(s.monthIdx + 1).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
                  onSelectDate?.(dateStr);
                }}
              onFutureError={() => toast("Attendance cannot be marked for upcoming dates.", "error")}
            />
            {selected && (
              <StudentDatePanel
                sel={selected}
                dateAttendance={dateAttendance}
                openMarkSt={openMarkSt}
                openReportPicker={openReportPicker}
              />
            )}
          </div>
        </div>

        {/* Class-wise Attendance */}
        <div className="att-section">
          <div className="att-section-header">
            <div className="att-section-title">
              <div className="att-section-icon"><i className="fa-solid fa-chalkboard-user"></i></div>
              <div>
                <div className="att-section-name">Class-wise Attendance</div>
                <div className="att-section-sub">Mark and view daily attendance for each class / section</div>
              </div>
            </div>
          </div>

          {/* Table header */}
          <div className="att-table-head att-st-row">
            <div className="att-th att-td-num">#</div>
            <div className="att-th att-td-name">Class / Section</div>
            <div className="att-th att-td-teacher">Class Teacher</div>
            <div className="att-th att-td-total">Total</div>
            <div className="att-th att-td-status">Status</div>
            <div className="att-th att-td-present">P</div>
            <div className="att-th att-td-absent">A</div>
            <div className="att-th att-td-leave">L</div>
            <div className="att-th att-td-action">Action</div>
            <div className="att-th att-td-chev"></div>
          </div>

          {/* Rows */}
          {studentData.map((r, i) => {
            const isOpen = openClassIdx === i;
            const isMarked = r.marked;
            return (
              <div key={(r.classID ?? r.cls) + "-" + (r.sectionID ?? r.sec)} className="att-row-wrap">
                <div className="att-row att-st-row">
                  <div className="att-td att-td-num">{i + 1}</div>
                  <div className="att-td att-td-name">
                    <div className="att-row-icon"><i className="fa-solid fa-chalkboard-user"></i></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary }}>{r.cls}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 1 }}>
                        <i className="fa-solid fa-layer-group" style={{ fontSize: 9, marginRight: 3 }}></i>{r.sec}
                      </div>
                    </div>
                  </div>
                  <div className="att-td att-td-teacher">
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {teacherMap[`${r.classID}-${r.sectionID}`] || (r.teacher && r.teacher !== "—" ? r.teacher : "—")}
                    </div>
                  </div>
                  <div className="att-td att-td-total">
                    <span style={{ fontSize: 15, fontWeight: 800, color: T.textPrimary }}>{r.total}</span>
                    <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 3 }}>students</span>
                  </div>
                  <div className="att-td att-td-status">
                    <span className={`att-status-badge ${isMarked ? "marked" : "pending"}`}>
                      {isMarked ? <><i className="fa-solid fa-check" style={{ fontSize: 8, marginRight: 4 }}></i>Marked</>
                                : <><i className="fa-regular fa-clock" style={{ fontSize: 9, marginRight: 4 }}></i>Pending</>}
                    </span>
                  </div>
                  <div className="att-td att-td-present"><span style={{ color: "#16A34A", fontWeight: 800, fontSize: 14 }}>{isMarked ? r.present : "—"}</span></div>
                  <div className="att-td att-td-absent"><span style={{ color: "#DC2626", fontWeight: 800, fontSize: 14 }}>{isMarked ? r.absent : "—"}</span></div>
                  <div className="att-td att-td-leave"><span style={{ color: "#D97706", fontWeight: 800, fontSize: 14 }}>{isMarked ? r.leave : "—"}</span></div>
                  <div className="att-td att-td-action">
                    <Tooltip text={isMarked ? `Update attendance for ${r.cls} (${r.sec})` : `Mark attendance for ${r.cls} (${r.sec})`}>
                      <button
                        className={`att-mark-btn-primary${isMarked ? " update-mode" : ""}`}
                        onClick={() => openMarkSt(i)}
                      >
                        <i className={`fa-solid ${isMarked ? "fa-rotate-right" : "fa-pen-to-square"}`}></i>
                        {isMarked ? "Update Attendance" : "Mark Attendance"}
                      </button>
                    </Tooltip>
                  </div>
                  <div className="att-td att-td-chev">
                    <Tooltip text={isOpen ? "Hide student details" : "Show student details"}>
                      <button className={`att-chevron-btn${isOpen ? " open" : ""}`} onClick={() => { const next = isOpen ? null : i; setOpenClassIdx(next); if (next !== null) onExpandClass?.(i); }} aria-label="Toggle detail">
                        <i className="fa-solid fa-chevron-down"></i>
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className={`att-detail${isOpen ? " open" : ""}`}>
                  <div className="att-detail-inner">
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>
                      <i className="fa-solid fa-list-check" style={{ color: T.brandPrimary, marginRight: 6 }}></i>
                      Attendance Detail — {r.cls} ({r.sec})
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="att-student-table" style={{ minWidth: 500 }}>
                        <thead>
                          <tr>
                            <th>#</th><th>Reg. No.</th><th>Student Name</th><th>Father Name</th><th>Status</th><th>Marked From</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rosterForClass(r).map((s, j) => {
                            const st = s.status || null; // real saved status (get API)
                            return (
                              <tr key={s.id ?? s.idx}>
                                <td>{s.idx}</td>
                                <td>{s.reg}</td>
                                <td>{s.name}</td>
                                <td>{s.father}</td>
                                <td>
                                  {st
                                    ? <span className={`att-${st}-badge`}>{st[0].toUpperCase() + st.slice(1)}</span>
                                    : <span style={{ color: T.textMuted, fontSize: 11.5 }}>Not Marked</span>}
                                </td>
                                <td style={{ fontSize: 11.5, color: T.textMuted }}>{st ? "ERP" : ""}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Tooltip text={`Download today's attendance for ${r.cls} (${r.sec}) as PDF`}>
                        <button
                          className="att-btn-report"
                          onClick={() => openReportPicker({
                            title: `Daily Class Attendance — ${r.cls} (${r.sec})`,
                            context: "studentDailyClass",
                            forClass: r,
                          })}
                        >
                          <i className="fa-solid fa-file-pdf"></i> Daily Report
                        </button>
                      </Tooltip>
                      <Tooltip text={`Download monthly attendance for ${r.cls} (${r.sec}) as PDF`}>
                        <button
                          className="att-btn-report"
                          onClick={() => openReportPicker({
                            title: `Monthly Class Attendance — ${r.cls} (${r.sec})`,
                            context: "studentMonthlyClass",
                            forClass: r,
                            defaultMonth: month,
                          })}
                        >
                          <i className="fa-solid fa-calendar-days"></i> Monthly Report
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  /* ─── Selected-date panel under the Student calendar ────────────────────── */
  function StudentDatePanel({ sel, dateAttendance, openMarkSt, openReportPicker }) {
    const dowName  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(sel.year, sel.monthIdx, sel.day).getDay()];
    const dateStr  = `${sel.day} ${MONTHS[sel.monthIdx]} ${sel.year}`;
    const selKey   = `${sel.year}-${String(sel.monthIdx + 1).padStart(2, "0")}-${String(sel.day).padStart(2, "0")}`;
    // Selected date ki attendance (API se, per-class). Jab tak load ho → spinner.
    const ready    = dateAttendance && dateAttendance.key === selKey && !dateAttendance.loading;
    const loading  = !dateAttendance || dateAttendance.key !== selKey || dateAttendance.loading;
    const rows     = ready ? dateAttendance.rows : [];
    const hasMark  = rows.some((r) => r.marked);
    const total    = rows.reduce((s, r) => s + (r.total   || 0), 0);
    const present  = rows.reduce((s, r) => s + (r.present || 0), 0);
    const absent   = rows.reduce((s, r) => s + (r.absent  || 0), 0);
    const leave    = rows.reduce((s, r) => s + (r.leave   || 0), 0);
    const allMarked = rows.length > 0 && rows.every((r) => r.marked);

    return (
      <div style={{ marginTop: 16, border: `1.5px solid ${T.borderLight}`, borderRadius: T.radiusLg, padding: 16, background: "linear-gradient(135deg,rgba(30,58,138,.02),transparent)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.textPrimary }}>
              <i className="fa-solid fa-calendar-day" style={{ color: T.brandPrimary, marginRight: 6 }}></i>{dowName}, {dateStr}
            </div>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>
              {sel.isPast ? "Past date — showing saved record" : "Today — attendance can be marked/updated"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Tooltip text="Download a PDF of student attendance for this date">
              <button
                className="att-btn-report"
                onClick={() => openReportPicker({
                  title: "Daily Student Attendance Report",
                  context: "studentDaily",
                  defaultDate: `${sel.year}-${String(sel.monthIdx + 1).padStart(2, "0")}-${String(sel.day).padStart(2, "0")}`,
                })}
              >
                <i className="fa-solid fa-file-pdf"></i> Daily Report
              </button>
            </Tooltip>
            {sel.isToday && (
              <Tooltip text={allMarked ? "Update today's student attendance for all classes" : "Mark today's student attendance for all classes"}>
                <button
                  className={`att-mark-btn-primary${allMarked ? " update-mode" : ""}`}
                  onClick={() => openMarkSt(0)}
                >
                  <i className={`fa-solid ${allMarked ? "fa-rotate-right" : "fa-pen-to-square"}`}></i>
                  {allMarked ? "Update Attendance" : "Mark Attendance"}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="att-stat-row" style={{ marginBottom: 12 }}>
          {[
            ["Total Students", loading ? "…" : total,                 T.textPrimary],
            ["Present",        loading ? "…" : (hasMark ? present : "—"), T.success],
            ["Absent",         loading ? "…" : (hasMark ? absent  : "—"), T.error],
            ["Leave",          loading ? "…" : (hasMark ? leave   : "—"), T.warning],
          ].map(([l, v, c]) => (
            <div key={l} className="att-stat-card">
              <div className="att-stat-num" style={{ color: c }}>{v}</div>
              <div className="att-stat-lbl">{l}</div>
            </div>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 20, color: T.textMuted, fontSize: 13 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
            Loading attendance for this date…
          </div>
        ) : rows.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
            {/* Saari classes dikhao; jis class ka is date record hai uske P/A/L bhare,
                warna khali (—). */}
            {rows.map((r) => (
              <div key={r.cls + r.sec} style={{ background: T.bgCard, border: `1.5px solid ${T.borderLight}`, borderRadius: T.radiusMd, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: T.textPrimary }}>
                    {r.cls} <span style={{ color: T.textMuted, fontWeight: 600, fontSize: 11.5 }}>({r.sec})</span>
                  </div>
                  <span className={`att-status-badge ${r.marked ? "marked" : "pending"}`}>
                    {r.marked ? <><i className="fa-solid fa-check" style={{ fontSize: 8, marginRight: 3 }}></i>Marked</>
                              : <><i className="fa-regular fa-clock" style={{ fontSize: 9, marginRight: 3 }}></i>Not Marked</>}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, fontSize: 11.5, fontWeight: 700, marginBottom: 10 }}>
                  <span style={{ color: T.success }}>P: {r.marked ? (r.present || 0) : "—"}</span>
                  <span style={{ color: T.error   }}>A: {r.marked ? (r.absent  || 0) : "—"}</span>
                  <span style={{ color: T.warning }}>L: {r.marked ? (r.leave   || 0) : "—"}</span>
                </div>
                <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  <MetaRow label="Marked By"      value={r.markedBy || "—"} />
                  <MetaRow label="Marked Through" value={r.marked && r.markedFrom ? `${platIcon(r.markedFrom)} ${r.markedFrom}` : "—"} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: T.textMuted, fontSize: 13 }}>
            <i className="fa-regular fa-clock" style={{ marginRight: 6, opacity: .6 }}></i>
            No classes found.
          </div>
        )}
      </div>
    );
  }

  function MetaRow({ label, value }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: T.textMuted, width: 62, flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.textSecondary }}>{value}</span>
      </div>
    );
  }

  /* ─── Mark Student Attendance modal ─────────────────────────────────────── */
  function MarkStudentModal({ classIdx, studentData, onClose, onSaveMarks, onLoadMarks }) {
    const row = studentData[classIdx];
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const [rows, setRows] = useState(() =>
      (row ? rosterForClass(row) : []).map((s) => ({ ...s, status: s.status || "" }))
    );
    const [loading, setLoading]   = useState(true);
    const [saving, setSaving]     = useState(false);
    const [hasSaved, setHasSaved] = useState(!!row?.marked);

    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    // Modal open → GET saved attendance (action:"get") → prefill statuses.
    useEffect(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        const map = await onLoadMarks(classIdx);
        if (!alive) return;
        setRows((prev) => prev.map((s) => ({ ...s, status: map[s.id] || s.status || "" })));
        // "Update" mode only if a student in THIS class actually has a status.
        setHasSaved((row.students || []).some((s) => map[s.id]));
        setLoading(false);
      })();
      return () => { alive = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!row) return null;
    const isUpdate = hasSaved;

    const setStatus = (j, st) => setRows((prev) => prev.map((r, i) => i === j ? { ...r, status: st } : r));

    const save = async () => {
      if (saving) return;
      setSaving(true);
      try {
        await onSaveMarks(classIdx, rows); // action:"insert" per student
        onClose();
      } catch {
        /* API failed — keep modal open so the user can retry */
      } finally {
        setSaving(false);
      }
    };

    return createPortal(
      <div className="att-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="att-modal att-modal-lg">
          <div className="att-modal-header">
            <div className="att-modal-header-left">
              <div className="att-modal-header-icon"><i className="fa-solid fa-user-check"></i></div>
              <div>
                <div className="att-modal-title">{isUpdate ? "Update" : "Mark"} Attendance — {row.cls} ({row.sec})</div>
                <div className="att-modal-sub">Date: {today}</div>
              </div>
            </div>
            <Tooltip text="Close"><button className="att-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
          </div>
          <div className="att-modal-body" style={{ padding: "16px 20px" }}>
            {isUpdate && (
              <div className="att-update-notice">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <div><strong>Attendance has already been marked for this date.</strong> You can update the attendance status before the date changes.</div>
              </div>
            )}
            {loading && (
              <div style={{ padding: "8px 2px 12px", fontSize: 12.5, color: T.textMuted }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                Loading saved attendance…
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="att-mark-table" style={{ minWidth: 550 }}>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Reg. No.</th>
                    <th>Student Name</th>
                    <th>Father Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, j) => (
                    <tr key={s.id ?? s.idx}>
                      <td>{s.idx}</td>
                      <td>{s.reg}</td>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.father}</td>
                      <td>
                        <div className="att-radio-group">
                          <Tooltip text="Mark Present">
                            <button className={`att-radio-btn p${s.status === "present" ? " active" : ""}`} onClick={() => setStatus(j, "present")}>P</button>
                          </Tooltip>
                          <Tooltip text="Mark Absent">
                            <button className={`att-radio-btn a${s.status === "absent"  ? " active" : ""}`} onClick={() => setStatus(j, "absent")}>A</button>
                          </Tooltip>
                          <Tooltip text="Mark on Leave">
                            <button className={`att-radio-btn l${s.status === "leave"   ? " active" : ""}`} onClick={() => setStatus(j, "leave")}>L</button>
                          </Tooltip>
                          <Tooltip text="Mark as Late">
                            <button
                              className="att-radio-btn"
                              style={{
                                color: s.status === "late" ? "#fff" : "#7C3AED",
                                borderColor: s.status === "late" ? "#7C3AED" : "rgba(124,58,237,.25)",
                                background: s.status === "late" ? "#7C3AED" : "transparent",
                                fontSize: 10, padding: "5px 9px",
                              }}
                              onClick={() => setStatus(j, "late")}
                            >Late</button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="att-modal-footer">
            <Tooltip text="Discard changes and close">
              <button className="att-btn-secondary" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={isUpdate ? 'Save updated attendance' : 'Save attendance'}>
              <button className="att-btn-primary" onClick={save} disabled={saving || loading}>
                {saving
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Saving…</>
                  : <><i className="fa-solid fa-floppy-disk"></i> {isUpdate ? "Update" : "Save"} Attendance</>}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* ─── Tab 3: Staff Attendance ─────────────────────────────────────────────
    HTML-faithful: filter bar, calendar with date-detail (top mark CTA),
    staff list table with expandable per-staff detail rows. */
  function StaffTab({ weeklyOff, holidays, staffData, staffTodayMarked, openMarkSf, openReportPicker, toast, onExpandStaff, onSelectDate, staffDateAttendance }) {
    const [month, setMonth] = useState(CURRENT_MONTH_LABEL);
    const [selected, setSelected] = useState(null);
    const [openIdx, setOpenIdx] = useState(null);

    return (
      <>
        {/* Filter bar */}
        <div className="att-section">
          <div className="att-section-body" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <MonthNav month={month} onChange={(m) => { setMonth(m); setSelected(null); }} />
              <Tooltip text="Download monthly staff attendance as PDF">
                <button
                  className="att-btn-report"
                  style={{ marginLeft: "auto" }}
                  onClick={() => openReportPicker({
                    title: "Monthly Staff Attendance Report",
                    context: "staffMonthly",
                    defaultMonth: month,
                  })}
                >
                  <i className="fa-solid fa-file-pdf"></i> PDF Report
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="att-section">
          <div className="att-section-header">
            <div className="att-section-title">
              <div className="att-section-icon"><i className="fa-solid fa-calendar-days"></i></div>
              <div>
                <div className="att-section-name">{month} — Staff Calendar</div>
                <div className="att-section-sub">Tap any date to view or mark staff attendance</div>
              </div>
            </div>
          </div>
          <div className="att-section-body" style={{ padding: "16px 18px 18px" }}>
            <CalLegend />
            <CalendarGrid
              type="staff"
              month={month}
              weeklyOff={weeklyOff}
              holidays={holidays}
              selected={selected}
              onSelect={(s) => {
                setSelected(s);
                onSelectDate?.(`${s.year}-${String(s.monthIdx + 1).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`);
              }}
              onFutureError={() => toast("Attendance cannot be marked for upcoming dates.", "error")}
            />
            {selected && (
              <StaffDatePanel
                sel={selected}
                staffDateAttendance={staffDateAttendance}
                staffTodayMarked={staffTodayMarked}
                openMarkSf={openMarkSf}
                openReportPicker={openReportPicker}
              />
            )}
          </div>
        </div>

        {/* Staff List */}
        <div className="att-section">
          <div className="att-section-header">
            <div className="att-section-title">
              <div className="att-section-icon"><i className="fa-solid fa-id-badge"></i></div>
              <div>
                <div className="att-section-name">Staff Attendance</div>
                <div className="att-section-sub">Track daily in/out times and attendance status for all staff</div>
              </div>
            </div>

<Tooltip text={staffTodayMarked ? "Update today's staff attendance" : "Mark today's staff attendance"}>
  <button className={`att-mark-btn-primary${staffTodayMarked ? " update-mode" : ""}`} onClick={openMarkSf}>
    <i className={`fa-solid ${staffTodayMarked ? "fa-rotate-right" : "fa-pen-to-square"}`}></i>
    {staffTodayMarked ? "Update Attendance" : "Mark Attendance"}
  </button>
</Tooltip>
          </div>

          {/* Table header */}
          <div className="att-table-head att-sf-row">
            <div className="att-th att-sf-num">#</div>
            <div className="att-th att-sf-name">Staff Name</div>
            <div className="att-th att-sf-desig">Designation</div>
            <div className="att-th att-sf-dept">Department</div>
            <div className="att-th att-sf-status">Status</div>
            <div className="att-th att-sf-in">In Time</div>
            <div className="att-th att-sf-out">Out Time</div>
            <div className="att-th att-sf-chev"></div>
          </div>

          {staffData.map((s, i) => {
            const isOpen = openIdx === i;
            const stClass  = s.marked ? (s.status === "present" ? "marked" : s.status === "absent" ? "pending" : "off") : "pending";
            const stLabel  = s.marked ? (s.status === "present" ? "Present" : s.status === "absent" ? "Absent" : s.status === "leave" ? "On Leave" : "Pending") : "Not Marked";
            return (
              <div key={s.empId} className="att-row-wrap">
                <div className="att-row att-sf-row">
                  <div className="att-td att-sf-num">{i + 1}</div>
                  <div className="att-td att-sf-name">
                    <div className="att-row-icon"><i className="fa-solid fa-user-tie"></i></div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 1 }}>{s.empId}</div>
                    </div>
                  </div>
                  <div className="att-td att-sf-desig">{s.desig}</div>
                  <div className="att-td att-sf-dept">{s.dept}</div>
                  <div className="att-td att-sf-status">
                    <span className={`att-status-badge ${stClass}`}>{stLabel}</span>
                  </div>
                  <div className="att-td att-sf-in" style={{ fontWeight: 600 }}>{s.inTime ? fmtTime(s.inTime) : "—"}</div>
                  <div className="att-td att-sf-out" style={{ fontWeight: 600 }}>{s.outTime ? fmtTime(s.outTime) : "—"}</div>
                  <div className="att-td att-sf-chev">
                    <Tooltip text={isOpen ? "Hide staff details" : "Show staff details"}>
                      <button className={`att-chevron-btn${isOpen ? " open" : ""}`} onClick={() => { const next = isOpen ? null : i; setOpenIdx(next); if (next !== null) onExpandStaff?.(); }} aria-label="Toggle detail">
                        <i className="fa-solid fa-chevron-down"></i>
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className={`att-detail${isOpen ? " open" : ""}`}>
                  <div className="att-detail-inner">
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textSecondary, marginBottom: 10 }}>
                      <i className="fa-solid fa-id-badge" style={{ color: T.brandPrimary, marginRight: 6 }}></i>
                      {s.name} — Attendance Detail
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                      {[
                        ["Status",      s.marked ? (stLabel) : "Not Marked"],
                        ["In Time",     s.inTime  ? fmtTime(s.inTime)  : "—"],
                        ["Out Time",    s.outTime ? fmtTime(s.outTime) : "—"],
                        ["Department",  s.dept  || "—"],
                        ["Marked From", s.from   ? `${platIcon(s.from)} ${s.from}` : "—"],
                        ["Designation", s.desig || "—"],
                      ].map(([lbl, val]) => (
                        <div key={lbl} style={{ background: T.bgMuted, borderRadius: T.radiusMd, padding: "10px 12px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: T.textMuted, marginBottom: 4 }}>{lbl}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Tooltip text={`Download today's attendance for ${s.name} as PDF`}>
                        <button
                          className="att-btn-report"
                          onClick={() => openReportPicker({
                            title: `Daily Staff Attendance — ${s.name}`,
                            context: "staffDailyOne",
                            forStaff: s,
                          })}
                        >
                          <i className="fa-solid fa-file-pdf"></i> Daily Report
                        </button>
                      </Tooltip>
                      <Tooltip text={`Download monthly attendance for ${s.name} as PDF`}>
                        <button
                          className="att-btn-report"
                          onClick={() => openReportPicker({
                            title: `Monthly Staff Attendance — ${s.name}`,
                            context: "staffMonthlyOne",
                            forStaff: s,
                            defaultMonth: month,
                          })}
                        >
                          <i className="fa-solid fa-calendar-days"></i> Monthly Report
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }

  /* ─── Selected-date panel under the Staff calendar ──────────────────────── */
  function StaffDatePanel({ sel, staffDateAttendance, staffTodayMarked, openMarkSf, openReportPicker }) {
    const dowName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(sel.year, sel.monthIdx, sel.day).getDay()];
    const dateStr = `${sel.day} ${MONTHS[sel.monthIdx]} ${sel.year}`;
    const selKey  = `${sel.year}-${String(sel.monthIdx + 1).padStart(2, "0")}-${String(sel.day).padStart(2, "0")}`;
    // Selected date ki staff attendance (API se). Jab tak load ho → spinner.
    const ready   = staffDateAttendance && staffDateAttendance.key === selKey && !staffDateAttendance.loading;
    const loading = !staffDateAttendance || staffDateAttendance.key !== selKey || staffDateAttendance.loading;
    const rows    = ready ? staffDateAttendance.rows : [];
    const markedRows = rows.filter((s) => s.marked);
    const hasMark = markedRows.length > 0;
    const present = rows.filter((s) => s.marked && s.status === "present").length;
    const absent  = rows.filter((s) => s.marked && s.status === "absent").length;
    const leave   = rows.filter((s) => s.marked && s.status === "leave").length;

    return (
      <div style={{ marginTop: 16, border: `1.5px solid ${T.borderLight}`, borderRadius: T.radiusLg, padding: 16, background: "linear-gradient(135deg,rgba(30,58,138,.02),transparent)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.textPrimary }}>
              <i className="fa-solid fa-calendar-day" style={{ color: T.brandPrimary, marginRight: 6 }}></i>{dowName}, {dateStr}
            </div>
            <div style={{ fontSize: 11.5, color: T.textMuted, marginTop: 3 }}>
              {sel.isPast ? "Past date — showing saved record" : "Today — attendance can be marked/updated"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Tooltip text="Download a PDF of staff attendance for this date">
              <button
                className="att-btn-report"
                onClick={() => openReportPicker({
                  title: "Daily Staff Attendance Report",
                  context: "staffDaily",
                  defaultDate: `${sel.year}-${String(sel.monthIdx + 1).padStart(2, "0")}-${String(sel.day).padStart(2, "0")}`,
                })}
              >
                <i className="fa-solid fa-file-pdf"></i> Daily Report
              </button>
            </Tooltip>
            {sel.isToday && (
              <Tooltip text={staffTodayMarked ? "Update today's staff attendance" : "Mark today's staff attendance"}>
                <button
                  className={`att-mark-btn-primary${staffTodayMarked ? " update-mode" : ""}`}
                  onClick={openMarkSf}
                >
                  <i className={`fa-solid ${staffTodayMarked ? "fa-rotate-right" : "fa-pen-to-square"}`}></i>
                  {staffTodayMarked ? "Update Attendance" : "Mark Attendance"}
                </button>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="att-stat-row" style={{ marginBottom: 12 }}>
          {[
            ["Total Staff", loading ? "…" : rows.length,             T.textPrimary],
            ["Present",     loading ? "…" : (hasMark ? present : "—"), T.success],
            ["Absent",      loading ? "…" : (hasMark ? absent  : "—"), T.error],
            ["Leave",       loading ? "…" : (hasMark ? leave   : "—"), T.warning],
          ].map(([l, v, c]) => (
            <div key={l} className="att-stat-card">
              <div className="att-stat-num" style={{ color: c }}>{v}</div>
              <div className="att-stat-lbl">{l}</div>
            </div>
          ))}
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 20, color: T.textMuted, fontSize: 13 }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
            Loading staff attendance for this date…
          </div>
        ) : rows.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            {rows.map((s) => {
              const stClass = s.marked ? (s.status === "present" ? "marked" : s.status === "absent" ? "pending" : "off") : "pending";
              const stLabel = s.marked ? (s.status === "present" ? "Present" : s.status === "absent" ? "Absent" : s.status === "leave" ? "Leave" : "Pending") : "Not Marked";
              return (
                <div key={s.empId} style={{ background: T.bgCard, border: `1.5px solid ${T.borderLight}`, borderRadius: T.radiusMd, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 9 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: T.textPrimary, lineHeight: 1.2 }}>{s.name}</div>
                      <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 2 }}>{s.desig}</div>
                    </div>
                    <span className={`att-status-badge ${stClass}`} style={{ fontSize: 9.5, padding: "2px 9px", flexShrink: 0 }}>{stLabel}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 9 }}>
                    <div style={{ background: T.bgMuted, borderRadius: 7, padding: "6px 9px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: T.textMuted, marginBottom: 2 }}>Time In</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: s.inTime ? "#16A34A" : T.textMuted }}>{s.inTime ? fmtTime(s.inTime) : "—"}</div>
                    </div>
                    <div style={{ background: T.bgMuted, borderRadius: 7, padding: "6px 9px" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: T.textMuted, marginBottom: 2 }}>Time Out</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: s.outTime ? T.brandPrimary : T.textMuted }}>{s.outTime ? fmtTime(s.outTime) : "—"}</div>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${T.borderLight}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    <MetaRow label="Marked By"  value={s.markedBy || "—"} />
                    <MetaRow label="Marked Via" value={s.from ? `${platIcon(s.from)} ${s.from}` : "—"} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: T.textMuted, fontSize: 13 }}>
            <i className="fa-regular fa-clock" style={{ marginRight: 6, opacity: .6 }}></i>
            {sel.isToday ? "Attendance not yet marked for today" : "No attendance record found for this date"}
          </div>
        )}
      </div>
    );
  }

  /* ─── Mark Staff Attendance modal — all staff at once ───────────────────── */
  function MarkStaffModal({ staffData, isUpdate, onClose, onSave }) {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
// MarkStaffModal component mein (already working)
const [rows, setRows] = useState(() => staffData.map((s) => ({
  empId:   s.empId,
  status:  s.status || "",         // koi circle active nahi jab tak saved/selected na ho
  inTime:  s.inTime  || "",        // Saved inTime pre-filled
  outTime: s.outTime || "",        // Saved outTime pre-filled
  from:    s.from    || "ERP",     // Saved platform pre-filled
})));

    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    const setField = (j, patch) => setRows((prev) => prev.map((r, i) => i === j ? { ...r, ...patch } : r));

    const save = () => onSave(rows);

    return createPortal(
      <div className="att-overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="att-modal att-modal-lg">
          <div className="att-modal-header">
            <div className="att-modal-header-left">
              <div className="att-modal-header-icon"><i className="fa-solid fa-user-tie"></i></div>
              <div>
                <div className="att-modal-title">{isUpdate ? "Update" : "Mark"} Staff Attendance — {today}</div>
                <div className="att-modal-sub">Mark present / absent / leave with in/out time for all staff</div>
              </div>
            </div>
            <Tooltip text="Close"><button className="att-modal-close" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"></i></button></Tooltip>
          </div>
          <div className="att-modal-body" style={{ padding: "16px 20px" }}>
            {isUpdate && (
              <div className="att-update-notice">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <div><strong>Attendance has already been marked for this date.</strong> You can update the attendance status before the date changes.</div>
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="att-mark-table" style={{ minWidth: 720 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Staff Name</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>In Time</th>
                    <th>Out Time</th>
                    <th>Marked From</th>
                  </tr>
                </thead>
                <tbody>
                  {staffData.map((s, j) => {
                    const r = rows[j];
                    return (
                      <tr key={s.empId}>
                        <td>{j + 1}</td>
                        <td>
                          <strong>{s.name}</strong>
                          <div style={{ fontSize: 10.5, color: T.textMuted }}>{s.desig}</div>
                        </td>
                        <td style={{ fontSize: 12 }}>{s.dept}</td>
                        <td>
                          <div className="att-radio-group">
                            <Tooltip text="Mark Present">
                              <button className={`att-radio-btn p${r.status === "present" ? " active" : ""}`} onClick={() => setField(j, { status: "present" })}>P</button>
                            </Tooltip>
                            <Tooltip text="Mark Absent (clears in/out times)">
                              <button className={`att-radio-btn a${r.status === "absent"  ? " active" : ""}`} onClick={() => setField(j, { status: "absent",  inTime: "", outTime: "" })}>A</button>
                            </Tooltip>
                            <Tooltip text="Mark on Leave (clears in/out times)">
                              <button className={`att-radio-btn l${r.status === "leave"   ? " active" : ""}`} onClick={() => setField(j, { status: "leave",   inTime: "", outTime: "" })}>L</button>
                            </Tooltip>
                          </div>
                        </td>
                        <td>
                          <input
                            className="att-input"
                            type="time"
                            value={r.inTime}
                            disabled={r.status !== "present"}
                            onChange={(e) => setField(j, { inTime: e.target.value })}
                            style={{ width: 108, height: 34, fontSize: 12.5 }}
                          />
                        </td>
                        <td>
                          <input
                            className="att-input"
                            type="time"
                            value={r.outTime}
                            disabled={r.status !== "present"}
                            onChange={(e) => setField(j, { outTime: e.target.value })}
                            style={{ width: 108, height: 34, fontSize: 12.5 }}
                          />
                        </td>
                        <td>
                          <select
                            className="att-select"
                            value={r.from}
                            onChange={(e) => setField(j, { from: e.target.value })}
                            style={{ minWidth: 130, height: 34, fontSize: 12 }}
                          >
                            <option>ERP</option>
                            <option>Mobile App</option>
                            <option>Biometric</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="att-modal-footer">
            <Tooltip text="Discard changes and close">
              <button className="att-btn-secondary" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text={isUpdate ? 'Save updated attendance' : 'Save attendance'}>
              <button className="att-btn-primary" onClick={save}>
                <i className="fa-solid fa-floppy-disk"></i> {isUpdate ? "Update" : "Save"} Attendance
              </button>
            </Tooltip>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* Autocomplete combobox — used in Individual Reports.
    - User types → dropdown shows matching items
    - Clicking a suggestion runs `onPick(item)` (which can open a class / scroll to row)
    - Clearing the input closes the dropdown */
  function SearchCombobox({ placeholder, items, renderItem, getKey, getSearchText, onPick }) {
    const [value, setValue] = useState("");
    const [open, setOpen] = useState(false);
    const wrapRef = React.useRef(null);

    /* Close on outside click */
    useEffect(() => {
      const onDoc = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      };
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const q = value.trim().toLowerCase();
    const matches = !q ? [] : items.filter((it) => getSearchText(it).toLowerCase().includes(q)).slice(0, 12);

    return (
      <div ref={wrapRef} className="att-search-wrap">
        <i className="fa-solid fa-magnifying-glass att-search-icon"></i>
        <input
          type="text"
          className="att-search-input"
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        {value && (
          <Tooltip text="Clear search">
            <button className="att-search-clear" onClick={() => { setValue(""); setOpen(false); }} aria-label="Clear search">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </Tooltip>
        )}
        {open && q && (
          <div className="att-search-dropdown">
            {matches.length === 0 ? (
              <div className="att-search-empty">
                <i className="fa-regular fa-folder-open" style={{ marginRight: 6, opacity: .5 }}></i>
                No matches for "<strong>{value}</strong>"
              </div>
            ) : (
              matches.map((it) => (
                <button
                  key={getKey(it)}
                  className="att-search-item"
                  onClick={() => { onPick(it); setValue(""); setOpen(false); }}
                >
                  {renderItem(it)}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  /* ─── Tab 4: Reports ─────────────────────────────────────────────────────
    HTML-faithful: 2 sub-tabs (General / Individual). General = 4 grp-card
    accordions, each with embedded report rows + inline filters + Generate.
    Individual = expandable student class rows + flat staff list. */
  function ReportsTab({ staffData, studentData = [], teacherMap = {}, runGeneralReport, openIndivReport, toast, classOpts = [] }) {
    const [subTab, setSubTab] = useState("general");
    const [openCardIdx, setOpenCardIdx] = useState(0);
    const [openClassIdx, setOpenClassIdx] = useState(null);
    const [highlightStudent, setHighlightStudent] = useState(null); // student id of highlighted row
    const [highlightStaff, setHighlightStaff]     = useState(null); // empId of highlighted row

    /* Flat student list with class info (for the search dropdown) — REAL data. */
    const allStudents = (studentData || []).flatMap((cl, ci) =>
      (cl.students || []).map((s) => ({
        id: s.id, name: s.name, fn: s.father, roll: s.reg, adm: s.reg,
        cls: cl.cls, sec: cl.sec, classIdx: ci,
      }))
    );

    /* Pick handlers — open the right class, highlight the row, scroll into view */
    const pickStudent = (s) => {
      setOpenClassIdx(s.classIdx);
      setHighlightStudent(s.id);
      /* Wait one frame so the accordion has opened, then scroll into view */
      setTimeout(() => {
        const el = document.getElementById(`rpt-student-${s.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        /* Auto-clear the highlight after 2s */
        setTimeout(() => setHighlightStudent(null), 2000);
      }, 280);
    };

    const pickStaff = (s) => {
      setHighlightStaff(s.empId);
      setTimeout(() => {
        const el = document.getElementById(`rpt-staff-${s.empId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => setHighlightStaff(null), 2000);
      }, 50);
    };

    return (
      <>
        <div className="res-sub-tabs">
          <Tooltip text="Show class-wide and staff-wide reports">
            <button className={`res-sub-tab${subTab === "general"    ? " active" : ""}`} onClick={() => setSubTab("general")}>General Reports</button>
          </Tooltip>
          <Tooltip text="Generate a report for a single student or staff member">
            <button className={`res-sub-tab${subTab === "individual" ? " active" : ""}`} onClick={() => setSubTab("individual")}>Individual Reports</button>
          </Tooltip>
        </div>

        {subTab === "general" && (
          <div className="rpt-grp-grid">
            {REPORT_GROUPS.map((g, gi) => {
              const isOpen = openCardIdx === gi;
              return (
                <div key={g.title} className="grp-card">
                  <div className="grp-card-header">
                    <div className="grp-card-icon" style={{ background: g.gradient }}>
                      <i className={`fa-solid ${g.icon}`}></i>
                    </div>
                    <div className="grp-card-info">
                      <div className="grp-card-title">{g.title}</div>
                      <div className="grp-card-sub">{g.sub}</div>
                    </div>
                    <div className="grp-card-meta">
                      <span className="grp-card-count">{g.reports.length} Reports</span>
                      <Tooltip text={isOpen ? 'Hide the list of report types' : 'Show available report types'}>
                        <button
                          className={`grp-view-btn${isOpen ? " open" : ""}`}
                          onClick={() => setOpenCardIdx(isOpen ? -1 : gi)}
                        >
                          {isOpen ? "Hide Details" : "View Details"}
                          <i className="fa-solid fa-chevron-down grp-chev"></i>
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  <div className={`grp-card-body${isOpen ? " open" : ""}`}>
                    <div className="grp-card-body-inner">
                      {g.reports.map((rpt) => (
                        <ReportRow
                          key={rpt.key}
                          rpt={rpt}
                          accent={rpt.altAccent || g.accent}
                          gradient={rpt.altGradient || g.gradient}
                          classOpts={classOpts}
                          onGenerate={(filters) => runGeneralReport(rpt, filters, toast)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {subTab === "individual" && (
          <>
            {/* Individual Student Report */}
            <div className="att-section" style={{ marginBottom: 16 }}>
              <div className="att-section-header" style={{ padding: "14px 18px" }}>
                <div className="att-section-title">
                  <div className="att-section-icon" style={{ background: "linear-gradient(135deg,#b45309,#d97706)" }}>
                    <i className="fa-solid fa-id-card"></i>
                  </div>
                  <div>
                    <div className="att-section-name">Individual Student Report</div>
                    <div className="att-section-sub">Click any class to expand students — then click Report to generate attendance report</div>
                  </div>
                </div>
                <SearchCombobox
                  placeholder="Search student name, father, reg no, class…"
                  items={allStudents}
                  getKey={(s) => s.id}
                  getSearchText={(s) => `${s.name} ${s.fn} ${s.roll} ${s.adm} ${s.cls} ${s.sec}`}
                  onPick={pickStudent}
                  renderItem={(s) => (
                    <>
                      <div className="att-search-item-icon" style={{ background: "linear-gradient(135deg,#b45309,#d97706)" }}>
                        <i className="fa-solid fa-user-graduate"></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="att-search-item-name">{s.name}</div>
                        <div className="att-search-item-sub">
                          <i className="fa-solid fa-chalkboard-user" style={{ fontSize: 9, marginRight: 4 }}></i>
                          {s.cls} · {s.sec} &nbsp;·&nbsp; Roll {s.roll}
                        </div>
                      </div>
                      <i className="fa-solid fa-arrow-right att-search-item-arrow"></i>
                    </>
                  )}
                />
              </div>
              <div className="att-table-head att-rpt-cls-row">
                <div className="att-th att-rpt-cls-num">#</div>
                <div className="att-th att-rpt-cls-name">Class / Section</div>
                <div className="att-th att-rpt-cls-teacher">Class Teacher</div>
                <div className="att-th att-rpt-cls-total">Total Students</div>
                <div className="att-th att-rpt-cls-pct">Attendance</div>
                <div className="att-th att-rpt-cls-chev" style={{ textAlign: "center" }}>Details</div>
              </div>
              {(studentData || []).length === 0 ? (
                <div className="att-row" style={{ padding: 20, color: T.textMuted, fontStyle: "italic" }}>No classes found.</div>
              ) : (studentData || []).map((cl, i) => {
                const isOpen = openClassIdx === i;
                const teacher = teacherMap[`${cl.classID}-${cl.sectionID}`] || cl.teacher || "—";
                const students = cl.students || [];
                // Real attendance % — aaj ki mark hui attendance ke against (present/total).
                const pct = cl.marked && cl.total > 0 ? Math.round((cl.present / cl.total) * 100) : null;
                const pctColor = pct == null ? T.textMuted : pct >= 90 ? "#16A34A" : pct >= 75 ? "#D97706" : "#DC2626";
                return (
                  <div key={`${cl.classID}-${cl.sectionID}`} className="att-row-wrap">
                    <div className="att-row att-rpt-cls-row">
                      <div className="att-td att-rpt-cls-num">{i + 1}</div>
                      <div className="att-td att-rpt-cls-name">
                        <div className="att-row-icon"><i className="fa-solid fa-chalkboard-user"></i></div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary }}>{cl.cls}</div>
                          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                            <i className="fa-solid fa-layer-group" style={{ fontSize: 9, marginRight: 3 }}></i>{cl.sec}
                          </div>
                        </div>
                      </div>
                      <div className="att-td att-rpt-cls-teacher">{teacher}</div>
                      <div className="att-td att-rpt-cls-total">
                        <span style={{ fontSize: 15, fontWeight: 800 }}>{cl.total}</span>
                        <span style={{ fontSize: 10, color: T.textMuted, marginLeft: 3 }}>students</span>
                      </div>
                      <div className="att-td att-rpt-cls-pct">
                        <span style={{ fontSize: 13, fontWeight: 800, color: pctColor }}>{pct == null ? "—" : `${pct}%`}</span>
                      </div>
                      <div className="att-td att-rpt-cls-chev" style={{ justifyContent: "center" }}>
                        <Tooltip text={isOpen ? 'Hide student list' : 'Show student list'}>
                          <button
                            className={`att-chevron-btn${isOpen ? " open" : ""}`}
                            onClick={() => setOpenClassIdx(isOpen ? null : i)}
                            style={{ width: 32, height: 32 }}
                          >
                            <i className="fa-solid fa-chevron-down"></i>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                    <div className={`att-detail${isOpen ? " open" : ""}`}>
                      <div className="att-detail-inner" style={{ padding: "12px 16px", overflowX: "auto" }}>
                        <table className="att-student-table" style={{ minWidth: 480 }}>
                          <thead>
                            <tr>
                              <th>#</th><th>Student Name</th><th>Father Name</th><th>Reg No.</th>
                              <th style={{ textAlign: "center" }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.length === 0 ? (
                              <tr><td colSpan={5} style={{ textAlign: "center", color: T.textMuted, padding: 14, fontStyle: "italic" }}>No student records found.</td></tr>
                            ) : students.map((s, j) => (
                              <tr key={s.id} id={`rpt-student-${s.id}`} className={highlightStudent === s.id ? "att-row-highlight" : ""}>
                                <td>{j + 1}</td>
                                <td><strong>{s.name}</strong></td>
                                <td>{s.father}</td>
                                <td>{s.reg}</td>
                                <td style={{ textAlign: "center" }}>
                                  <Tooltip text={`Generate attendance report for ${s.name}`}>
                                    <button
                                      className="att-btn-primary"
                                      style={{ padding: "5px 14px", fontSize: 11.5, minWidth: 0 }}
                                      onClick={() => openIndivReport({
                                        type: "student",
                                        name: s.name,
                                        detail: `${cl.cls} (${cl.sec})`,
                                        id: s.reg,
                                        sid: s.id,
                                        classID: cl.classID,
                                        sectionID: cl.sectionID,
                                      })}
                                    >
                                      <i className="fa-solid fa-file-lines"></i> Report
                                    </button>
                                  </Tooltip>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Individual Staff Report */}
            <div className="att-section">
              <div className="att-section-header" style={{ padding: "14px 18px" }}>
                <div className="att-section-title">
                  <div className="att-section-icon" style={{ background: "linear-gradient(135deg,#0369a1,#0284c7)" }}>
                    <i className="fa-solid fa-person-chalkboard"></i>
                  </div>
                  <div>
                    <div className="att-section-name">Individual Staff Report</div>
                    <div className="att-section-sub">Click Report next to any staff member to generate their attendance report</div>
                  </div>
                </div>
                <SearchCombobox
                  placeholder="Search staff name, designation, department, employee ID…"
                  items={staffData}
                  getKey={(s) => s.empId}
                  getSearchText={(s) => `${s.name} ${s.desig || ""} ${s.dept || ""} ${s.empId || ""}`}
                  onPick={pickStaff}
                  renderItem={(s) => (
                    <>
                      <div className="att-search-item-icon" style={{ background: "linear-gradient(135deg,#0369a1,#0284c7)" }}>
                        <i className="fa-solid fa-user-tie"></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="att-search-item-name">{s.name}</div>
                        <div className="att-search-item-sub">
                          <i className="fa-solid fa-id-badge" style={{ fontSize: 9, marginRight: 4 }}></i>
                          {s.desig} &nbsp;·&nbsp; {s.dept} &nbsp;·&nbsp; {s.empId}
                        </div>
                      </div>
                      <i className="fa-solid fa-arrow-right att-search-item-arrow"></i>
                    </>
                  )}
                />
              </div>
              <div className="att-table-head att-rpt-sf-row">
                <div className="att-th att-rpt-sf-num">#</div>
                <div className="att-th att-rpt-sf-name">Staff Name</div>
                <div className="att-th att-rpt-sf-desig">Designation</div>
                <div className="att-th att-rpt-sf-dept">Department</div>
                <div className="att-th att-rpt-sf-status">Status</div>
                <div className="att-th att-rpt-sf-action">Action</div>
              </div>
              {staffData.map((s, i) => {
                const stClass = s.marked ? (s.status === "present" ? "marked" : s.status === "absent" ? "pending" : "off") : "pending";
                const stLabel = s.marked
                  ? (s.status === "present" ? "Present" : s.status === "absent" ? "Absent" : s.status === "leave" ? "Leave" : "Pending")
                  : "Not Marked";
                return (
                  <div key={s.empId} id={`rpt-staff-${s.empId}`} className={`att-row-wrap${highlightStaff === s.empId ? " att-row-highlight" : ""}`}>
                    <div className="att-row att-rpt-sf-row">
                      <div className="att-td att-rpt-sf-num">{i + 1}</div>
                      <div className="att-td att-rpt-sf-name">
                        <div className="att-row-icon"><i className="fa-solid fa-user-tie"></i></div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: T.textPrimary }}>{s.name}</div>
                        </div>
                      </div>
                      <div className="att-td att-rpt-sf-desig">{s.desig}</div>
                      <div className="att-td att-rpt-sf-dept">{s.dept}</div>
                      <div className="att-td att-rpt-sf-status">
                        <span className={`att-status-badge ${stClass}`} style={{ fontSize: 10.5 }}>{stLabel}</span>
                      </div>
                      <div className="att-td att-rpt-sf-action">
                        <Tooltip text={`Generate attendance report for ${s.name}`}>
                          <button
                            className="att-btn-primary"
                            style={{ padding: "5px 14px", fontSize: 11.5, minWidth: 0 }}
                            onClick={() => openIndivReport({
                              type: "staff",
                              name: s.name,
                              detail: s.desig,
                              id: s.empId,
                              sid: s.id,
                            })}
                          >
                            <i className="fa-solid fa-file-lines"></i> Report
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>
    );
  }

  /* ─── ReportRow — inline filter editor + Generate ──────────────────────── */
  function ReportRow({ rpt, accent, gradient, onGenerate, classOpts = [] }) {
    const today    = new Date().toISOString().split("T")[0];
    const currMon  = CURRENT_MONTH_LABEL;
    const [vals, setVals] = useState(() => {
      const init = {};
      rpt.filters.forEach((f) => {
        if (f.type === "date")  init[f.field] = today;
        if (f.type === "month") init[f.field] = currMon;
        if (f.type === "year")  init[f.field] = "2025-2026";
        if (f.type === "class") init[f.field] = "All Classes";
      });
      return init;
    });

    const setVal = (field, v) => setVals((p) => ({ ...p, [field]: v }));

    const submit = () => {
      /* Validate that all required filters are filled */
      for (const f of rpt.filters) {
        if ((f.type === "date" || f.type === "month") && !vals[f.field]) {
          onGenerate({ __error: "Please select all required filters before generating." });
          return;
        }
      }
      onGenerate(vals);
    };

    return (
      <div className="grp-rpt-row">
        <div className="grp-rpt-row-top">
          <div className="grp-rpt-row-label">
            <i className={`fa-solid ${rpt.icon}`} style={{ color: accent }}></i>{rpt.label}
          </div>
          <Tooltip text={`Generate ${rpt.label}`}>
            <button className="grp-gen-btn" style={{ background: gradient }} onClick={submit}>
              <i className="fa-solid fa-file-lines"></i> Generate
            </button>
          </Tooltip>
        </div>
        {rpt.filters.length > 0 && (
          <div className="grp-rpt-row-filters">
            {rpt.filters.map((f) => (
              <div key={f.field} className="grp-rpt-field">
                <span className="grp-rpt-field-lbl">{f.k}</span>
                {f.type === "date" && (
                  <input type="date" className="att-input" value={vals[f.field] || ""} onChange={(e) => setVal(f.field, e.target.value)} />
                )}
                {f.type === "month" && (
                  <select className="att-select" value={vals[f.field] || ""} onChange={(e) => setVal(f.field, e.target.value)}>
                    {MONTH_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                )}
                {f.type === "year" && (
                  <select className="att-select" value={vals[f.field] || ""} onChange={(e) => setVal(f.field, e.target.value)}>
                    {YEAR_OPTIONS.map((y) => <option key={y}>{y}</option>)}
                  </select>
                )}
                {f.type === "class" && (
                  <select className="att-select" value={vals[f.field] || ""} onChange={(e) => setVal(f.field, e.target.value)}>
                    {(classOpts.length ? classOpts : CLASS_OPTIONS).map((c) => <option key={c}>{c}</option>)}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ─── Individual Report date-picker modal ────────────────────────────── */
  function IndividualReportModal({ target, onClose, onGenerate }) {
    const today    = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    const todayStr     = today.toISOString().split("T")[0];

    const [fromDate, setFromDate] = useState(firstOfMonth);
    const [toDate, setToDate]     = useState(todayStr);
    const [style, setStyle]       = useState("color");

    useEffect(() => {
      const onKey = (e) => { if (e.key === "Escape") onClose(); };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!target) return null;

    const submit = () => {
      if (!fromDate || !toDate) return onGenerate({ __error: "Please select both From and To dates" });
      if (fromDate > toDate)    return onGenerate({ __error: "From Date cannot be after To Date" });
      onGenerate({ fromDate, toDate, isColor: style === "color" });
    };

    const titlePrefix = target.type === "student" ? "Student" : "Staff";

    return createPortal(
      <div
        className="att-overlay open"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="att-indiv-title"
      >
        <div className="att-rpt-picker" style={{ maxWidth: 440 }}>
          <div className="att-rpt-header">
            <div>
              <div className="att-rpt-title" id="att-indiv-title">{titlePrefix} Attendance Report</div>
              <div className="att-rpt-sub">{target.name} — {target.detail}</div>
            </div>
            <Tooltip text="Close"><button className="att-rpt-close" onClick={onClose} aria-label="Close report dialog"><i className="fa-solid fa-xmark"></i></button></Tooltip>
          </div>
          <div className="att-rpt-body" style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: T.textMuted, marginBottom: 6 }}>From Date</div>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="att-input" style={{ width: "100%", height: 40, fontSize: 13 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", color: T.textMuted, marginBottom: 6 }}>To Date</div>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="att-input" style={{ width: "100%", height: 40, fontSize: 13 }} />
              </div>
            </div>
            <div className="att-rpt-section-lbl" id="att-indiv-style-lbl">Print Style</div>
            <div className="att-rpt-grid" role="radiogroup" aria-labelledby="att-indiv-style-lbl">
              <div
                className={`att-rpt-card${style === "color" ? " selected" : ""}`}
                onClick={() => setStyle("color")}
                role="radio"
                aria-checked={style === "color"}
                tabIndex={style === "color" ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); setStyle("color"); }
                  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setStyle("color"); }
                  else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setStyle("bw"); }
                }}
              >
                <div className="att-rpt-preview-color" aria-hidden="true">
                  <div className="att-rpt-mock-line"  style={{ width: "60%" }}></div>
                  <div className="att-rpt-mock-line2" style={{ width: "40%" }}></div>
                </div>
                <div className="att-rpt-card-text">
                  <div className="att-rpt-card-name"><i className="fa-solid fa-palette" style={{ color: "#1E40AF", marginRight: 6 }} aria-hidden="true"></i>Colorful Report</div>
                  <div className="att-rpt-card-desc">School branding, summary cards &amp; status badges</div>
                </div>
              </div>
              <div
                className={`att-rpt-card${style === "bw" ? " selected" : ""}`}
                onClick={() => setStyle("bw")}
                role="radio"
                aria-checked={style === "bw"}
                tabIndex={style === "bw" ? 0 : -1}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") { e.preventDefault(); setStyle("bw"); }
                  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); setStyle("color"); }
                  else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); setStyle("bw"); }
                }}
              >
                <div className="att-rpt-preview-bw" aria-hidden="true">
                  <div className="att-rpt-mock-line"  style={{ width: "60%" }}></div>
                  <div className="att-rpt-mock-line2" style={{ width: "40%" }}></div>
                </div>
                <div className="att-rpt-card-text">
                  <div className="att-rpt-card-name"><i className="fa-solid fa-circle-half-stroke" style={{ color: "#374151", marginRight: 6 }} aria-hidden="true"></i>Colorless Report</div>
                  <div className="att-rpt-card-desc">Low-ink layout — white background, light borders only</div>
                </div>
              </div>
            </div>
          </div>
          <div className="att-rpt-footer">
            <Tooltip text="Cancel and close">
              <button className="att-btn-secondary" onClick={onClose}>Cancel</button>
            </Tooltip>
            <Tooltip text="Generate the individual attendance report">
              <button className="att-btn-primary" onClick={submit}>
                <i className="fa-solid fa-file-lines"></i> Generate Report
              </button>
            </Tooltip>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  /* ─── Toast host (used when no parent onToast is supplied) ─────────────────── */
  function useToasts(external) {
    const [toasts, setToasts] = useState([]);
    const toast = useCallback((message, type = "info") => {
      if (external) { external(message, type); return; }
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
    }, [external]);
    return { toasts, toast };
  }

  function ToastStack({ toasts }) {
    const colors = { success: T.success, error: T.error, info: T.brandMid };
    return (
      <div style={{ position: "fixed", top: 18, right: 18, display: "flex", flexDirection: "column", gap: 8, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: T.bgCard, border: `1.5px solid ${colors[t.type]}55`, borderLeft: `4px solid ${colors[t.type]}`, borderRadius: T.radiusMd, padding: "12px 16px", fontSize: 13, fontWeight: 600, color: T.textPrimary, boxShadow: T.shadowSm, maxWidth: 320, fontFamily: T.font }}>
            {t.message}
          </div>
        ))}
      </div>
    );
  }

  /* ─── Main component ──────────────────────────────────────────────────────── */
  export default function Attendance({ onToast }) {
    const TABS = [
      { id: "holidays", label: "Holidays Setup",     icon: "fa-umbrella-beach" },
      { id: "student",  label: "Student Attendance", icon: "fa-user-graduate" },
      { id: "staff",    label: "Staff Attendance",   icon: "fa-users" },
      { id: "reports",  label: "Reports",            icon: "fa-chart-bar" },
    ];
    const [tab, setTab] = useState("holidays");
    const [tutorialOpen, setTutorialOpen] = useState(false);
    // Holidays load per-month from the API when a month is expanded.
    const [holidays, setHolidays]         = useState([]);
    const [loadingMonth, setLoadingMonth] = useState(null); // month idx currently fetching
    const [activeSessionID, setActiveSessionID] = useState(0);
    const [classList, setClassList] = useState([]); // branch class+section list (for name lookup)
    const { toasts, toast } = useToasts(onToast);

    /* Modal state for Tab 1 */
    const [holModal, setHolModal]         = useState(null); // { id?, monthIdx? } | null
    const [delHolId, setDelHolId]         = useState(null); // holiday id pending delete
    const [dayToggleIdx, setDayToggleIdx] = useState(null); // weekly day index pending toggle

    /* Modal state for Tab 2 (Student) */
    const [markStIdx, setMarkStIdx]       = useState(null); // class index pending mark/update
    const { data: studentData = [], setData: setStudentData } = useAsync(() => attendanceService.getClassStudentList(), []);

    /* Modal state for Tab 3 (Staff) */
    const [markSfOpen, setMarkSfOpen]     = useState(false);
    const [employees, setEmployees]       = useState([]); // real employees (with assignments)
    const [staffData, setStaffData]       = useState([]); // derived staff-attendance rows
    const [staffTodayMarked, setStaffTodayMarked] = useState(true);

    // Student/Staff Attendance → real employees from the branch.
    useEffect(() => {
      (async () => {
        try {
          const emps = await attendanceService.getEmployeesByBranch();
          setEmployees(emps);
          setStaffData(emps.map((e) => ({
            id:    e.id,
            name:  `${e.firstName || ""} ${e.lastName || ""}`.trim() || "—",
            empId: `EMP-${e.id}`,
            desig: e.designationName || "—",
            dept:  e.departmentName || "—",
            email: e.email || "",
            phone: e.phone || "",
            status: "", inTime: "", outTime: "", from: "", marked: false,
          })));
        } catch (err) {
          console.error("Could not load employees:", err);
        }
      })();
    }, []);

    // class+section (gradeId-sectionId) → class teacher name (first assigned teacher).
    const teacherMap = useMemo(() => {
      const map = {};
      employees.forEach((e) => {
        const tName = `${e.firstName || ""} ${e.lastName || ""}`.trim();
        (e.assignments || []).forEach((a) => {
          const key = `${a.gradeId}-${a.sectionId}`;
          if (!map[key] && tName) map[key] = tName;
        });
      });
      return map;
    }, [employees]);

    /* Report picker + preview state */
    const [reportPicker,   setReportPicker]   = useState(null); // { title, context, ... }
    const [reportPreview,  setReportPreview]  = useState(null); // { title, html }
    const [indivTarget,    setIndivTarget]    = useState(null); // { type, name, detail, id } | null
    const [branchSchool,   setBranchSchool]   = useState(null); // /report-header → { name, logo, address, session }
    const [reportSessions, setReportSessions] = useState([]);   // [{ ID, SessionName }] for report filters

    // Report header (branch info) + session list — for the Holiday report picker.
    useEffect(() => {
      (async () => {
        try { setBranchSchool(await attendanceService.getReportHeader()); }
        catch (err) { console.error("Could not load report header:", err); }
        try { setReportSessions(await attendanceService.getSessionsForBranch()); }
        catch (err) { console.error("Could not load sessions:", err); }
      })();
    }, []);
// Attendance component mein, useAsync ki jagah yeh use karo
const [weeklyOff, setWeeklyOff] = useState([]);
const [weeklyOffLoading, setWeeklyOffLoading] = useState(true);

// GET weekly off data on component mount
// Attendance component mein, useEffect ke ANDAR yeh change karo
useEffect(() => {
  const fetchWeeklyOff = async () => {
    try {
      setWeeklyOffLoading(true);
      const response = await attendanceService.getWeeklyOffSetup();
      console.log("Fetched weekly off response:", response);
      
      // ✅ RESPONSE SE data ARRAY NIKALO
      const data = response?.data || [];
      
      if (Array.isArray(data) && data.length > 0) {
        // ✅ WeekDay strings ko index mein convert karo
        const weekDays = data
          .map(item => {
            const index = DAYS_F.indexOf(item.WeekDay); // ✅ Capital W (WeekDay)
            return index !== -1 ? index : null;
          })
          .filter(idx => idx !== null);
        
        console.log("Converted weekdays:", weekDays);
        setWeeklyOff(weekDays);
      } else {
        setWeeklyOff([]);
      }
    } catch (error) {
      console.error("Error fetching weekly off:", error);
      setWeeklyOff([]);
    } finally {
      setWeeklyOffLoading(false);
    }
  };

  fetchWeeklyOff();
}, []);
    const openReportPicker = useCallback((cfg) => setReportPicker(cfg), []);
    const openMarkSt = useCallback((idx) => setMarkStIdx(idx), []);

    const openIndivReport = useCallback((target) => setIndivTarget(target), []);

    // Ek person (student/staff) ki real attendance range ke andar → date → { status, platform, in/out }.
    const fetchIndividualAttendance = useCallback(async (target, fromDate, toDate) => {
      if (!target || !fromDate || !toDate) return {};
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const sid = String(target.sid ?? "");
      const isStudent = target.type === "student";
      const dates = [];
      const end = new Date(`${toDate}T00:00:00`);
      for (let d = new Date(`${fromDate}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }
      const map = {};
      await Promise.all(dates.map(async (dateStr) => {
        try {
          let recs = [];
          if (isStudent) {
            const res = await attendanceService.studentAttendance({
              id: 0, branchID, studentID: 0, sessionID,
              classID: target.classID || 0, sectionID: target.sectionID || 0,
              attendanceDate: dateStr, status: "", platform: "ERP",
              isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
            });
            recs = (res?.data || []).filter((r) =>
              String(r.AttendanceDate ?? r.attendanceDate ?? "").slice(0, 10) === dateStr &&
              String(r.StudentID ?? r.studentID ?? r.studentId) === sid);
          } else {
            const res = await attendanceService.staffAttendance({
              id: 0, staffID: 0, branchID, attendanceDate: dateStr,
              checkInTime: "", checkOutTime: "", status: "", platform: "",
              isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
            });
            recs = (res?.data || []).filter((r) =>
              String(r.AttendanceDate ?? r.attendanceDate ?? "").slice(0, 10) === dateStr &&
              String(r.StaffID ?? r.staffID) === sid);
          }
          if (recs.length) {
            const rec = recs[recs.length - 1]; // us din ka aakhri mark
            const raw = String(rec.Status ?? rec.status ?? "").toLowerCase();
            map[dateStr] = {
              status: ST_CODE_TO_STATUS[raw] || raw,
              platform: rec.Platform ?? rec.platform ?? "",
              inTime: rec.CheckInTime ?? rec.checkInTime ?? "",
              outTime: rec.CheckOutTime ?? rec.checkOutTime ?? "",
            };
          }
        } catch (err) { console.error("Individual attendance fetch error:", err); }
      }));
      return map;
      // ensureSessionID is defined later; referenced via closure at call time.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const runIndivReport = useCallback(async ({ fromDate, toDate, isColor, __error }) => {
      if (__error) { toast(__error, "error"); return; }
      const target = indivTarget;
      setIndivTarget(null);
      toast(`Generating ${target.name}'s report…`, "info");
      const records = await fetchIndividualAttendance(target, fromDate, toDate);
      const html = buildIndividualReportHTML({ target, fromDate, toDate, weeklyOff, holidays, isColor, records, branchSchool });
      setReportPreview({ title: `${target.type === "student" ? "Student" : "Staff"} Attendance Report — ${target.name}`, html });
    }, [indivTarget, weeklyOff, holidays, toast, fetchIndividualAttendance, branchSchool]);

    const openMarkSf = useCallback(() => setMarkSfOpen(true), []);
  // Attendance component ke andar (around line 2100)

 // Attendance component ke andar - saveMarkSf ko replace karo

// Attendance component mein - saveMarkSf function

const saveMarkSf = useCallback(async (rows) => {
  const branchID = Number(sessionStorage.getItem("branchID"));
  const employeeID = Number(sessionStorage.getItem("employee_ID")) || 0;
  const attendanceDate = new Date().toISOString().slice(0, 10);

  try {
    // Sirf UNHI staff ko save karo jinhein mark kiya (status set hai). Har staff
    // ke liye: pehle se record hai (attendanceID>0) → "update"; warna "insert".
    const toSave = rows
      .map((row, index) => ({ row, staff: staffData[index] }))
      .filter(({ row }) => row.status);
    if (toSave.length === 0) {
      toast("Please mark at least one staff member.", "error");
      return;
    }
    const promises = toSave.map(({ row, staff }) => {
      const existingId = staff.attendanceID || 0;
      const payload = {
        id: existingId,
        staffID: staff.id || 0,
        branchID: branchID,
        attendanceDate: attendanceDate,
        checkInTime: row.inTime || "",
        checkOutTime: row.outTime || "",
        status: row.status,
        platform: row.from || "ERP", // Marked From wali selected value
        isNotificationGen: false,
        action: existingId > 0 ? "update" : "insert",
        createdBy: employeeID,
        modifiedBy: employeeID,
      };
      return attendanceService.staffAttendance(payload);
    });

    await Promise.all(promises);

    // Save ke baad fresh GET — naye attendanceID + status turant reflect ho.
    await loadStaffAttendance(attendanceDate);
    setStaffTodayMarked(true);
    setMarkSfOpen(false);
    toast("Staff attendance saved successfully", "success");
  } catch (error) {
    console.error("Error saving staff attendance:", error);
    toast("Failed to save staff attendance. Please try again.", "error");
  }
  // loadStaffAttendance closure se resolve hota hai (baad mein defined).
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [staffData, toast]);
    const generateReport = useCallback(async ({ effective, style, filters }) => {
      const isColor = style === "color";
      let html, title;
      if (effective === "holidayYearly") {
        // Chosen session (name → ID) → fetch that session's holidays from the API.
        const sess = reportSessions.find((s) => s.SessionName === filters.year);
        const sessionID = sess?.ID || reportPicker?.sessionID || await ensureSessionID();
        const branchID  = Number(sessionStorage.getItem("branchID"));
        const classes   = await ensureClasses();
        const results = await Promise.all(
          MONTHS.map((_, i) =>
            attendanceService.monthlySetup({
              id: 0, branchID, sessionID,
              holidayTitle: "", description: "", dateFrom: "", dateTo: "",
              month: i + 1, action: "get", createdBy: 0, modifiedBy: 0, classIDs: [],
            }).then((r) => r?.data || []).catch(() => [])
          )
        );
        // Sirf chosen session ke rows (backend session ignore kare to bhi safe).
        const rows = results.flat().filter(
          (r) => String(r.SessionID ?? r.sessionID) === String(sessionID)
        );
        let hols = groupHolidayRows(rows, classes);
        if (filters.class && filters.class !== "All Classes") {
          hols = hols.filter((h) => (h.selectedClasses || []).some((c) => c.label === filters.class));
        }
        html  = buildYearlyHolidayReportHTML({ holidays: hols, weeklyOff, year: filters.year, classFilter: filters.class, isColor, branchSchool });
        title = "Yearly Holiday Report";
        setReportPicker(null);
        setReportPreview({ title, html });
        return;
      } else if (effective === "studentDaily" || effective === "studentDailyClass") {
        const date = filters.date || reportPicker?.defaultDate || new Date().toISOString().slice(0, 10);
        const rows = await fetchDailyReportRows(date);
        html  = buildDailyStudentReportHTML({
          rows,
          date,
          classFilter: filters.class,
          sectionFilter: filters.section,
          forClass: reportPicker?.forClass,
          isColor,
          branchSchool,
        });
        title = reportPicker?.title || "Daily Student Attendance Report";
      } else if (effective === "studentMonthly" || effective === "studentMonthlyClass") {
        const monthLabel = filters.month || reportPicker?.defaultMonth || CURRENT_MONTH_LABEL;
        const { year, monthIdx0 } = parseMonthLabel(monthLabel);
        toast(`Generating ${monthLabel} report…`, "info");
        const rows = await fetchMonthlyReportRows(year, monthIdx0);
        html  = buildStudentMonthlySummaryHTML({
          rows,
          monthLabel,
          sessionName: branchSchool?.session,
          branchSchool,
          isColor,
          classFilter: filters.class,
          sectionFilter: filters.section,
        });
        title = reportPicker?.title || "Monthly Student Attendance Report";
      } else if (effective === "staffDaily" || effective === "staffDailyOne") {
        const date = filters.date || reportPicker?.defaultDate || new Date().toISOString().slice(0, 10);
        const rows = await fetchDailyStaffReportRows(date);
        html  = buildDailyStaffReportHTML({
          staffData: rows,
          date,
          deptFilter: filters.dept,
          forStaff: reportPicker?.forStaff,
          isColor,
          branchSchool,
        });
        title = reportPicker?.title || "Daily Staff Attendance Report";
      } else if (effective === "staffMonthly" || effective === "staffMonthlyOne") {
        const monthLabel = filters.month || reportPicker?.defaultMonth || CURRENT_MONTH_LABEL;
        const { year, monthIdx0 } = parseMonthLabel(monthLabel);
        toast(`Generating ${monthLabel} staff report…`, "info");
        const rows = await fetchMonthlyStaffReportRows(year, monthIdx0);
        html  = buildMonthlyStaffReportHTML({
          staffData: rows,
          month: monthLabel,
          deptFilter: filters.dept,
          forStaff: reportPicker?.forStaff,
          isColor,
          branchSchool,
        });
        title = reportPicker?.title || "Monthly Staff Attendance Report";
      } else if (effective === "staffSummary") {
        const monthLabel = filters.month || CURRENT_MONTH_LABEL;
        const { year, monthIdx0 } = parseMonthLabel(monthLabel);
        toast(`Generating ${monthLabel} staff summary…`, "info");
        const rows = await fetchMonthlyStaffReportRows(year, monthIdx0);
        html  = buildMonthlyStaffReportHTML({ staffData: rows, month: monthLabel, isColor, branchSchool });
        title = "Staff Attendance Summary";
      } else if (effective === "studentClasswise") {
        const period = filters.from && filters.to ? `${filters.from} → ${filters.to}` : "";
        toast("Generating class-wise report…", "info");
        const rows = await fetchRangeReportRows(filters.from, filters.to);
        html  = buildStudentMonthlySummaryHTML({
          rows, monthLabel: period, sessionName: branchSchool?.session,
          branchSchool, isColor, classFilter: filters.class,
        });
        title = "Class-wise Student Attendance Report";
      } else if (effective === "studentSummary") {
        const period = filters.from && filters.to ? `${filters.from} → ${filters.to}` : "";
        toast("Generating summary report…", "info");
        const rows = await fetchRangeReportRows(filters.from, filters.to);
        html  = buildStudentMonthlySummaryHTML({
          rows, monthLabel: period, sessionName: branchSchool?.session,
          branchSchool, isColor,
        });
        title = "Student Attendance Summary";
      } else if (effective === "classOverview") {
        const monthLabel = filters.month || CURRENT_MONTH_LABEL;
        const { year, monthIdx0 } = parseMonthLabel(monthLabel);
        toast(`Generating ${monthLabel} class overview…`, "info");
        const rows = await fetchMonthlyReportRows(year, monthIdx0);
        html  = buildClassOverviewHTML({ rows, month: monthLabel, isColor, branchSchool });
        title = "Class Overview Report";
      } else if (effective === "classComparison") {
        const monthLabel = filters.month || CURRENT_MONTH_LABEL;
        const { year, monthIdx0 } = parseMonthLabel(monthLabel);
        toast(`Generating ${monthLabel} class comparison…`, "info");
        const rows = await fetchMonthlyReportRows(year, monthIdx0);
        html  = buildClassComparisonHTML({ rows, month: monthLabel, isColor, branchSchool });
        title = "Class Comparison Report";
      } else if (effective === "lowAttendance") {
        const monthLabel = filters.month || CURRENT_MONTH_LABEL;
        const { year, monthIdx0 } = parseMonthLabel(monthLabel);
        toast(`Generating ${monthLabel} low-attendance alert…`, "info");
        const rows = await fetchMonthlyReportRows(year, monthIdx0);
        html  = buildLowAttendanceHTML({ rows, month: monthLabel, isColor, branchSchool });
        title = "Low Attendance Alert Report";
      } else if (effective === "holidayMonthly") {
        const monthLabel = filters.month || CURRENT_MONTH_LABEL;
        const { monthIdx0 } = parseMonthLabel(monthLabel);
        const monthHolidays = await fetchMonthHolidaysList(monthIdx0);
        html  = buildMonthlyHolidayReportHTML({ holidays: monthHolidays, weeklyOff, month: monthLabel, isColor, branchSchool });
        title = "Monthly Holiday Report";
      } else {
        html = rptPageWrap({
          rptLabel: "Report Preview",
          period: filters.month || filters.year || filters.date || "",
          isColor,
          content: `<div style="text-align:center;padding:60px 20px;color:#64748B"><i class="fa-solid fa-circle-info" style="font-size:36px;opacity:.4;display:block;margin-bottom:14px"></i><div style="font-size:14px;font-weight:700;color:#0F172A;margin-bottom:6px">This report type will be available soon.</div><div style="font-size:12.5px">Selected type: <strong>${effective}</strong> · Style: <strong>${isColor ? "Color" : "B&amp;W"}</strong></div></div>`,
        });
        title = "Report Preview";
      }
      setReportPicker(null);
      setReportPreview({ title, html });
      // ensureClasses/ensureSessionID are defined later; referenced via closure at call time.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [holidays, weeklyOff, studentData, staffData, reportPicker, reportSessions, branchSchool]);

    /* General Reports tab → trigger generateReport with the inline filters
      (always Color print style for one-click generation). */
    const runGeneralReport = useCallback((rpt, filters) => {
      if (filters.__error) { toast(filters.__error, "error"); return; }
      generateReport({ effective: rpt.key, style: "color", filters });
    }, [generateReport, toast]);

  const requestToggleDay = useCallback((i) => {
    setDayToggleIdx(i);
  }, []);

  const confirmToggleDay = useCallback(() => {
    if (dayToggleIdx == null) return;
    setWeeklyOff((prev) => {
      const isOff = prev.includes(dayToggleIdx);
      const newWeeklyOff = isOff 
        ? prev.filter((x) => x !== dayToggleIdx) 
        : [...prev, dayToggleIdx];
      
      console.log(`Updated weeklyOff: ${dayToggleIdx} is now ${isOff ? 'removed' : 'added'}`, newWeeklyOff);
      toast(isOff ? `${DAYS_F[dayToggleIdx]} marked as Working Day` : `${DAYS_F[dayToggleIdx]} marked as Weekly Off`, "success");
      return newWeeklyOff;
    });
    setDayToggleIdx(null);
  }, [dayToggleIdx, toast, setWeeklyOff]);
    // Active session — same active-session API examination uses. Cached once.
    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const sid = Number(await attendanceService.getActiveSessionID()) || 0;
          if (alive && sid) setActiveSessionID(sid);
        } catch (err) { console.error("Could not load active session:", err); }
      })();
      return () => { alive = false; };
    }, []);

    const ensureSessionID = useCallback(async () => {
      if (activeSessionID) return activeSessionID;
      try {
        const sid = Number(await attendanceService.getActiveSessionID()) || 0;
        if (sid) { setActiveSessionID(sid); return sid; }
      } catch (err) { console.error("Could not load active session:", err); }
      return Number(sessionStorage.getItem("sessionID")) || 0; // fallback
    }, [activeSessionID]);

    // GET saved attendance for a class/section (today) → prefill statuses + counts.
    const loadStudentMarks = useCallback(async (idx) => {
      const row = studentData[idx];
      if (!row) return {};
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const attendanceDate = new Date().toISOString().slice(0, 10);
      const map = {};
      try {
        const res = await attendanceService.studentAttendance({
          id: 0, branchID, studentID: 0, sessionID,
          classID: row.classID, sectionID: row.sectionID,
          attendanceDate, status: "", platform: "ERP",
          isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
        });
        (res?.data || [])
          .filter((rec) =>
            String(rec.AttendanceDate ?? rec.attendanceDate ?? "").slice(0, 10) === attendanceDate &&
            String(rec.ClassID ?? rec.classID) === String(row.classID) &&
            String(rec.SectionID ?? rec.sectionID) === String(row.sectionID)
          )
          .forEach((rec) => {
            const sid = rec.studentID ?? rec.StudentID ?? rec.studentId;
            const raw = rec.status ?? rec.Status;
            // Status numeric code ("1") ya word ("present") — dono handle karo.
            const status = ST_CODE_TO_STATUS[String(raw)]
              || (typeof raw === "string" ? raw.toLowerCase() : undefined);
            if (sid != null && status) map[sid] = status;
          });
      } catch (err) {
        console.error("Error loading student attendance:", err);
      }
      // Reflect saved statuses into the class row (detail table + counts).
      setStudentData((prev) => prev.map((r, i) => {
        if (i !== idx) return r;
        const students = (r.students || []).map((s) => ({ ...s, status: map[s.id] }));
        // Marked only if at least one student in THIS class has a status.
        const anyMarked = students.some((s) => s.status);
        return {
          ...r, students, marked: anyMarked,
          present: students.filter((s) => s.status === "present").length,
          absent:  students.filter((s) => s.status === "absent").length,
          leave:   students.filter((s) => s.status === "leave").length,
        };
      }));
      return map;
    }, [studentData, ensureSessionID, setStudentData]);

    // Save Attendance → action:"insert" for EACH student.
    const saveStudentMarks = useCallback(async (idx, studentRows) => {
      const row = studentData[idx];
      if (!row) return;
      const branchID   = Number(sessionStorage.getItem("branchID"));
      const employeeID = Number(sessionStorage.getItem("employee_ID")) || 0;
      const sessionID  = await ensureSessionID();
      const attendanceDate = new Date().toISOString().slice(0, 10);
      // Only students that were actually marked (blank = untouched → skip).
      const marked = studentRows.filter((s) => s.status && ST_STATUS_TO_CODE[s.status]);
      if (marked.length === 0) {
        toast("Please mark at least one student.", "error");
        throw new Error("no-status");
      }
      try {
        await Promise.all(marked.map((s) => attendanceService.studentAttendance({
          id: 0, branchID, studentID: s.id, sessionID,
          classID: row.classID, sectionID: row.sectionID,
          attendanceDate, status: String(ST_STATUS_TO_CODE[s.status]), platform: "ERP",
          isNotificationGen: false, action: "insert",
          createdBy: employeeID, modifiedBy: employeeID,
        })));
      } catch (err) {
        console.error("Error saving student attendance:", err);
        toast("Failed to save attendance. Please try again.", "error");
        throw err; // keep modal open
      }
      const present = studentRows.filter((s) => s.status === "present").length;
      const absent  = studentRows.filter((s) => s.status === "absent").length;
      const leave   = studentRows.filter((s) => s.status === "leave").length;
      setStudentData((prev) => prev.map((r, i) => i === idx ? {
        ...r, marked: true, present, absent, leave,
        students: (r.students || []).map((st) => {
          const m = studentRows.find((x) => x.id === st.id);
          return m ? { ...st, status: m.status } : st;
        }),
        markedFrom: "ERP",
        markedTime: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      } : r));
      setMarkStIdx(null);
      toast("Attendance saved successfully", "success");
    }, [studentData, ensureSessionID, toast, setStudentData]);

    // Student tab active → GET saved attendance for EVERY class (so the table
    // shows P/A/L counts without needing to expand each class).
    const loadAllStudentMarks = useCallback(async () => {
      await Promise.all(studentData.map((_, idx) => loadStudentMarks(idx)));
    }, [studentData, loadStudentMarks]);

    // Calendar par koi date select → us date ki per-class attendance (P/A/L,
    // status, Platform, class teacher) laao → StudentDatePanel bhare.
    const [dateAttendance, setDateAttendance] = useState(null); // { key, rows, loading }
    const loadDateAttendance = useCallback(async (dateStr) => {
      setDateAttendance({ key: dateStr, rows: [], loading: true });
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const rows = await Promise.all((studentData || []).map(async (r) => {
        let recs = [];
        try {
          const res = await attendanceService.studentAttendance({
            id: 0, branchID, studentID: 0, sessionID,
            classID: r.classID, sectionID: r.sectionID,
            attendanceDate: dateStr, status: "", platform: "ERP",
            isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
          });
          // Backend saare classes/dates de deta hai → sirf IS class+section ke,
          // aur SELECTED date ke records rakho (warna har class mein same data aa jata).
          recs = (res?.data || []).filter((rec) =>
            String(rec.AttendanceDate ?? rec.attendanceDate ?? "").slice(0, 10) === dateStr &&
            String(rec.ClassID ?? rec.classID) === String(r.classID) &&
            String(rec.SectionID ?? rec.sectionID) === String(r.sectionID)
          );
        } catch (err) {
          console.error("Error loading date attendance:", err);
        }
        let present = 0, absent = 0, leave = 0, late = 0, platform = "";
        recs.forEach((rec) => {
          // Status numeric code ("1") ya word ("present") — dono handle karo.
          const raw = String(rec.Status ?? rec.status ?? "").toLowerCase();
          const st = ST_CODE_TO_STATUS[raw] || raw;
          if (st === "present") present++;
          else if (st === "absent") absent++;
          else if (st === "leave") leave++;
          else if (st === "late") late++;
          platform = rec.Platform ?? rec.platform ?? platform;
        });
        return {
          cls: r.cls, sec: r.sec, total: r.total,
          present, absent, leave, late,
          marked: recs.length > 0,
          markedFrom: platform || (recs.length ? "ERP" : ""),
          markedBy: teacherMap[`${r.classID}-${r.sectionID}`] || "—",
        };
      }));
      setDateAttendance({ key: dateStr, rows, loading: false });
    }, [studentData, ensureSessionID, teacherMap]);

    /* Working days = month ke total din − (weekly-off din ∪ holiday din).
      OVERALL — poore month ke liye EK hi number, sab classes + staff ke liye same.
      • Weekly-off: `weeklyOff` state (attendance-weekly-setup API se) — DAYS_F index
        (Monday=0 … Sunday=6). Month ki har date ka weekday check karke off dates banate hain.
      • Holidays: /api/attendance-monthly-setup (get) — wahi jo Holidays module use karta hai.
        Har row ki DateFrom→DateTo range ko target month ke andar expand karte hain.
      Weekly-off aur holiday ka overlap Set union se automatically dedupe hota hai. */
    const fetchMonthHolidayInfo = useCallback(async (year, monthIdx0) => {
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const daysInMonth = new Date(year, monthIdx0 + 1, 0).getDate();
      const offDates = new Set(); // weekly-off + holiday dates (union → no double count)

      // 1) Weekly-off dates — har date jiska weekday `weeklyOff` me hai.
      //    JS getDay(): Sunday=0…Saturday=6 → DAYS_F index (Monday=0…Sunday=6) = (getDay()+6)%7.
      for (let day = 1; day <= daysInMonth; day++) {
        const dowMon0 = (new Date(year, monthIdx0, day).getDay() + 6) % 7;
        if (weeklyOff.includes(dowMon0)) {
          offDates.add(`${year}-${String(monthIdx0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
        }
      }

      // 2) Holiday dates — is month ki (whole month, sab classes ke liye common).
      try {
        const res = await attendanceService.monthlySetup({
          id: 0, branchID, sessionID, holidayTitle: "", description: "",
          dateFrom: "", dateTo: "", month: monthIdx0 + 1, action: "get",
          createdBy: 0, modifiedBy: 0, classIDs: [],
        });
        (res?.data || []).forEach((h) => {
          const from = String(h.DateFrom ?? h.dateFrom ?? "").slice(0, 10);
          const to   = String(h.DateTo ?? h.dateTo ?? "").slice(0, 10);
          if (!from || !to) return;
          // Range ko din-ba-din expand karo; sirf target month/year ki dates lo.
          // (Local date components — toISOString TZ shift se bachne ke liye.)
          const end = new Date(`${to}T00:00:00`);
          for (let d = new Date(`${from}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getFullYear() === year && d.getMonth() === monthIdx0) {
              offDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
            }
          }
        });
      } catch (err) { console.error("Holiday info fetch error:", err); }

      // 3) Working days = daysInMonth − off dates (weekly-off ∪ holidays).
      const workingDays = Math.max(0, daysInMonth - offDates.size);
      return { daysInMonth, workingDays };
    }, [ensureSessionID, weeklyOff]);

    // Monthly Holiday report ke liye — us month ke holidays (grouped) laao,
    // taake Reports tab se bhi bina Holidays tab visit kiye report ban jaye.
    const fetchMonthHolidaysList = useCallback(async (monthIdx0) => {
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const classes   = await ensureClasses();
      try {
        const res = await attendanceService.monthlySetup({
          id: 0, branchID, sessionID, holidayTitle: "", description: "",
          dateFrom: "", dateTo: "", month: monthIdx0 + 1, action: "get",
          createdBy: 0, modifiedBy: 0, classIDs: [],
        });
        return groupHolidayRows(res?.data || [], classes);
      } catch (err) { console.error("Monthly holiday list fetch error:", err); return []; }
      // ensureClasses is defined later; referenced via closure at call time.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ensureSessionID]);

    /* ─── Report data fetchers ───────────────────────────────────────────────
      Real per class+section attendance from /api/student-attendance (get).
      Backend returns the whole class roster's records → we filter locally to
      the class+section and the target date (daily) or month (monthly). */

    // studentID → class index (roster se). Ek record ko sahi class me daalne ke liye —
    // taake report har class ke against uska APNA P/A/L dikhaye (sab combined nahi).
    // studentID na mile to ClassID/SectionID se fallback.
    const makeRecordClassResolver = useCallback((classes) => {
      const studentClassIdx = new Map();
      classes.forEach((r, idx) => (r.students || []).forEach((st) =>
        studentClassIdx.set(String(st.id), idx)));
      return (rec) => {
        const sid = String(rec.StudentID ?? rec.studentID ?? rec.studentId ?? "");
        let idx = studentClassIdx.get(sid);
        if (idx == null) {
          idx = classes.findIndex((r) =>
            String(rec.ClassID ?? rec.classID) === String(r.classID) &&
            String(rec.SectionID ?? rec.sectionID) === String(r.sectionID));
        }
        return (idx == null || idx < 0) ? -1 : idx;
      };
    }, []);

    // Daily report: ek call → us date ke SAARE records; phir studentID/class se
    // har record ko uski class me daal kar per-class P/A/L nikalte hain.
    const fetchDailyReportRows = useCallback(async (dateStr) => {
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const classes = studentData || [];
      if (!classes.length) return [];
      const resolveIdx = makeRecordClassResolver(classes);

      let recs = [];
      try {
        const res = await attendanceService.studentAttendance({
          id: 0, branchID, studentID: 0, sessionID,
          classID: classes[0].classID, sectionID: classes[0].sectionID,
          attendanceDate: dateStr, status: "", platform: "ERP",
          isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
        });
        recs = (res?.data || []).filter((rec) =>
          String(rec.AttendanceDate ?? rec.attendanceDate ?? "").slice(0, 10) === dateStr);
      } catch (err) { console.error("Daily report fetch error:", err); }

      const agg = classes.map(() => ({ present: 0, absent: 0, leave: 0, marked: false, platform: "" }));
      recs.forEach((rec) => {
        const idx = resolveIdx(rec);
        if (idx < 0) return;
        const raw = String(rec.Status ?? rec.status ?? "").toLowerCase();
        const st = ST_CODE_TO_STATUS[raw] || raw;
        if (st === "present") agg[idx].present++;
        else if (st === "absent") agg[idx].absent++;
        else if (st === "leave") agg[idx].leave++;
        else return;
        agg[idx].marked = true;
        // "Marked By" column me platform (ERP / Mobile App / Biometric …) dikhana hai.
        agg[idx].platform = String(rec.Platform ?? rec.platform ?? "") || agg[idx].platform;
      });

      return classes.map((r, idx) => ({
        cls: r.cls, sec: r.sec, total: r.total,
        present: agg[idx].present, absent: agg[idx].absent, leave: agg[idx].leave,
        marked: agg[idx].marked,
        markedBy: agg[idx].platform || "—",
      }));
    }, [studentData, ensureSessionID, makeRecordClassResolver]);

    // Monthly report: backend har call mein sirf passed date ka data deta hai,
    // isliye month ki har date (start→end) par API chalate hain — har class+section
    // ke against P/A/L aggregate, distinct working-day count aur present %.
    const fetchMonthlyReportRows = useCallback(async (year, monthIdx0) => {
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const classes = studentData || [];
      if (!classes.length) return [];
      const mm = String(monthIdx0 + 1).padStart(2, "0");
      const daysInMonth = new Date(year, monthIdx0 + 1, 0).getDate(); // month ki last date
      const dates = Array.from({ length: daysInMonth }, (_, d) =>
        `${year}-${mm}-${String(d + 1).padStart(2, "0")}`); // "2026-07-01" … "2026-07-31"
      const resolveIdx = makeRecordClassResolver(classes);

      // Working days holidays+weekly-off API se (overall — sab classes ke liye same).
      const holidayInfo = await fetchMonthHolidayInfo(year, monthIdx0);

      // Har date par ek call → us date ke saare records → studentID/class se
      // har record ko uski class ke counter me daalte hain.
      const agg = classes.map(() => ({ present: 0, absent: 0, leave: 0 }));
      await Promise.all(dates.map(async (dateStr) => {
        let recs = [];
        try {
          const res = await attendanceService.studentAttendance({
            id: 0, branchID, studentID: 0, sessionID,
            classID: classes[0].classID, sectionID: classes[0].sectionID,
            attendanceDate: dateStr, status: "", platform: "ERP",
            isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
          });
          recs = (res?.data || []).filter((rec) =>
            String(rec.AttendanceDate ?? rec.attendanceDate ?? "").slice(0, 10) === dateStr);
        } catch (err) { console.error("Monthly report fetch error:", err); }
        recs.forEach((rec) => {
          const idx = resolveIdx(rec);
          if (idx < 0) return;
          const raw = String(rec.Status ?? rec.status ?? "").toLowerCase();
          const st = ST_CODE_TO_STATUS[raw] || raw;
          if (st === "present") agg[idx].present++;
          else if (st === "absent") agg[idx].absent++;
          else if (st === "leave") agg[idx].leave++;
        });
      }));

      return classes.map((r, idx) => {
        const { present, absent, leave } = agg[idx];
        const marks = present + absent + leave;
        return {
          cls: r.cls, sec: r.sec, strength: r.total,
          teacher: teacherMap[`${r.classID}-${r.sectionID}`] || "—",
          workingDays: holidayInfo.workingDays,
          present, absent, leave,
          pct: marks > 0 ? Math.round((present / marks) * 100) : 0,
        };
      });
    }, [studentData, ensureSessionID, fetchMonthHolidayInfo, makeRecordClassResolver, teacherMap]);

    // Date-range report (Class-wise / Summary): From→To ke beech har date par ek call,
    // studentID/class se bucket → per class present/absent/leave aur present %.
    // Working days = range me jitni dates par attendance mark hui (distinct).
    const fetchRangeReportRows = useCallback(async (fromDate, toDate) => {
      const branchID  = Number(sessionStorage.getItem("branchID"));
      const sessionID = await ensureSessionID();
      const classes = studentData || [];
      if (!classes.length || !fromDate || !toDate) return [];
      const resolveIdx = makeRecordClassResolver(classes);

      const dates = [];
      const end = new Date(`${toDate}T00:00:00`);
      for (let d = new Date(`${fromDate}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }

      const agg = classes.map(() => ({ present: 0, absent: 0, leave: 0 }));
      const markedDates = new Set();
      await Promise.all(dates.map(async (dateStr) => {
        let recs = [];
        try {
          const res = await attendanceService.studentAttendance({
            id: 0, branchID, studentID: 0, sessionID,
            classID: classes[0].classID, sectionID: classes[0].sectionID,
            attendanceDate: dateStr, status: "", platform: "ERP",
            isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
          });
          recs = (res?.data || []).filter((rec) =>
            String(rec.AttendanceDate ?? rec.attendanceDate ?? "").slice(0, 10) === dateStr);
        } catch (err) { console.error("Range report fetch error:", err); }
        if (recs.length) markedDates.add(dateStr);
        recs.forEach((rec) => {
          const idx = resolveIdx(rec);
          if (idx < 0) return;
          const raw = String(rec.Status ?? rec.status ?? "").toLowerCase();
          const st = ST_CODE_TO_STATUS[raw] || raw;
          if (st === "present") agg[idx].present++;
          else if (st === "absent") agg[idx].absent++;
          else if (st === "leave") agg[idx].leave++;
        });
      }));

      return classes.map((r, idx) => {
        const { present, absent, leave } = agg[idx];
        const marks = present + absent + leave;
        return {
          cls: r.cls, sec: r.sec, strength: r.total,
          teacher: teacherMap[`${r.classID}-${r.sectionID}`] || "—",
          workingDays: markedDates.size, present, absent, leave,
          pct: marks > 0 ? Math.round((present / marks) * 100) : 0,
        };
      });
    }, [studentData, ensureSessionID, makeRecordClassResolver, teacherMap]);

    // Branch class+section list — cached; used to turn ClassID/SectionID into names.
    const ensureClasses = useCallback(async () => {
      if (classList.length) return classList;
      try {
        const list = await attendanceService.getClassesForBranch();
        setClassList(list);
        return list;
      } catch (err) {
        console.error("Could not load classes:", err);
        return [];
      }
    }, [classList]);

    // Month expand → fetch that month's holidays via action:"get".
    const loadMonthHolidays = useCallback(async (monthIdx) => {
      const branchID   = Number(sessionStorage.getItem("branchID"));
      const employeeID = Number(sessionStorage.getItem("employee_ID")) || 0;
      const sessionID  = await ensureSessionID();
      const classes    = await ensureClasses();
      setLoadingMonth(monthIdx);
      try {
        const res = await attendanceService.monthlySetup({
          id: 0,
          branchID,
          sessionID,
          holidayTitle: "",
          description: "",
          dateFrom: "",
          dateTo: "",
          month: monthIdx + 1, // 1-based month
          action: "get",
          createdBy: employeeID,
          modifiedBy: employeeID,
          classIDs: [],
        });
        const grouped = groupHolidayRows(res?.data || [], classes).filter((h) => h.month === monthIdx);
        setHolidays((prev) => [...prev.filter((h) => h.month !== monthIdx), ...grouped]);
      } catch (err) {
        console.error("Error loading holidays:", err);
        toast("Failed to load holidays for this month.", "error");
      } finally {
        setLoadingMonth(null);
      }
    }, [ensureSessionID, ensureClasses, toast]);

    // Holidays Setup tab active hote hi saara data API se laao (action:"get").
    // UI kahi change nahi — bas har month ka data fetch karke populate hota hai.
    const loadAllHolidays = useCallback(async () => {
      const branchID   = Number(sessionStorage.getItem("branchID"));
      const employeeID = Number(sessionStorage.getItem("employee_ID")) || 0;
      const sessionID  = await ensureSessionID();
      const classes    = await ensureClasses();
      try {
        const results = await Promise.all(
          MONTHS.map((_, i) =>
            attendanceService.monthlySetup({
              id: 0, branchID, sessionID,
              holidayTitle: "", description: "", dateFrom: "", dateTo: "",
              month: i + 1, action: "get",
              createdBy: employeeID, modifiedBy: employeeID, classIDs: [],
            }).then((res) => res?.data || []).catch(() => [])
          )
        );
        // Flat rows → grouped by holiday ID (each holiday once, all classes inside).
        setHolidays(groupHolidayRows(results.flat(), classes));
      } catch (err) {
        console.error("Error loading holidays:", err);
      }
    }, [ensureSessionID, ensureClasses]);
// Attendance component mein loadStaffAttendance function add karo
// Attendance component mein - loadStaffAttendance ko replace karo

// Attendance component mein - loadStaffAttendance function

const loadStaffAttendance = useCallback(async (dateStr) => {
  const branchID = Number(sessionStorage.getItem("branchID"));
  const attendanceDate = dateStr || new Date().toISOString().slice(0, 10);

  try {
    const payload = {
      id: 0,
      staffID: 0,
      branchID: branchID,
      attendanceDate: attendanceDate,
      checkInTime: "",
      checkOutTime: "",
      status: "",
      platform: "",
      isNotificationGen: false,
      action: "get",
      createdBy: 0,
      modifiedBy: 0,
    };

    const response = await attendanceService.staffAttendance(payload);
    const data = response?.data || [];

    console.log("Staff attendance fetched:", data);

    // Update staffData with fetched attendance. API PascalCase deta hai
    // (StaffID/Status/CheckInTime…) → dono casings tolerate karo.
    setStaffData((prev) => prev.map((s) => {
      const found = data.find((r) => String(r.StaffID ?? r.staffID) === String(s.id));
      if (found) {
        return {
          ...s,
          status:  (found.Status ?? found.status) || "present",
          inTime:  (found.CheckInTime ?? found.checkInTime) || "",
          outTime: (found.CheckOutTime ?? found.checkOutTime) || "",
          from:    (found.Platform ?? found.platform) || "ERP",
          marked: true,
          markedBy: "Admin",
          markedTime: (found.AttendanceDate ?? found.attendanceDate) || "",
          attendanceID: (found.ID ?? found.id) || 0, // update ke liye ID
        };
      }
      return { ...s, marked: false, status: "", inTime: "", outTime: "", from: "", attendanceID: 0 };
    }));

    // ✅ Check if today is marked
    if (dateStr === new Date().toISOString().slice(0, 10)) {
      setStaffTodayMarked(data.length > 0);
    }

    return data;
  } catch (error) {
    console.error("Error loading staff attendance:", error);
    return [];
  }
}, []);

// Staff calendar par koi date select → us date ki staff attendance (view-only,
// global staffData ko touch kiye bagair — marking hamesha "today" par safe rahe).
const [staffDateAttendance, setStaffDateAttendance] = useState(null); // { key, rows, loading }
const loadStaffDateAttendance = useCallback(async (dateStr) => {
  setStaffDateAttendance({ key: dateStr, rows: [], loading: true });
  const branchID = Number(sessionStorage.getItem("branchID"));
  let recs = [];
  try {
    const res = await attendanceService.staffAttendance({
      id: 0, staffID: 0, branchID, attendanceDate: dateStr,
      checkInTime: "", checkOutTime: "", status: "", platform: "",
      isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
    });
    recs = res?.data || [];
  } catch (err) {
    console.error("Error loading staff date attendance:", err);
  }
  const rows = staffData.map((s) => {
    const found = recs.find((r) => String(r.StaffID ?? r.staffID) === String(s.id));
    return {
      name: s.name, empId: s.empId, desig: s.desig,
      marked: !!found,
      status:  found ? ((found.Status ?? found.status) || "") : "",
      inTime:  found ? ((found.CheckInTime ?? found.checkInTime) || "") : "",
      outTime: found ? ((found.CheckOutTime ?? found.checkOutTime) || "") : "",
      from:    found ? ((found.Platform ?? found.platform) || "") : "",
      markedBy: found ? "Admin" : "",
    };
  });
  setStaffDateAttendance({ key: dateStr, rows, loading: false });
}, [staffData]);

/* ─── Staff report data fetchers ───────────────────────────────────────────
  Ek staff-attendance (get) call ek date ke SAARE staff ka record deta hai
  (staffID:0). Daily = us date ke against, Monthly = month ki har date par. */

// Daily: selected date ke against har employee ki status/in-out.
const fetchDailyStaffReportRows = useCallback(async (dateStr) => {
  const branchID = Number(sessionStorage.getItem("branchID"));
  let recs = [];
  try {
    const res = await attendanceService.staffAttendance({
      id: 0, staffID: 0, branchID, attendanceDate: dateStr,
      checkInTime: "", checkOutTime: "", status: "", platform: "",
      isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
    });
    recs = (res?.data || []).filter((r) =>
      String(r.AttendanceDate ?? r.attendanceDate ?? "").slice(0, 10) === dateStr);
  } catch (err) { console.error("Daily staff report fetch error:", err); }
  return (staffData || []).map((s) => {
    const found = recs.find((r) => String(r.StaffID ?? r.staffID) === String(s.id));
    return {
      empId: s.empId, name: s.name, desig: s.desig, dept: s.dept,
      marked: !!found,
      status:  found ? String((found.Status ?? found.status) || "").toLowerCase() : "",
      inTime:  found ? ((found.CheckInTime ?? found.checkInTime) || "") : "",
      outTime: found ? ((found.CheckOutTime ?? found.checkOutTime) || "") : "",
      from:    found ? ((found.Platform ?? found.platform) || "") : "",
    };
  });
}, [staffData]);

// Monthly: month ki har date (start→end) par call → per-employee aggregate
// (present/absent/leave, distinct working days, present %).
const fetchMonthlyStaffReportRows = useCallback(async (year, monthIdx0) => {
  const branchID = Number(sessionStorage.getItem("branchID"));
  const mm = String(monthIdx0 + 1).padStart(2, "0");
  const daysInMonth = new Date(year, monthIdx0 + 1, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, d) =>
    `${year}-${mm}-${String(d + 1).padStart(2, "0")}`);

  // Working days = month ke din − (weekly-off ∪ saare holidays). Overall — sab ke liye same.
  const holidayInfo = await fetchMonthHolidayInfo(year, monthIdx0);
  const workingDays = holidayInfo.workingDays;

  // Har date par ek call → us date ke saare staff records.
  const perDate = await Promise.all(dates.map(async (dateStr) => {
    try {
      const res = await attendanceService.staffAttendance({
        id: 0, staffID: 0, branchID, attendanceDate: dateStr,
        checkInTime: "", checkOutTime: "", status: "", platform: "",
        isNotificationGen: false, action: "get", createdBy: 0, modifiedBy: 0,
      });
      return { dateStr, recs: (res?.data || []).filter((r) =>
        String(r.AttendanceDate ?? r.attendanceDate ?? "").slice(0, 10) === dateStr) };
    } catch (err) { console.error("Monthly staff report fetch error:", err); return { dateStr, recs: [] }; }
  }));

  return (staffData || []).map((s) => {
    let present = 0, absent = 0, leave = 0;
    perDate.forEach(({ recs }) => {
      const found = recs.find((r) => String(r.StaffID ?? r.staffID) === String(s.id));
      if (!found) return;
      const raw = String((found.Status ?? found.status) || "").toLowerCase();
      const st = ST_CODE_TO_STATUS[raw] || raw;
      if (st === "present") present++;
      else if (st === "absent") absent++;
      else if (st === "leave") leave++;
    });
    const marks = present + absent + leave;
    return {
      empId: s.empId, name: s.name, desig: s.desig, dept: s.dept,
      workingDays, present, absent, leave,
      pct: marks > 0 ? Math.round((present / marks) * 100) : 0,
    };
  });
}, [staffData, fetchMonthHolidayInfo]);
// Attendance component mein - useEffect add karo

useEffect(() => {
  if ((tab === "staff" || tab === "reports") && staffData.length) {
    // Staff/Reports tab active (aur employees loaded) → today's attendance GET.
    const today = new Date().toISOString().slice(0, 10);
    loadStaffAttendance(today);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tab, staffData.length]);
    useEffect(() => {
      if (tab === "holidays") loadAllHolidays();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    // Student/Reports tab open (aur data ready) → saari classes ki attendance GET.
    useEffect(() => {
      if ((tab === "student" || tab === "reports") && studentData.length) loadAllStudentMarks();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, studentData.length]);

    // Yearly Holiday report picker open → classes list ready karo (class filter ke liye).
    useEffect(() => {
      if (reportPicker?.context === "holidayYearly") ensureClasses();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportPicker]);

    const requestDeleteHoliday = useCallback((id) => setDelHolId(id), []);
    const confirmDeleteHoliday = useCallback(async () => {
      const h = holidays.find((x) => x.id === delHolId);
      const branchID   = Number(sessionStorage.getItem("branchID"));
      const employeeID = Number(sessionStorage.getItem("employee_ID")) || 0;
      const sessionID  = await ensureSessionID();
      try {
        await attendanceService.monthlySetup({
          id: delHolId || 0,
          branchID,
          sessionID,
          holidayTitle: h?.title || "",
          description: h?.desc || "",
          dateFrom: h?.from || "",
          dateTo: h?.to || "",
          month: (h?.month ?? 0) + 1,
          action: "delete",
          createdBy: employeeID,
          modifiedBy: employeeID,
          classIDs: (h?.selectedClasses || []).map((c) => ({ classID: c.classID, sectionID: c.sectionID })),
        });
      } catch (err) {
        console.error("Error deleting holiday:", err);
        toast("Failed to delete holiday. Please try again.", "error");
        setDelHolId(null);
        return;
      }
      setHolidays((prev) => prev.filter((x) => x.id !== delHolId));
      setDelHolId(null);
      toast("Holiday deleted", "success");
    }, [delHolId, holidays, ensureSessionID, toast]);

    const openHolModal = useCallback((id, monthIdx) => {
      setHolModal({ id, monthIdx });
    }, []);
    // YEH CODE Attendance component ke ANDAR add karo (around line 2530)
// Attendance component mein onSaveWeeklyOff ko update karo
const onSaveWeeklyOff = useCallback(async () => {
  const branchID = Number(sessionStorage.getItem("branchID"));
  const employeeID = Number(sessionStorage.getItem("employee_ID"));

  console.log("Weekly Off Days to save:", weeklyOff);

  // Pehle fetch karo current data from API to get IDs
  try {
    const currentResponse = await attendanceService.getWeeklyOffSetup();
    const currentData = currentResponse?.data || [];
    
    // Current saved days with their IDs
    const savedDaysMap = {};
    currentData.forEach(item => {
      const dayIndex = DAYS_F.indexOf(item.WeekDay);
      if (dayIndex !== -1) {
        savedDaysMap[dayIndex] = item.ID;
      }
    });

    console.log("Saved days map:", savedDaysMap);
    console.log("Selected days (weeklyOff):", weeklyOff);

    const savePromises = [];

    // 1. For days that are SELECTED but NOT in savedDaysMap → SAVE (create)
    for (const dayIndex of weeklyOff) {
      if (!savedDaysMap[dayIndex]) {
        const weekDayName = DAYS_F[dayIndex];
        const payload = {
          id: 0,
          weekDay: weekDayName,
          branchID: branchID,
          holiday: true,
          action: "save",
          createdBy: employeeID,
          createdAt: new Date().toISOString(),
          modifiedBy: employeeID,
          modifiedAt: new Date().toISOString(),
        };
        console.log(`SAVING new day: ${weekDayName}`, payload);
        savePromises.push(attendanceService.saveWeeklyOff(payload));
      }
    }

    // 2. For days that are NOT SELECTED but in savedDaysMap → DELETE
    for (const [dayIndex, id] of Object.entries(savedDaysMap)) {
      const dayIdx = parseInt(dayIndex);
      if (!weeklyOff.includes(dayIdx)) {
        const weekDayName = DAYS_F[dayIdx];
        const payload = {
          id: id, // ✅ USE THE ID FROM API RESPONSE
          weekDay: weekDayName,
          branchID: branchID,
          holiday: false,
          action: "delete",
          createdBy: employeeID,
          createdAt: new Date().toISOString(),
          modifiedBy: employeeID,
          modifiedAt: new Date().toISOString(),
        };
        console.log(`DELETING day: ${weekDayName} (ID: ${id})`, payload);
        savePromises.push(attendanceService.saveWeeklyOff(payload));
      }
    }

    if (savePromises.length === 0) {
      toast("No changes to save", "info");
      return;
    }

    const results = await Promise.all(savePromises);
    console.log("All operations completed:", results);

    // Refresh the data after save/delete
    const refreshedResponse = await attendanceService.getWeeklyOffSetup();
    const refreshedData = refreshedResponse?.data || [];
    const weekDays = refreshedData
      .map(item => {
        const index = DAYS_F.indexOf(item.WeekDay);
        return index !== -1 ? index : null;
      })
      .filter(idx => idx !== null);
    setWeeklyOff(weekDays);

    toast(`Weekly off days updated successfully`, "success");
  } catch (err) {
    console.error("Error saving weekly off days:", err);
    toast("Failed to save weekly off days. Please try again.", "error");
  }
}, [weeklyOff, toast, setWeeklyOff]);
const saveHoliday = useCallback(async (payload) => {
      const branchID   = Number(sessionStorage.getItem("branchID"));
      const employeeID = Number(sessionStorage.getItem("employee_ID")) || 0;
      const selected   = payload.selectedClasses || [];
      // Active session ID — same active-session API examination uses.
      const sessionID  = await ensureSessionID();

      const apiPayload = {
        id: payload.id || 0,
        branchID,
        sessionID,
        holidayTitle: payload.title,
        description: payload.desc,
        dateFrom: payload.from,
        dateTo: payload.to,
        month: payload.month + 1, // API expects 1-based month (Jan = 1)
        action: payload.id ? "update" : "insert",
        createdBy: employeeID,
        modifiedBy: employeeID,
        classIDs: selected.map((c) => ({ classID: c.classID, sectionID: c.sectionID })),
      };

      try {
        await attendanceService.monthlySetup(apiPayload);
      } catch (err) {
        console.error("Error saving holiday:", err);
        toast("Failed to save holiday. Please try again.", "error");
        return;
      }

      // Local display copy — keep labels for the pills + selection for re-edit.
      const display = {
        title: payload.title,
        desc: payload.desc,
        from: payload.from,
        to: payload.to,
        month: payload.month, // internal list is 0-based
        classes: selected.map((c) => c.label),
        selectedClasses: selected,
      };

      setHolidays((prev) => {
        if (payload.id) return prev.map((h) => h.id === payload.id ? { ...h, ...display } : h);
        const nextId = (prev.reduce((m, h) => Math.max(m, h.id), 0) || 0) + 1;
        return [...prev, { ...display, id: nextId }];
      });
      toast(payload.id ? "Holiday updated" : "Holiday added", "success");
      setHolModal(null);
    }, [toast, setHolidays, ensureSessionID]);

    const editingHoliday  = holModal?.id != null ? holidays.find((h) => h.id === holModal.id) : null;
    const deletingHoliday = delHolId    != null ? holidays.find((h) => h.id === delHolId)    : null;
    const dayPendingOff   = dayToggleIdx != null ? !weeklyOff.includes(dayToggleIdx) : false;

    return (
      <div style={{ fontFamily: T.font, color: T.textPrimary, background: T.bgBase, minHeight: "100%", padding: "20px 18px" }}>
        <style>{ATT_CSS}</style>
        <ToastStack toasts={toasts} />

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 13, background: `linear-gradient(135deg,${T.brandPrimary},${T.brandMid})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: T.shadowSm }}>
              <i className="fa-solid fa-calendar-check"></i>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>Attendance</div>
              <div style={{ fontSize: 13, color: T.textMuted }}>Manage holidays, student &amp; staff attendance, and generate reports</div>
            </div>
          </div>
          <Tooltip text="Play a short tutorial for the Attendance module">
            <button
              className="tutorial-btn page-tutorial-btn"
              onClick={() => setTutorialOpen(true)}
            >
              <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
              <span className="tutorial-label">Tutorial</span>
            </button>
          </Tooltip>
        </div>

        {/* Tab bar */}
        <div className="att-tabs-row">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              className={`att-tab${tab === tb.id ? " active" : ""}`}
              onClick={() => setTab(tb.id)}
            >
              <i className={`fa-solid ${tb.icon}`}></i> {tb.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {tab === "holidays" && (
          <HolidaysTab
            weeklyOff={weeklyOff}
            requestToggleDay={requestToggleDay}
            holidays={holidays}
            openHolModal={openHolModal}
            requestDeleteHoliday={requestDeleteHoliday}
            openReportPicker={openReportPicker}
            toast={toast}
                onSaveWeeklyOff={onSaveWeeklyOff}  // ← YEH ADD KARO
            onExpandMonth={loadMonthHolidays}
            loadingMonth={loadingMonth}
          />
        )}
        {tab === "student" && (
          <StudentTab
            weeklyOff={weeklyOff}
            holidays={holidays}
            studentData={studentData}
            openMarkSt={openMarkSt}
            openReportPicker={openReportPicker}
            toast={toast}
            onExpandClass={loadStudentMarks}
            teacherMap={teacherMap}
            onSelectDate={loadDateAttendance}
            dateAttendance={dateAttendance}
          />
        )}
        {tab === "staff" && (
          <StaffTab
            weeklyOff={weeklyOff}
            holidays={holidays}
            staffData={staffData}
            staffTodayMarked={staffTodayMarked}
            openMarkSf={openMarkSf}
            openReportPicker={openReportPicker}
            toast={toast}
            onExpandStaff={() => loadStaffAttendance()}
            onSelectDate={loadStaffDateAttendance}
            staffDateAttendance={staffDateAttendance}
          />
        )}
        {tab === "reports" && (
          <ReportsTab
            staffData={staffData}
            studentData={studentData}
            teacherMap={teacherMap}
            runGeneralReport={runGeneralReport}
            openIndivReport={openIndivReport}
            toast={toast}
            classOpts={["All Classes", ...Array.from(new Set(studentData.map((r) => r.cls)))]}
          />
        )}

        {/* Modals (Tab 1) */}
        {holModal && (
          <HolidayModal
            initial={editingHoliday}
            defaultMonth={holModal.monthIdx}
            onClose={() => setHolModal(null)}
            onSave={saveHoliday}
          />
        )}
        {deletingHoliday && (
          <ConfirmDialog
            title="Delete Holiday?"
            message={<>Are you sure you want to delete <strong>"{deletingHoliday.title}"</strong>? This action cannot be undone.</>}
            hint="This will remove the holiday from all attendance calendars."
            confirmLabel="Delete"
            confirmIcon="fa-solid fa-trash-can"
            confirmBg="linear-gradient(135deg,#DC2626,#B91C1C)"
            onClose={() => setDelHolId(null)}
            onConfirm={confirmDeleteHoliday}
          />
        )}
        {dayToggleIdx != null && (
          <ConfirmDialog
            iconClass={dayPendingOff ? "fa-solid fa-calendar-xmark" : "fa-solid fa-calendar-check"}
            iconBg={dayPendingOff ? "rgba(148,163,184,.15)" : "rgba(22,163,74,.1)"}
            iconColor={dayPendingOff ? "#64748B" : "#16A34A"}
            title={dayPendingOff ? "Mark as Weekly Off?" : "Mark as Working Day?"}
            message={<>Are you sure you want to mark <strong>{DAYS_F[dayToggleIdx]}</strong> as a {dayPendingOff ? "weekly off day" : "working day"}?</>}
            hintIcon="fa-solid fa-circle-info"
            hintBg="rgba(30,64,175,.06)"
            hintBorder="rgba(30,64,175,.2)"
            hintColor="#1E40AF"
            hint={dayPendingOff
              ? "This day will appear as Off in every attendance calendar."
              : "Attendance will be required for this day in every calendar."}
            confirmLabel="Confirm"
            onClose={() => setDayToggleIdx(null)}
            onConfirm={confirmToggleDay}
          />
        )}

        {/* Mark Student Attendance modal */}
        {markStIdx != null && (
          <MarkStudentModal
            classIdx={markStIdx}
            studentData={studentData}
            onClose={() => setMarkStIdx(null)}
            onSaveMarks={saveStudentMarks}
            onLoadMarks={loadStudentMarks}
          />
        )}

        {/* Mark Staff Attendance modal */}
        {markSfOpen && (
          <MarkStaffModal
            staffData={staffData}
            isUpdate={staffTodayMarked}
            onClose={() => setMarkSfOpen(false)}
            onSave={saveMarkSf}
          />
        )}

        {/* Individual Report date-picker modal */}
        {indivTarget && (
          <IndividualReportModal
            target={indivTarget}
            onClose={() => setIndivTarget(null)}
            onGenerate={runIndivReport}
          />
        )}

        {/* Report picker modal */}
        <ReportPickerModal
          open={!!reportPicker}
          title={reportPicker?.title}
          context={reportPicker?.context}
          defaultYear={reportPicker?.defaultYear}
          defaultMonth={reportPicker?.defaultMonth}
          defaultDate={reportPicker?.defaultDate}
          forClass={reportPicker?.forClass}
          forStaff={reportPicker?.forStaff}
          sessionOpts={reportSessions.map((s) => s.SessionName)}
          holidayClassOpts={["All Classes", ...classList.map((c) => c.label)]}
          studentClassOpts={["All Classes", ...Array.from(new Set(studentData.map((r) => r.cls)))]}
          studentSectionOpts={["All Sections", ...Array.from(new Set(studentData.map((r) => r.sec)))]}
          staffDeptOpts={["All Departments", ...Array.from(new Set(staffData.map((s) => s.dept).filter((d) => d && d !== "—")))]}
          onClose={() => setReportPicker(null)}
          onGenerate={generateReport}
        />

        {/* Report preview overlay */}
        <ReportPreviewOverlay
          open={!!reportPreview}
          title={reportPreview?.title || ""}
          html={reportPreview?.html || ""}
          onClose={() => setReportPreview(null)}
        />

        <TutorialModal
          open={tutorialOpen}
          moduleKey="attendance"
          onClose={() => setTutorialOpen(false)}
          toast={toast}
        />
      </div>
    );
  }

  /* (inline style helpers removed — Reports tab now uses att-* CSS classes.) */

  /* ─── Attendance module CSS (ported from HTML reference) ─────────────────── */
  const ATT_CSS = `
  .att-tabs-row { display:flex; gap:4px; background:#fff; border:1.5px solid #BFDBFE; border-radius:14px; padding:5px; margin-bottom:20px; box-shadow:0 2px 6px rgba(30,58,138,.18),0 1px 2px rgba(0,0,0,.05); overflow-x:auto; flex-wrap:nowrap; }
  .att-tab { display:flex; align-items:center; justify-content:center; gap:7px; padding:11px 18px; border-radius:10px; border:none; background:transparent; font-family:inherit; font-size:13px; font-weight:600; color:#64748B; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; flex:1; }
  .att-tab:hover:not(.active) { background:#EFF6FF; color:#0F172A; }
  .att-tab.active { background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%); color:#fff; box-shadow:0 6px 20px rgba(30,58,138,.4),inset 0 1px 0 rgba(255,255,255,.2); }
  .att-tab i { font-size:12px; }

  .att-section { background:#fff; border:1.5px solid #BFDBFE; border-radius:14px; box-shadow:0 2px 6px rgba(30,58,138,.18),0 1px 2px rgba(0,0,0,.05); overflow:hidden; margin-bottom:16px; }
  .att-section-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid #BFDBFE; background:linear-gradient(135deg,rgba(30,58,138,.03),transparent); gap:12px; flex-wrap:wrap; }
  .att-section-title { display:flex; align-items:center; gap:10px; }
  .att-section-icon { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; font-size:14px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .att-section-name { font-size:14px; font-weight:800; color:#0F172A; letter-spacing:-.01em; }
  .att-section-sub { font-size:11.5px; color:#64748B; margin-top:1px; }
  .att-section-body { padding:20px; }

  .att-info { display:flex; align-items:flex-start; gap:9px; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:10px; padding:10px 14px; margin-bottom:16px; font-size:12px; color:#1E3A5F; line-height:1.55; }
  .att-info i { color:#1E3A8A; flex-shrink:0; margin-top:1px; }

  .att-days-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:10px; margin-bottom:0; }
  .att-day-card { border:2px solid #BFDBFE; border-radius:14px; background:#fff; padding:14px 8px; text-align:center; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); user-select:none; }
  .att-day-card:hover { border-color:#93C5FD; background:#EFF6FF; }
  .att-day-card.selected { border-color:#1E40AF; background:linear-gradient(135deg,#EFF6FF,#DBEAFE); box-shadow:0 3px 12px rgba(30,58,138,.15); }
  .att-day-icon { font-size:20px; margin-bottom:6px; }
  .att-day-name { font-size:12px; font-weight:700; color:#0F172A; }
  .att-day-off { font-size:10px; color:#64748B; margin-top:3px; font-weight:600; }
  .att-day-card.selected .att-day-off { color:#1E40AF; }

  .att-select { height:40px; border:1.5px solid #BFDBFE; border-radius:10px; padding:0 36px 0 12px; font-family:inherit; font-size:13px; font-weight:600; color:#0F172A; background:#fff; outline:none; cursor:pointer; transition:all .2s; appearance:none; -webkit-appearance:none; min-width:160px; }
  .att-select:focus { border-color:#1E3A8A; box-shadow:0 0 0 3px rgba(30,58,138,.08); }
  .att-select-wrap { position:relative; }
  .att-select-arrow { position:absolute; right:11px; top:50%; transform:translateY(-50%); color:#64748B; pointer-events:none; font-size:11px; }

  .att-months-grid { display:flex; flex-direction:column; gap:10px; }
  .att-month-card { border:1.5px solid #BFDBFE; border-radius:14px; background:#fff; overflow:hidden; transition:all .2s; }
  .att-month-card:hover { border-color:#93C5FD; box-shadow:0 1px 2px rgba(0,0,0,.06); }
  .att-month-header { display:flex; align-items:center; justify-content:space-between; padding:14px 18px; cursor:pointer; gap:12px; }
  .att-month-left { display:flex; align-items:center; gap:12px; }
  .att-month-dot { width:10px; height:10px; border-radius:50%; flex-shrink:0; }
  .att-month-name { font-size:14px; font-weight:700; color:#0F172A; }
  .att-month-count { font-size:11.5px; color:#64748B; margin-top:1px; }
  .att-month-actions { display:flex; align-items:center; gap:8px; }
  .att-add-holiday-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:9999px; border:1.5px solid rgba(30,64,175,.25); background:rgba(30,64,175,.06); color:#1E40AF; font-family:inherit; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s; white-space:nowrap; }
  .att-add-holiday-btn:hover { background:rgba(30,64,175,.12); border-color:#1E40AF; }
  .att-chevron-btn { width:30px; height:30px; border-radius:8px; border:1.5px solid #BFDBFE; background:#fff; color:#64748B; display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer; transition:transform .2s,border-color .2s,color .2s; }
  .att-chevron-btn:hover { border-color:#1E40AF; color:#1E40AF; }
  .att-chevron-btn.open { transform:rotate(180deg); border-color:#1E40AF; color:#1E40AF; }

  .att-holiday-list { border-top:1px solid #BFDBFE; background:#EFF6FF; padding:8px 18px 12px; display:none; }
  .att-holiday-list.open { display:block; }
  .att-holiday-row { display:grid; grid-template-columns:1fr 110px 110px minmax(150px,1fr) 36px 36px; gap:10px; align-items:center; padding:10px 12px; background:#fff; border:1px solid #BFDBFE; border-radius:10px; margin-bottom:8px; transition:all .2s; }
  .att-holiday-row:last-child { margin-bottom:0; }
  .att-holiday-row:hover { border-color:#93C5FD; box-shadow:0 1px 2px rgba(0,0,0,.06); }
  .att-holiday-title { font-size:13px; font-weight:700; color:#0F172A; }
  .att-holiday-desc { font-size:11px; color:#64748B; margin-top:2px; }
  .att-holiday-date { font-size:12px; color:#1E3A5F; font-weight:600; }
  .att-holiday-class-pill { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border-radius:9999px; background:#DBEAFE; color:#1E3A8A; font-size:10.5px; font-weight:600; border:1px solid #93C5FD; }

  .att-icon-btn { width:30px; height:30px; border-radius:8px; border:1.5px solid #BFDBFE; background:#fff; color:#64748B; display:flex; align-items:center; justify-content:center; font-size:11px; cursor:pointer; transition:all .2s; }
  .att-icon-btn:hover { border-color:#1E40AF; color:#1E40AF; background:rgba(30,64,175,.05); }
  .att-icon-btn.del:hover { border-color:#DC2626; color:#DC2626; background:rgba(220,38,38,.05); }

  .att-btn-save-small { display:inline-flex; align-items:center; gap:5px; padding:8px 20px; border-radius:9999px; border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; font-family:inherit; font-size:12.5px; font-weight:700; cursor:pointer; transition:all .2s; }
  .att-btn-save-small:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(30,58,138,.3); }
  .att-btn-report { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:9999px; border:1.5px solid rgba(220,38,38,.25); background:rgba(220,38,38,.06); color:#DC2626; font-family:inherit; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s; white-space:nowrap; }
  .att-btn-report:hover { background:rgba(220,38,38,.12); border-color:#DC2626; }
  .att-btn-primary { display:inline-flex; align-items:center; gap:7px; padding:10px 24px; border-radius:9999px; border:none; background:linear-gradient(135deg,#1E3A8A,#1E40AF); color:#fff; font-family:inherit; font-size:13.5px; font-weight:700; cursor:pointer; transition:all .2s; box-shadow:0 4px 14px rgba(30,58,138,.28); }
  .att-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 22px rgba(30,58,138,.38); }
  .att-btn-secondary { display:inline-flex; align-items:center; gap:7px; padding:10px 20px; border-radius:9999px; border:1.5px solid #BFDBFE; background:#fff; color:#1E3A5F; font-family:inherit; font-size:13.5px; font-weight:600; cursor:pointer; transition:all .2s; }
  .att-btn-secondary:hover { border-color:#93C5FD; color:#0F172A; }

  /* Overlays + modals */
  .att-overlay { position:fixed; inset:0; background:rgba(10,22,40,.55); backdrop-filter:blur(5px); z-index:1000; display:none; align-items:center; justify-content:center; padding:16px; }
  .att-overlay.open { display:flex; }
  .att-modal { background:#fff; border-radius:16px; width:100%; max-width:640px; max-height:90vh; overflow-y:auto; box-shadow:0 30px 80px rgba(0,0,0,.22),0 8px 24px rgba(0,0,0,.1); border:1px solid #BFDBFE; animation:attModalIn .28s cubic-bezier(.34,1.26,.64,1) both; }
  .att-modal-lg { max-width:820px; }
  @keyframes attModalIn { from { opacity:0; transform:scale(.92) translateY(20px); } to { opacity:1; transform:none; } }
  .att-modal-header { display:flex; align-items:flex-start; justify-content:space-between; padding:20px 24px 16px; border-bottom:1px solid #BFDBFE; background:linear-gradient(135deg,rgba(30,58,138,.04),transparent); }
  .att-modal-header-left { display:flex; align-items:center; gap:12px; }
  .att-modal-header-icon { width:40px; height:40px; border-radius:11px; background:linear-gradient(135deg,rgba(30,58,138,.15),rgba(30,58,138,.25)); color:#1E40AF; font-size:17px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .att-modal-title { font-size:16px; font-weight:800; color:#1E40AF; letter-spacing:-.02em; }
  .att-modal-sub { font-size:12px; color:#64748B; margin-top:2px; }
  .att-modal-close { width:30px; height:30px; border-radius:8px; border:none; background:#EFF6FF; color:#64748B; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; transition:all .2s; flex-shrink:0; }
  .att-modal-close:hover { background:rgba(220,38,38,.1); color:#DC2626; }
  .att-modal-body { padding:20px 24px; }
  .att-modal-footer { display:flex; gap:9px; justify-content:flex-end; padding:14px 24px; border-top:1px solid #BFDBFE; }

  .att-field-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
  .att-field-row.full { grid-template-columns:1fr; }
  .att-label { font-size:12px; font-weight:700; color:#1E3A5F; letter-spacing:.15px; display:block; margin-bottom:6px; }
  .att-input { width:100%; height:42px; border:1.5px solid #BFDBFE; border-radius:10px; padding:0 12px; font-family:inherit; font-size:13.5px; color:#0F172A; background:#fff; outline:none; transition:all .2s; box-sizing:border-box; }
  .att-input:focus { border-color:#1E3A8A; box-shadow:0 0 0 3px rgba(30,58,138,.08); }
  .att-textarea { width:100%; min-height:72px; resize:vertical; border:1.5px solid #BFDBFE; border-radius:10px; padding:10px 12px; font-family:inherit; font-size:13.5px; color:#0F172A; background:#fff; outline:none; transition:all .2s; box-sizing:border-box; }
  .att-textarea:focus { border-color:#1E3A8A; box-shadow:0 0 0 3px rgba(30,58,138,.08); }

  .att-class-select-wrap { border:1.5px solid #BFDBFE; border-radius:10px; background:#fff; min-height:42px; padding:5px 8px; display:flex; flex-wrap:wrap; gap:5px; cursor:text; transition:all .2s; }
  .att-class-select-wrap:focus-within { border-color:#1E3A8A; box-shadow:0 0 0 3px rgba(30,58,138,.08); }
  .att-class-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 9px; border-radius:9999px; background:#DBEAFE; color:#1E3A8A; font-size:11.5px; font-weight:600; border:1px solid #93C5FD; }
  .att-class-chip-x { cursor:pointer; font-size:13px; line-height:1; }
  .att-class-chip-x:hover { color:#DC2626; }
  .att-radio-btn { padding:5px 12px; border-radius:9999px; border:1.5px solid #BFDBFE; background:#fff; font-family:inherit; font-size:11.5px; font-weight:600; color:#64748B; cursor:pointer; transition:all .2s; }
  .att-radio-btn:hover { border-color:#93C5FD; }
  .att-radio-btn.p.active { border-color:#16A34A; background:rgba(22,163,74,.1); color:#16A34A; }
  .att-radio-btn.a.active { border-color:#DC2626; background:rgba(220,38,38,.1); color:#DC2626; }
  .att-radio-btn.l.active { border-color:#D97706; background:rgba(217,119,6,.1); color:#D97706; }

  .att-confirm { background:#fff; border-radius:16px; width:100%; max-width:420px; box-shadow:0 30px 80px rgba(0,0,0,.22),0 8px 24px rgba(0,0,0,.1); border:1px solid #BFDBFE; padding:28px; animation:attModalIn .25s cubic-bezier(.34,1.26,.64,1) both; text-align:center; }
  .att-confirm-icon { width:52px; height:52px; border-radius:50%; font-size:22px; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; }
  .att-confirm-title { font-size:18px; font-weight:800; color:#0F172A; margin-bottom:8px; }
  .att-confirm-msg { font-size:13.5px; color:#64748B; margin-bottom:20px; line-height:1.55; }
  .att-confirm-hint { border-radius:10px; padding:10px 14px; margin-bottom:20px; font-size:12px; display:flex; align-items:center; gap:8px; text-align:left; border:1px solid; }
  .att-confirm-btns { display:flex; gap:10px; justify-content:center; }

  /* Student attendance — class table */
  .att-table-head { display:grid; background:#EFF6FF; border-bottom:1px solid #BFDBFE; padding:0 18px; }
  .att-th { padding:10px 8px; font-size:10.5px; font-weight:700; color:#64748B; letter-spacing:.6px; text-transform:uppercase; }
  .att-st-row { grid-template-columns:48px 1fr 160px 110px 110px 60px 60px 60px 180px 46px; }
  .att-sf-row { grid-template-columns:48px 1fr 150px 130px 110px 110px 110px 46px; }
  .att-row-wrap { border-bottom:1px solid #BFDBFE; }
  .att-row-wrap:last-child { border-bottom:none; }
  .att-row { display:grid; align-items:center; min-height:54px; padding:0 18px; transition:background .2s; }
  .att-row:hover { background:rgba(30,58,138,.03); }
  .att-td { padding:10px 8px; font-size:13px; color:#1E3A5F; display:flex; align-items:center; }
  .att-td.att-td-name { font-weight:700; color:#0F172A; gap:8px; }
  .att-row-icon { width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg,rgba(30,58,138,.1),rgba(30,58,138,.18)); color:#1E40AF; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0; }

  .att-status-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:9999px; font-size:10.5px; font-weight:700; }
  .att-status-badge.marked  { background:rgba(22,163,74,.1);  color:#16A34A; border:1px solid rgba(22,163,74,.25); }
  .att-status-badge.pending { background:rgba(220,38,38,.08); color:#DC2626; border:1px solid rgba(220,38,38,.2); }
  .att-status-badge.off     { background:rgba(100,116,139,.1);color:#64748B; border:1px solid rgba(100,116,139,.2); }

  .att-mark-btn-primary { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:9999px; border:none; background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 50%,#2563EB 100%); color:#fff; font-family:inherit; font-size:11.5px; font-weight:700; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; box-shadow:0 2px 10px rgba(37,99,235,.3); position:relative; overflow:hidden; }
  .att-mark-btn-primary::after { content:""; position:absolute; top:-50%; left:-60%; width:40%; height:200%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent); transform:skewX(-20deg); transition:left .5s ease; }
  .att-mark-btn-primary:hover::after { left:120%; }
  .att-mark-btn-primary:hover { box-shadow:0 4px 18px rgba(37,99,235,.45); transform:translateY(-2px) scale(1.02); }
  .att-mark-btn-primary.update-mode { background:linear-gradient(135deg,#065f46 0%,#059669 50%,#047857 100%); box-shadow:0 2px 10px rgba(5,150,105,.3); }
  .att-mark-btn-primary.update-mode:hover { box-shadow:0 4px 18px rgba(5,150,105,.45); }

  /* Expandable detail panel */
  .att-detail { background:#EFF6FF; border-top:1px solid #BFDBFE; max-height:0; overflow:hidden; transition:max-height .35s cubic-bezier(.4,0,.2,1); }
  .att-detail.open { max-height:700px; }
  .att-detail-inner { padding:14px 20px 16px; }
  .att-student-table { width:100%; border-collapse:collapse; font-size:12.5px; }
  .att-student-table th { padding:9px 10px; text-align:left; font-size:10px; font-weight:700; color:#64748B; letter-spacing:.5px; text-transform:uppercase; border-bottom:1.5px solid #BFDBFE; background:#EFF6FF; }
  .att-student-table td { padding:10px 10px; border-bottom:1px solid #BFDBFE; color:#0F172A; font-size:12.5px; vertical-align:middle; }
  .att-student-table tr:last-child td { border-bottom:none; }
  .att-student-table tr:hover td { background:rgba(30,58,138,.02); }
  .att-present-badge { display:inline-block; padding:2px 9px; border-radius:9999px; font-size:10.5px; font-weight:700; background:rgba(22,163,74,.1);  color:#16A34A; border:1px solid rgba(22,163,74,.25); }
  .att-absent-badge  { display:inline-block; padding:2px 9px; border-radius:9999px; font-size:10.5px; font-weight:700; background:rgba(220,38,38,.1); color:#DC2626; border:1px solid rgba(220,38,38,.25); }
  .att-leave-badge   { display:inline-block; padding:2px 9px; border-radius:9999px; font-size:10.5px; font-weight:700; background:rgba(217,119,6,.1); color:#D97706; border:1px solid rgba(217,119,6,.25); }
  .att-late-badge    { display:inline-block; padding:2px 9px; border-radius:9999px; font-size:10.5px; font-weight:700; background:rgba(124,58,237,.1); color:#7C3AED; border:1px solid rgba(124,58,237,.25); }

  /* Mark Attendance modal table */
  .att-mark-table { width:100%; border-collapse:collapse; font-size:12.5px; }
  .att-mark-table th { padding:9px 10px; text-align:left; font-size:10px; font-weight:700; color:#64748B; letter-spacing:.5px; text-transform:uppercase; border-bottom:1.5px solid #BFDBFE; background:#EFF6FF; }
  .att-mark-table td { padding:8px 10px; border-bottom:1px solid #BFDBFE; vertical-align:middle; }
  .att-mark-table tr:last-child td { border-bottom:none; }
  .att-mark-table tr:hover td { background:rgba(30,58,138,.02); }
  .att-radio-group { display:flex; gap:4px; }
  .att-update-notice { background:rgba(217,119,6,.08); border:1.5px solid rgba(217,119,6,.25); color:#92400E; border-radius:10px; padding:11px 14px; margin-bottom:14px; display:flex; align-items:flex-start; gap:10px; font-size:12.5px; line-height:1.5; }
  .att-update-notice i { color:#D97706; font-size:15px; flex-shrink:0; margin-top:1px; }

  /* Calendar (used by student + staff tabs) */
  .att-cal-outer { display:grid; gap:6px; }
  .att-cal-legend { display:flex; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
  .att-legend-item { display:flex; align-items:center; gap:5px; font-size:11.5px; color:#64748B; font-weight:600; }
  .att-legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }

  /* Stat row inside selected-date panel */
  .att-stat-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .att-stat-card { background:#fff; border:1.5px solid #BFDBFE; border-radius:14px; padding:14px 16px; text-align:center; box-shadow:0 1px 2px rgba(0,0,0,.06); }
  .att-stat-num { font-size:24px; font-weight:800; letter-spacing:-.02em; }
  .att-stat-lbl { font-size:10.5px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:.5px; margin-top:4px; }

  /* Search combobox (Individual Reports) */
  .att-search-wrap { position:relative; flex:0 1 360px; min-width:240px; }
  .att-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#64748B; font-size:12px; pointer-events:none; z-index:2; }
  .att-search-input { width:100%; height:38px; padding:0 32px 0 34px; border:1.5px solid #BFDBFE; border-radius:9999px; font-family:inherit; font-size:12.5px; color:#0F172A; background:#fff; outline:none; transition:all .2s; box-sizing:border-box; }
  .att-search-input:focus { border-color:#1E3A8A; box-shadow:0 0 0 3px rgba(30,58,138,.08); }
  .att-search-input::placeholder { color:#94A3B8; }
  .att-search-clear { position:absolute; right:6px; top:50%; transform:translateY(-50%); width:24px; height:24px; border-radius:50%; border:none; background:#EFF6FF; color:#64748B; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:10px; transition:all .15s; z-index:2; }
  .att-search-clear:hover { background:rgba(220,38,38,.1); color:#DC2626; }

  /* Dropdown */
  .att-search-dropdown {
    position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:20;
    background:#fff; border:1.5px solid #BFDBFE; border-radius:12px;
    box-shadow:0 12px 32px rgba(15,23,42,.12), 0 4px 12px rgba(0,0,0,.06);
    max-height:340px; overflow-y:auto;
    animation:attDropdownIn .18s cubic-bezier(.34,1.26,.64,1) both;
    padding:6px;
  }
  @keyframes attDropdownIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
  .att-search-item {
    display:flex; align-items:center; gap:10px; width:100%;
    padding:8px 10px; border:none; border-radius:8px;
    background:transparent; cursor:pointer; text-align:left;
    font-family:inherit; transition:background .12s;
  }
  .att-search-item + .att-search-item { margin-top:2px; }
  .att-search-item:hover, .att-search-item:focus { background:#EFF6FF; outline:none; }
  .att-search-item-icon { width:30px; height:30px; border-radius:8px; color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; flex-shrink:0; }
  .att-search-item-name { font-size:13px; font-weight:700; color:#0F172A; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .att-search-item-sub  { font-size:10.5px; color:#64748B; font-weight:600; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .att-search-item-arrow { color:#94A3B8; font-size:11px; transition:transform .15s,color .15s; flex-shrink:0; }
  .att-search-item:hover .att-search-item-arrow { color:#1E40AF; transform:translateX(2px); }
  .att-search-empty { padding:14px 12px; font-size:12.5px; color:#64748B; text-align:center; font-style:italic; }

  /* Row highlight after picking from dropdown */
  @keyframes attRowHighlight {
    0%, 100% { background:transparent; }
    20%, 70% { background:rgba(30,64,175,.12); }
  }
  .att-row-highlight,
  .att-row-wrap.att-row-highlight > .att-row {
    animation:attRowHighlight 2s ease both;
  }
  tr.att-row-highlight td { animation:attRowHighlight 2s ease both; }

  @media (max-width:600px) {
    .att-search-wrap { flex:1 1 100%; }
  }

  /* Reports tab — sub-tab pills */
  .res-sub-tabs { display:flex; gap:4px; background:#fff; border:1.5px solid #BFDBFE; border-radius:14px; padding:5px; margin-bottom:20px; box-shadow:0 2px 6px rgba(30,58,138,.18),0 1px 2px rgba(0,0,0,.05); overflow-x:auto; flex-wrap:nowrap; }
  .res-sub-tab { display:flex; flex:1; align-items:center; justify-content:center; padding:11px 18px; border-radius:10px; border:none; background:transparent; font-family:inherit; font-size:13px; font-weight:700; color:#64748B; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; }
  .res-sub-tab:hover:not(.active) { background:#EFF6FF; color:#0F172A; }
  .res-sub-tab.active { background:linear-gradient(135deg,#1E3A8A 0%,#1E40AF 60%,#2563EB 100%); color:#fff; box-shadow:0 6px 20px rgba(30,58,138,.4),inset 0 1px 0 rgba(255,255,255,.2); }

  /* Reports tab — General Reports grid */
  .rpt-grp-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
  @media (max-width:768px) { .rpt-grp-grid { grid-template-columns:1fr; } }

  .grp-card { background:#fff; border:1.5px solid #BFDBFE; border-radius:14px; padding:0; transition:all .2s; box-shadow:0 1px 2px rgba(0,0,0,.06); overflow:hidden; }
  .grp-card:hover { border-color:#93C5FD; box-shadow:0 2px 6px rgba(30,58,138,.18); }
  .grp-card-header { display:flex; align-items:center; gap:14px; padding:16px 18px; }
  .grp-card-icon { width:42px; height:42px; border-radius:11px; display:flex; align-items:center; justify-content:center; font-size:18px; color:#fff; flex-shrink:0; }
  .grp-card-info { flex:1; min-width:0; }
  .grp-card-title { font-size:14px; font-weight:800; color:#0F172A; margin-bottom:2px; }
  .grp-card-sub { font-size:11.5px; color:#64748B; font-weight:500; line-height:1.4; }
  .grp-card-meta { display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .grp-card-count { font-size:11px; font-weight:700; color:#64748B; background:#EFF6FF; border:1.5px solid #BFDBFE; border-radius:9999px; padding:2px 10px; white-space:nowrap; }
  .grp-view-btn { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:10px; border:1.5px solid #BFDBFE; background:#EFF6FF; color:#1E3A5F; font-family:inherit; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s; white-space:nowrap; }
  .grp-view-btn:hover { background:#fff; border-color:#93C5FD; color:#0F172A; }
  .grp-view-btn .grp-chev { transition:transform .3s cubic-bezier(.4,0,.2,1); }
  .grp-view-btn.open .grp-chev { transform:rotate(180deg); }

  .grp-card-body { max-height:0; overflow:hidden; transition:max-height .38s cubic-bezier(.4,0,.2,1); }
  .grp-card-body.open { max-height:1200px; }
  .grp-card-body-inner { padding:0 18px 18px; display:flex; flex-direction:column; gap:10px; border-top:1.5px solid #BFDBFE; padding-top:14px; }
  .grp-rpt-row { display:flex; flex-direction:column; gap:8px; padding:11px 13px; background:#EFF6FF; border:1.5px solid #BFDBFE; border-radius:10px; }
  .grp-rpt-row-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
  .grp-rpt-row-label { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800; color:#0F172A; }
  .grp-rpt-row-filters { display:flex; align-items:flex-end; gap:8px; flex-wrap:wrap; }
  .grp-rpt-field { display:flex; flex-direction:column; gap:3px; flex:1; min-width:120px; }
  .grp-rpt-field-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748B; }
  .grp-rpt-field .att-input, .grp-rpt-field .att-select { height:34px; font-size:12px; width:100%; }
  .grp-gen-btn { display:flex; align-items:center; gap:6px; padding:0 14px; height:34px; border-radius:10px; border:none; color:#fff; font-family:inherit; font-size:12px; font-weight:700; cursor:pointer; transition:all .2s; white-space:nowrap; flex-shrink:0; align-self:flex-end; }
  .grp-gen-btn:hover { opacity:.88; transform:translateY(-1px); }

  /* Individual report row grids */
  .att-rpt-cls-row { grid-template-columns:48px 1fr 160px 130px 110px 70px; }
  .att-rpt-sf-row  { grid-template-columns:48px 1fr 150px 130px 130px 100px; }
  .att-rpt-cls-name { gap:8px; }
  .att-rpt-sf-name  { gap:8px; }
  .att-rpt-cls-chev .att-chevron-btn { width:32px; height:32px; }

  @media (max-width:768px) {
    .att-rpt-cls-row { grid-template-columns:40px 1fr 100px 80px 80px 46px; }
    .att-rpt-sf-row  { grid-template-columns:40px 1fr 110px 90px 110px 80px; }
  }
  @media (max-width:600px) {
    .att-rpt-cls-row,
    .att-rpt-sf-row  { grid-template-columns:1fr !important; }
    .res-sub-tab { font-size:12px; padding:9px 12px; }
  }

  /* Report Picker modal */
  .att-rpt-picker { background:#fff; border-radius:16px; width:100%; max-width:480px; box-shadow:0 30px 80px rgba(0,0,0,.22),0 8px 24px rgba(0,0,0,.1); border:1px solid #BFDBFE; overflow:hidden; animation:attModalIn .28s cubic-bezier(.34,1.26,.64,1) both; }
  .att-rpt-header { display:flex; align-items:center; justify-content:space-between; padding:20px 22px 16px; border-bottom:1px solid #BFDBFE; background:linear-gradient(135deg,rgba(30,58,138,.04),transparent); position:sticky; top:0; z-index:2; }
  .att-rpt-title { font-size:17px; font-weight:800; color:#0F172A; }
  .att-rpt-sub { font-size:12px; color:#64748B; margin-top:2px; }
  .att-rpt-close { width:30px; height:30px; border-radius:8px; border:none; background:#EFF6FF; color:#64748B; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:13px; transition:all .2s; }
  .att-rpt-close:hover { background:rgba(220,38,38,.1); color:#DC2626; }
  .att-rpt-body { padding:18px 22px; }
  .att-rpt-section-lbl { font-size:10.5px; font-weight:800; letter-spacing:1.2px; text-transform:uppercase; color:#64748B; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
  .att-rpt-section-lbl::after { content:''; flex:1; height:1.5px; background:#BFDBFE; }
  .att-rpt-type-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .att-rpt-fmt { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; border:2px solid #BFDBFE; background:#EFF6FF; cursor:pointer; transition:all .2s; }
  .att-rpt-fmt:hover { border-color:#93C5FD; }
  .att-rpt-fmt.selected { border-color:#1E40AF; background:rgba(30,64,175,.06); }
  .att-rpt-fmt-icon { font-size:18px; width:36px; height:36px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .att-rpt-fmt-name { font-size:13px; font-weight:700; color:#0F172A; }
  .att-rpt-fmt-desc { font-size:11px; color:#64748B; }
  .att-rpt-filter-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px; }
  .att-rpt-filter-field { position:relative; flex:1; min-width:140px; }
  .att-rpt-filter-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#64748B; margin-bottom:5px; }
  .att-rpt-filter-field .att-select-arrow { right:10px; top:auto; bottom:13px; transform:none; }
  .att-rpt-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px; }
  .att-rpt-card { border:2px solid #BFDBFE; border-radius:14px; overflow:hidden; cursor:pointer; transition:all .2s; background:#fff; }
  .att-rpt-card:hover { border-color:#93C5FD; transform:translateY(-2px); box-shadow:0 6px 18px rgba(30,64,175,.1); }
  .att-rpt-card.selected { border-color:#1E40AF; box-shadow:0 0 0 3px rgba(30,64,175,.1); }
  .att-rpt-preview-color { height:90px; background:linear-gradient(145deg,#1E3A8A,#1E40AF,#2563EB); display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:6px; padding:14px; }
  /* Colorless preview tile — paper-white look matches the low-ink printed output. */
  .att-rpt-preview-bw { height:90px; background:#FFFFFF; border-bottom:1px solid #E5E7EB; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:6px; padding:14px; }
  .att-rpt-mock-line { height:5px; border-radius:3px; background:rgba(255,255,255,.85); }
  .att-rpt-mock-line2 { height:4px; border-radius:3px; background:rgba(255,255,255,.45); }
  .att-rpt-preview-bw .att-rpt-mock-line { background:#1F2937; }
  .att-rpt-preview-bw .att-rpt-mock-line2 { background:#9CA3AF; }
  [data-theme="dark"] .att-rpt-preview-bw { background:#F8FAFC; border-bottom-color:#CBD5E1; }
  [data-theme="dark"] .att-rpt-preview-bw .att-rpt-mock-line { background:#1F2937; }
  [data-theme="dark"] .att-rpt-preview-bw .att-rpt-mock-line2 { background:#94A3B8; }
  /* Keyboard focus ring on radio-style report cards */
  .att-rpt-card:focus-visible { outline:none; border-color:#1E40AF; box-shadow:0 0 0 3px rgba(30,64,175,.22); }
  [data-theme="dark"] .att-rpt-card:focus-visible { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.32); }
  .att-rpt-card-text { padding:10px 14px 12px; }
  .att-rpt-card-name { font-size:13.5px; font-weight:800; color:#0F172A; margin-bottom:3px; }
  .att-rpt-card-desc { font-size:11px; color:#64748B; line-height:1.4; }
  .att-rpt-footer { display:flex; gap:8px; justify-content:flex-end; padding:14px 22px; border-top:1px solid #BFDBFE; position:sticky; bottom:0; background:#fff; }

  @media (max-width:768px) {
    .att-tabs-row { overflow-x:auto; flex-wrap:nowrap; -webkit-overflow-scrolling:touch; }
    .att-tab { font-size:12px; padding:9px 12px; flex-shrink:0; flex:unset; }
    .att-holiday-row { grid-template-columns:1fr 90px 90px 100px 32px 32px; gap:6px; }
    .att-rpt-type-grid { grid-template-columns:1fr; }
    /* Class/Staff roster rows — drop low-priority cols (P/A/L tallies + chev)
      so the 10/8-col grid doesn't burst on tablets. */
    .att-st-row { grid-template-columns:40px 1fr 110px 80px 150px !important; }
    .att-sf-row { grid-template-columns:40px 1fr 100px 110px 60px !important; }
    .att-st-row > :nth-child(3),
    .att-st-row > :nth-child(6),
    .att-st-row > :nth-child(7),
    .att-st-row > :nth-child(8),
    .att-st-row > :nth-child(10) { display:none; }
    .att-sf-row > :nth-child(4),
    .att-sf-row > :nth-child(6),
    .att-sf-row > :nth-child(7) { display:none; }
  }
  @media (max-width:600px) {
    .att-days-grid { grid-template-columns:repeat(4,1fr); }
    .att-holiday-row { grid-template-columns:1fr; }
    .att-rpt-grid { grid-template-columns:1fr; }
    /* Phone: reduce to 4 visible cols on roster rows */
    .att-st-row { grid-template-columns:34px 1fr 70px 110px !important; }
    .att-st-row > :nth-child(4) { display:none; }
    /* Staff Attendance row — keep [#] [name+icon+empId] left, chevron pinned far right.
      Drop the leftover middle column so the chev doesn't land mid-row. */
    .att-sf-row {
      grid-template-columns: 34px 1fr auto !important;
      column-gap: 8px !important;
    }
    .att-sf-row > :nth-child(3),
    .att-sf-row > :nth-child(5) { display:none; }
    .att-sf-row > .att-sf-chev { justify-self: end !important; }
    /* Modals/report-picker get a bit more room on phones */
    .att-overlay { padding:8px; }
    .att-modal, .att-modal-lg, .att-rpt-picker { max-width:96vw !important; max-height:95dvh !important; }
  }

  /* ═══════════════════════════════════════════════════════════════════
    MOBILE — Individual Reports class row (≤ 600px)
    Replace the 1fr-stacks-everything rule with a compact 2-line card:
      Row 1 :  [#]  [icon] Class · Section                          [⌄]
      Row 2 :  Class Teacher · 32 students · 82%
    All six fields stay visible, no horizontal scroll, no overflow.
    Table header is hidden on mobile (card-style layout doesn't need it).
    ═══════════════════════════════════════════════════════════════════ */
  @media (max-width: 600px) {
    /* Header row not meaningful in card layout */
    .att-table-head.att-rpt-cls-row { display: none !important; }

    /* Switch from grid to flex-wrap; cancel the earlier 1fr rule */
    .att-row.att-rpt-cls-row {
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      column-gap: 8px !important;
      row-gap: 4px !important;
      padding: 10px 12px !important;
      min-height: 0 !important;
      grid-template-columns: none !important;
    }

    /* Row 1 — # · class+section · chev */
    .att-row.att-rpt-cls-row > .att-rpt-cls-num {
      flex: 0 0 auto !important;
      order: 1 !important;
      font-size: 12px !important;
      font-weight: 700 !important;
    }
    .att-row.att-rpt-cls-row > .att-rpt-cls-name {
      flex: 1 1 auto !important;
      order: 2 !important;
      min-width: 0 !important;
    }
    .att-row.att-rpt-cls-row > .att-rpt-cls-chev {
      flex: 0 0 auto !important;
      order: 3 !important;
      margin-left: auto !important;
      justify-self: end !important;
      text-align: right !important;
    }

    /* Force a wrap break after Row 1 (orders 1–3) so meta items land on Row 2 */
    .att-row.att-rpt-cls-row::after {
      content: "";
      flex: 1 1 100%;
      height: 0;
      order: 3.5;
    }

    /* Row 2 — meta line: teacher · students · % */
    .att-row.att-rpt-cls-row > .att-rpt-cls-teacher {
      flex: 1 1 0 !important;
      order: 4 !important;
      font-size: 11.5px !important;
      line-height: 1.35 !important;
      color: var(--text-muted, #64748B) !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      min-width: 0 !important;
      padding-right: 6px !important;
    }
    .att-row.att-rpt-cls-row > .att-rpt-cls-total {
      flex: 0 0 auto !important;
      order: 5 !important;
      font-size: 11.5px !important;
      color: var(--text-muted, #64748B) !important;
      white-space: nowrap !important;
    }
    .att-row.att-rpt-cls-row > .att-rpt-cls-total::before {
      content: "·";
      margin-right: 6px;
      color: var(--text-muted, #94A3B8);
    }
    .att-row.att-rpt-cls-row > .att-rpt-cls-pct {
      flex: 0 0 auto !important;
      order: 6 !important;
      font-size: 12.5px !important;
      margin-left: auto !important;
      white-space: nowrap !important;
    }

    /* Class+Section block tightens — icon + name + section in one tidy stack */
    .att-row.att-rpt-cls-row > .att-rpt-cls-name { gap: 8px !important; }

    /* Empty divs from removed text wrappers should never reserve space */
    .att-row.att-rpt-cls-row > div:empty { display: none !important; }
  }

  /* ═══════════════════════════════════════════════════════════════════
    DARK MODE — overrides for every att-* surface that hardcodes light
    colours in the rules above. We keep the brand-gradient elements
    (sidebar tab active state, mark CTAs, modal headers) intact so the
    visual identity stays consistent across themes.
    ═══════════════════════════════════════════════════════════════════ */

  /* Tab bar */
  [data-theme="dark"] .att-tabs-row { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-sm); }
  [data-theme="dark"] .att-tab { color:var(--text-muted); }
  [data-theme="dark"] .att-tab:hover:not(.active) { background:var(--bg-muted); color:var(--text-primary); }

  /* Sections */
  [data-theme="dark"] .att-section { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-sm); }
  [data-theme="dark"] .att-section-header { border-bottom-color:var(--border-light); background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); }
  [data-theme="dark"] .att-section-name { color:var(--text-primary); }
  [data-theme="dark"] .att-section-sub { color:var(--text-muted); }

  /* Info banner */
  [data-theme="dark"] .att-info { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-secondary); }
  [data-theme="dark"] .att-info i { color:#93C5FD; }

  /* Weekly off day cards */
  [data-theme="dark"] .att-day-card { background:var(--bg-card); border-color:var(--border-light); }
  [data-theme="dark"] .att-day-card:hover { border-color:var(--border-med); background:var(--bg-muted); }
  [data-theme="dark"] .att-day-card.selected { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.10)); border-color:#3B82F6; }
  [data-theme="dark"] .att-day-name { color:var(--text-primary); }
  [data-theme="dark"] .att-day-off { color:var(--text-muted); }
  [data-theme="dark"] .att-day-card.selected .att-day-off { color:#93C5FD; }

  /* Selects */
  [data-theme="dark"] .att-select { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
  [data-theme="dark"] .att-select:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
  [data-theme="dark"] .att-select-arrow { color:var(--text-muted); }

  /* Month cards */
  [data-theme="dark"] .att-month-card { background:var(--bg-card); border-color:var(--border-light); }
  [data-theme="dark"] .att-month-card:hover { border-color:var(--border-med); }
  [data-theme="dark"] .att-month-name { color:var(--text-primary); }
  [data-theme="dark"] .att-month-count { color:var(--text-muted); }

  /* Holiday rows */
  [data-theme="dark"] .att-holiday-list { background:var(--bg-muted); border-top-color:var(--border-light); }
  [data-theme="dark"] .att-holiday-row { background:var(--bg-card); border-color:var(--border-light); }
  [data-theme="dark"] .att-holiday-title { color:var(--text-primary); }
  [data-theme="dark"] .att-holiday-desc { color:var(--text-muted); }
  [data-theme="dark"] .att-holiday-date { color:var(--text-secondary); }
  [data-theme="dark"] .att-holiday-class-pill { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.2); }

  /* Icon buttons */
  [data-theme="dark"] .att-icon-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
  [data-theme="dark"] .att-icon-btn:hover { border-color:#3B82F6; color:#93C5FD; background:rgba(59,130,246,.08); }
  [data-theme="dark"] .att-icon-btn.del:hover { border-color:var(--error); color:#FCA5A5; background:rgba(220,38,38,.1); }

  /* Chevron buttons */
  [data-theme="dark"] .att-chevron-btn { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-muted); }
  [data-theme="dark"] .att-chevron-btn:hover { background:var(--bg-card); color:var(--text-primary); }

  /* Tables (student + staff) */
  [data-theme="dark"] .att-table-head { background:var(--bg-muted); border-bottom-color:var(--border-light); }
  [data-theme="dark"] .att-th { color:var(--text-muted); }
  [data-theme="dark"] .att-row { background:var(--bg-card); border-color:var(--border-light); }
  [data-theme="dark"] .att-row:hover { background:var(--bg-muted); }
  [data-theme="dark"] .att-td { color:var(--text-primary); }
  [data-theme="dark"] .att-detail { background:var(--bg-muted); border-top-color:var(--border-light); }
  [data-theme="dark"] .att-detail-inner { color:var(--text-primary); }
  [data-theme="dark"] .att-student-table th { background:var(--bg-muted); color:var(--text-muted); border-bottom-color:var(--border-light); }
  [data-theme="dark"] .att-student-table td { border-bottom-color:var(--border-light); color:var(--text-primary); }

  /* Status badges */
  [data-theme="dark"] .att-status-badge.marked { background:rgba(34,197,94,.15); color:#86EFAC; border-color:rgba(34,197,94,.3); }
  [data-theme="dark"] .att-status-badge.pending { background:rgba(217,119,6,.15); color:#FCD34D; border-color:rgba(217,119,6,.3); }
  [data-theme="dark"] .att-status-badge.off { background:rgba(124,58,237,.15); color:#C4B5FD; border-color:rgba(124,58,237,.3); }
  [data-theme="dark"] .att-present-badge { background:rgba(22,163,74,.15); color:#86EFAC; }
  [data-theme="dark"] .att-absent-badge  { background:rgba(220,38,38,.15); color:#FCA5A5; }
  [data-theme="dark"] .att-leave-badge   { background:rgba(217,119,6,.15); color:#FCD34D; }
  [data-theme="dark"] .att-late-badge    { background:rgba(124,58,237,.15); color:#C4B5FD; }

  /* Calendar */
  [data-theme="dark"] .att-cal-outer { background:var(--bg-card); border-color:var(--border-light); }
  [data-theme="dark"] .att-cal-legend { background:var(--bg-muted); border-color:var(--border-light); }
  [data-theme="dark"] .att-legend-item { color:var(--text-secondary); }

  /* Buttons */
  [data-theme="dark"] .att-btn-secondary { background:var(--bg-card); border-color:var(--border-light); color:var(--text-primary); }
  [data-theme="dark"] .att-btn-secondary:hover { border-color:var(--border-med); color:var(--text-primary); background:var(--bg-muted); }
  [data-theme="dark"] .att-btn-report { background:rgba(220,38,38,.12); color:#FCA5A5; border-color:rgba(220,38,38,.3); }
  [data-theme="dark"] .att-btn-report:hover { background:rgba(220,38,38,.18); border-color:var(--error); }
  [data-theme="dark"] .att-add-holiday-btn { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
  [data-theme="dark"] .att-add-holiday-btn:hover { background:rgba(59,130,246,.2); border-color:#3B82F6; }
  [data-theme="dark"] .att-btn-save-small { /* keep brand gradient — already dark-friendly */ }

  /* Modals */
  [data-theme="dark"] .att-overlay { background:rgba(0,0,0,.6); }
  [data-theme="dark"] .att-modal,
  [data-theme="dark"] .att-modal-lg { background:var(--bg-card); box-shadow:var(--shadow-xl); }
  [data-theme="dark"] .att-modal-header { border-bottom-color:var(--border-light); background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); }
  [data-theme="dark"] .att-modal-title { color:var(--text-primary); }
  [data-theme="dark"] .att-modal-sub { color:var(--text-muted); }
  [data-theme="dark"] .att-modal-body { background:var(--bg-card); color:var(--text-primary); }
  [data-theme="dark"] .att-modal-footer { background:var(--bg-muted); border-top-color:var(--border-light); }
  [data-theme="dark"] .att-modal-close { background:var(--bg-muted); color:var(--text-muted); }
  [data-theme="dark"] .att-modal-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }

  /* Form fields */
  [data-theme="dark"] .att-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
  [data-theme="dark"] .att-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
  [data-theme="dark"] .att-input::placeholder { color:var(--text-muted); }
  [data-theme="dark"] .att-label { color:var(--text-secondary); }
  [data-theme="dark"] .att-field-row { color:var(--text-primary); }

  /* Class chips inside holiday modal */
  [data-theme="dark"] .att-class-chip { background:rgba(59,130,246,.12); color:#93C5FD; border-color:rgba(59,130,246,.3); }
  [data-theme="dark"] .att-class-chip-x:hover { background:rgba(220,38,38,.2); color:#FCA5A5; }
  [data-theme="dark"] .att-class-select-wrap { background:var(--bg-card); border-color:var(--border-light); }

  /* Confirm dialog */
  [data-theme="dark"] .att-confirm { background:var(--bg-card); }
  [data-theme="dark"] .att-confirm-title { color:var(--text-primary); }
  [data-theme="dark"] .att-confirm-msg { color:var(--text-secondary); }

  /* Mark attendance table (radios + inputs) */
  [data-theme="dark"] .att-mark-table th { background:var(--bg-muted); color:var(--text-muted); border-bottom-color:var(--border-light); }
  [data-theme="dark"] .att-mark-table td { border-bottom-color:var(--border-light); color:var(--text-primary); }
  [data-theme="dark"] .att-radio-btn { background:var(--bg-card); border-color:var(--border-light); color:var(--text-muted); }
  [data-theme="dark"] .att-radio-btn.p.active { background:var(--success); border-color:var(--success); color:#fff; }
  [data-theme="dark"] .att-radio-btn.a.active { background:var(--error); border-color:var(--error); color:#fff; }
  [data-theme="dark"] .att-radio-btn.l.active { background:var(--warning); border-color:var(--warning); color:#fff; }
  [data-theme="dark"] .att-radio-group { background:transparent; }

  /* Report picker / preview */
  [data-theme="dark"] .att-rpt-picker { background:var(--bg-card); box-shadow:var(--shadow-xl); }
  [data-theme="dark"] .att-rpt-header { border-bottom-color:var(--border-light); background:linear-gradient(135deg,rgba(59,130,246,.06),transparent); }
  [data-theme="dark"] .att-rpt-title { color:var(--text-primary); }
  [data-theme="dark"] .att-rpt-sub { color:var(--text-muted); }
  [data-theme="dark"] .att-rpt-close { background:var(--bg-muted); color:var(--text-muted); }
  [data-theme="dark"] .att-rpt-close:hover { background:rgba(220,38,38,.18); color:#FCA5A5; }
  [data-theme="dark"] .att-rpt-footer { background:var(--bg-card); border-top-color:var(--border-light); }
  [data-theme="dark"] .att-rpt-section-label { color:var(--text-secondary); }
  [data-theme="dark"] .att-rpt-type-card { background:var(--bg-muted); border-color:var(--border-light); color:var(--text-primary); }
  [data-theme="dark"] .att-rpt-type-card:hover { border-color:var(--border-med); }
  [data-theme="dark"] .att-rpt-type-card.active { background:linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.10)); border-color:#3B82F6; }

  /* Reports sub-tabs + group cards */
  [data-theme="dark"] .res-sub-tabs { background:var(--bg-muted); border-color:var(--border-light); }
  [data-theme="dark"] .res-sub-tab { color:var(--text-muted); }
  [data-theme="dark"] .res-sub-tab.active { background:var(--bg-card); color:var(--text-primary); }
  [data-theme="dark"] .rpt-grp-grid .grp-card,
  [data-theme="dark"] .grp-card { background:var(--bg-card); border-color:var(--border-light); }
  [data-theme="dark"] .grp-card-title { color:var(--text-primary); }
  [data-theme="dark"] .grp-card-sub { color:var(--text-muted); }
  [data-theme="dark"] .grp-card-count { background:var(--bg-muted); color:var(--text-secondary); }
  [data-theme="dark"] .grp-view-btn { background:var(--bg-muted); color:var(--text-secondary); border-color:var(--border-light); }
  [data-theme="dark"] .grp-view-btn:hover { background:var(--bg-card); color:var(--text-primary); }
  [data-theme="dark"] .grp-card-body-inner { background:var(--bg-muted); border-top-color:var(--border-light); }
  [data-theme="dark"] .grp-rpt-row { background:var(--bg-card); border-color:var(--border-light); }
  [data-theme="dark"] .grp-rpt-row-label { color:var(--text-primary); }

  /* Search */
  [data-theme="dark"] .att-search-input { background:var(--input-bg, var(--bg-card)); border-color:var(--border-light); color:var(--text-primary); }
  [data-theme="dark"] .att-search-input::placeholder { color:var(--text-muted); }
  [data-theme="dark"] .att-search-input:focus { border-color:#3B82F6; box-shadow:0 0 0 3px rgba(59,130,246,.15); }
  [data-theme="dark"] .att-search-clear { background:var(--bg-muted); color:var(--text-muted); }
  [data-theme="dark"] .att-search-dropdown { background:var(--bg-card); border-color:var(--border-light); box-shadow:var(--shadow-lg); }
  [data-theme="dark"] .att-search-dropdown div:hover { background:var(--bg-muted); }

  /* ───────────────────────── MOBILE (≤600px) ─────────────────────────
    Real internal screen responsiveness — stacks section headers, makes
    class roster tables scroll horizontally with sticky student-name col,
    collapses date picker rows, scrolls weekly off day-toggles. */
  @media (max-width:600px) {
    /* Tab strip already scrolls — bump on phones */
    .att-tabs-row { padding:4px; margin-bottom:14px; gap:3px; }
    .att-tab { padding:9px 12px; font-size:11.5px; gap:5px; }
    .att-tab i { font-size:11px; }

    /* Section header — stack title + actions */
    .att-section { border-radius:12px; margin-bottom:12px; }
    .att-section-header { flex-direction:column; align-items:stretch; padding:12px 14px; gap:10px; }
    .att-section-title { gap:9px; }
    .att-section-icon { width:32px; height:32px; font-size:12px; border-radius:9px; }
    .att-section-name { font-size:13px; }
    .att-section-sub { font-size:11px; }
    .att-section-body { padding:14px 14px; }
    .att-info { font-size:11.5px; padding:9px 11px; gap:7px; }
    .att-section-header > div:last-child { width:100%; display:flex; flex-wrap:wrap; gap:8px; }
    .att-section-header .att-select-wrap { flex:1 1 auto; }
    .att-section-header .att-select { min-width:0; width:100%; }
    .att-section-header .att-btn-save-small,
    .att-section-header .att-btn-report,
    .att-section-header .att-btn-primary,
    .att-section-header .att-btn-secondary { flex:1 1 auto; justify-content:center; }

    /* Weekly off day-toggle bar — horizontal scroll keeps 7 visible */
    .att-days-grid { display:flex; grid-template-columns:none; overflow-x:auto; flex-wrap:nowrap; gap:8px; scrollbar-width:none; padding-bottom:4px; }
    .att-days-grid::-webkit-scrollbar { display:none; }
    .att-day-card { flex:0 0 72px; padding:11px 6px; border-radius:11px; }
    .att-day-icon { font-size:18px; margin-bottom:4px; }
    .att-day-name { font-size:11px; }
    .att-day-off { font-size:9.5px; margin-top:2px; }

    /* Months/holiday cards — stack header */
    .att-month-card { border-radius:11px; }
    .att-month-header { flex-direction:column; align-items:stretch; padding:12px 14px; gap:10px; }
    .att-month-left { gap:10px; }
    .att-month-name { font-size:13px; }
    .att-month-count { font-size:11px; }
    .att-month-actions { flex-wrap:wrap; gap:6px; justify-content:flex-end; }
    .att-add-holiday-btn { padding:6px 12px; font-size:11.5px; }
    .att-chevron-btn { width:28px; height:28px; font-size:10px; }

    /* Holiday-row — already 1-col at 600, tighten */
    .att-holiday-list { padding:8px 12px 10px; }
    .att-holiday-row { padding:10px 11px; gap:7px; }
    .att-holiday-title { font-size:12.5px; }
    .att-holiday-desc { font-size:10.5px; }
    .att-holiday-date { font-size:11.5px; }

    /* Student/Staff attendance grid — horizontal scroll with sticky name col */
    .att-section-body { overflow-x:visible; }
    .att-table-head { padding:0 12px; }
    .att-row { padding:0 12px; min-height:48px; }
    .att-th, .att-td { padding:9px 5px; font-size:11.5px; }
    .att-td.att-td-name { gap:6px; font-size:12px; }
    .att-row-icon { width:24px; height:24px; font-size:10px; border-radius:7px; }
    .att-status-badge { font-size:10px; padding:2px 7px; }
    .att-mark-btn-primary { padding:6px 11px; font-size:10.5px; gap:5px; }

    /* Expandable detail (per-student) — horizontal-scroll inner table */
    .att-detail-inner { padding:12px 12px 14px; overflow-x:auto; }
    .att-student-table { font-size:11.5px; min-width:520px; }
    .att-student-table th { padding:7px 7px; font-size:9.5px; }
    .att-student-table td { padding:8px 7px; font-size:11.5px; }
    .att-present-badge, .att-absent-badge, .att-leave-badge { font-size:10px; padding:2px 7px; }

    /* Calendar legend wraps */
    .att-cal-legend { gap:10px; margin-bottom:12px; }
    .att-legend-item { font-size:10.5px; }

    /* Stat strip — 2 cols on phone */
    .att-stat-row { grid-template-columns:1fr 1fr; gap:8px; }
    .att-stat-card { padding:11px 12px; border-radius:11px; }
    .att-stat-num { font-size:20px; }
    .att-stat-lbl { font-size:10px; }

    /* Search row — full width */
    .att-search-wrap { flex:1 1 100%; min-width:0; }
    .att-search-input { font-size:12px; height:36px; }

    /* Mark Attendance modal table — horizontal scroll */
    .att-modal { border-radius:14px; }
    .att-modal-header { padding:14px 14px 12px; flex-direction:column; align-items:flex-start; gap:8px; }
    .att-modal-header-left { gap:10px; }
    .att-modal-header-icon { width:34px; height:34px; font-size:14px; border-radius:9px; }
    .att-modal-title { font-size:14px; }
    .att-modal-sub { font-size:11px; }
    .att-modal-close { align-self:flex-end; margin-top:-40px; }
    .att-modal-body { padding:14px 14px; overflow-x:auto; }
    .att-modal-footer { flex-direction:column; gap:8px; padding:12px 14px; }
    .att-modal-footer .att-btn-primary,
    .att-modal-footer .att-btn-secondary { width:100%; justify-content:center; }
    .att-mark-table { font-size:11.5px; min-width:480px; }
    .att-mark-table th { padding:7px 7px; font-size:9.5px; }
    .att-mark-table td { padding:7px 7px; }
    .att-radio-group { flex-wrap:wrap; gap:3px; }
    .att-radio-btn { padding:4px 9px; font-size:10.5px; }
    .att-field-row { grid-template-columns:1fr; gap:10px; margin-bottom:10px; }
    .att-input, .att-textarea { font-size:12.5px; }

    /* Reports sub-tabs scroll */
    .res-sub-tabs { padding:4px; margin-bottom:14px; gap:3px; }
    .res-sub-tab { padding:9px 12px; font-size:11.5px; }

    /* General reports group card */
    .grp-card-header { flex-direction:column; align-items:stretch; padding:12px 14px; gap:10px; }
    .grp-card-icon { width:36px; height:36px; font-size:15px; border-radius:9px; }
    .grp-card-info { width:100%; }
    .grp-card-title { font-size:13px; }
    .grp-card-sub { font-size:11px; }
    .grp-card-meta { width:100%; justify-content:space-between; }
    .grp-card-body-inner { padding:0 14px 14px; padding-top:11px; }
    .grp-rpt-row-top { flex-direction:column; align-items:stretch; gap:6px; }
    .grp-rpt-row-filters { flex-direction:column; align-items:stretch; gap:8px; }
    .grp-rpt-field { min-width:0; }
    .grp-gen-btn { width:100%; justify-content:center; align-self:stretch; }

    /* Individual reports rows already 1-col — tighten */
    .att-rpt-cls-row, .att-rpt-sf-row { gap:6px; padding:10px 12px; }

    /* Report-picker modal — already capped at 96vw, tighten contents */
    .att-rpt-picker { border-radius:14px; }
    .att-rpt-header { padding:14px 14px 10px; }
    .att-rpt-title { font-size:15px; }
    .att-rpt-sub { font-size:11px; }
    .att-rpt-body { padding:14px 14px; }
    .att-rpt-footer { flex-direction:column; gap:8px; padding:12px 14px; }
    .att-rpt-footer .att-btn-primary,
    .att-rpt-footer .att-btn-secondary { width:100%; justify-content:center; }
    .att-rpt-filter-row { flex-direction:column; gap:8px; margin-bottom:14px; }
    .att-rpt-filter-field { min-width:0; }

    /* Confirm dialog */
    .att-confirm { padding:20px 18px; border-radius:14px; }
    .att-confirm-icon { width:44px; height:44px; font-size:18px; margin-bottom:12px; }
    .att-confirm-title { font-size:16px; }
    .att-confirm-msg { font-size:12.5px; margin-bottom:14px; }
    .att-confirm-btns { flex-direction:column; gap:8px; }
    .att-confirm-btns > * { width:100%; }
  }
  `;
