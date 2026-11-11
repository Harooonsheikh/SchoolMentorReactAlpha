import React, { useMemo, useState } from "react";
import { usePermissions } from "../context/PermissionsContext";
import * as attendanceService from "../services/attendanceService";
import {
  fetchWeeklyOffIdx, fetchAbsenteeismRecords, buildAbsenteeismReport,
} from "../services/studentAbsenteeismService";
import {
  buildStandardReportHtml, downloadReportAsWord, downloadReportHtmlAsExcel,
  openReportWindow, reportFileName, escReportText,
} from "../reports/reportKit";

/* ─── Student Absenteeism Report (Attendance → Reports → General) ─────────
   One report, two date modes (Single Day / Custom Range) × two scopes
   (Overall School / Class Wise). Self-contained: shares only existing
   services and CSS classes with the rest of the Attendance module. */

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const MAX_RANGE_DAYS = 366;
const ACCENT = "#a21caf";
const GRADIENT = "linear-gradient(135deg,#a21caf,#c026d3)";

const pctColor = (p) => (p >= 15 ? "#DC2626" : p >= 5 ? "#D97706" : "#16A34A");

function segBtn(active) {
  return {
    padding: "7px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    border: `1.5px solid ${active ? ACCENT : "#CBD5E1"}`, borderRadius: 8,
    background: active ? GRADIENT : "transparent", color: active ? "#fff" : "inherit",
  };
}

export default function StudentAbsenteeismReport({ studentData = [], toast = () => {} }) {
  const { can } = usePermissions();
  const canDownload = can("Attendance", "Reports", "Download");

  const [isOpen, setIsOpen] = useState(false);
  const [dateMode, setDateMode] = useState("single"); // single | range
  const [scope, setScope] = useState("overall");      // overall | class
  const [day, setDay] = useState(todayStr());
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [classKey, setClassKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { report, meta }
  const [onlyAbsent, setOnlyAbsent] = useState(true);

  const classOptions = useMemo(() => studentData.map((c) => ({
    key: `${c.classID}-${c.sectionID}`, label: `${c.cls} - ${c.sec}`,
  })), [studentData]);

  const generate = async () => {
    if (loading) return;
    const start = dateMode === "single" ? day : from;
    const end = dateMode === "single" ? day : to;
    if (!start || !end) return toast("Please select the date(s) first.", "error");
    if (start > end) return toast("From Date cannot be after To Date.", "error");
    if ((new Date(end) - new Date(start)) / 86400000 + 1 > MAX_RANGE_DAYS) {
      return toast(`Please select a range of ${MAX_RANGE_DAYS} days or less.`, "error");
    }
    if (!studentData.length) return toast("No classes or students found for this branch.", "error");
    let classes = studentData;
    if (scope === "class") {
      if (!classKey) return toast("Please select a class.", "error");
      classes = studentData.filter((c) => `${c.classID}-${c.sectionID}` === classKey);
    }
    setLoading(true);
    try {
      const [{ map, failed }, weeklyOffIdx] = await Promise.all([
        fetchAbsenteeismRecords({ classes, from: start, to: end }),
        fetchWeeklyOffIdx(),
      ]);
      const report = buildAbsenteeismReport({ classes, map, from: start, to: end, weeklyOffIdx });
      const label = scope === "class" ? classOptions.find((o) => o.key === classKey)?.label || "" : "All Classes";
      setResult({ report, meta: { start, end, single: start === end, scope, label } });
      if (failed) toast("Some attendance requests failed — figures may be incomplete.", "error");
      else if (!report.workingDays) toast("No attendance has been marked in the selected period.", "info");
    } catch (err) {
      console.error("Absenteeism report error:", err);
      toast("Could not generate the Absenteeism report. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const visibleStudents = result
    ? (onlyAbsent ? result.report.students.filter((s) => s.absent > 0) : result.report.students)
    : [];

  /* ── Download (PDF / Word / Excel) — same reportKit as every other report ── */
  const download = async (format) => {
    if (!result) return;
    const { report, meta } = result;
    const th = "padding:7px 9px;border:1px solid #CBD5E1;background:#FEE2E2;font-size:11.5px;text-align:left";
    const td = "padding:6px 9px;border:1px solid #E2E8F0;font-size:11.5px";
    const e = escReportText;
    const periodLabel = meta.single ? meta.start : `${meta.start} → ${meta.end}`;
    const dayWord = meta.single ? "" : " Days";
    const classTable = meta.scope === "overall" ? `
      <h3 style="margin:14px 0 8px;font-size:13px">Class-wise Summary</h3>
      <table style="width:100%;border-collapse:collapse"><thead><tr>
        <th style="${th}">Class</th><th style="${th}">Total Students</th><th style="${th}">Present${dayWord}</th>
        <th style="${th}">Absent${dayWord}</th><th style="${th}">Leave${dayWord}</th><th style="${th}">Not Marked${dayWord}</th><th style="${th}">Absenteeism %</th>
      </tr></thead><tbody>
      ${report.classRows.map((c) => `<tr><td style="${td}">${e(c.label)}</td><td style="${td}">${c.total}</td><td style="${td}">${c.present}</td><td style="${td}">${c.absent}</td><td style="${td}">${c.leave}</td><td style="${td}">${c.notMarked}</td><td style="${td}">${c.absentPct}%</td></tr>`).join("")}
      <tr><td style="${td};font-weight:700">Total</td><td style="${td};font-weight:700">${report.totals.total}</td><td style="${td};font-weight:700">${report.totals.present}</td><td style="${td};font-weight:700">${report.totals.absent}</td><td style="${td};font-weight:700">${report.totals.leave}</td><td style="${td};font-weight:700">${report.totals.notMarked}</td><td style="${td};font-weight:700">${report.totals.absentPct}%</td></tr>
      </tbody></table>` : "";
    const stuRows = (onlyAbsent ? report.students.filter((s) => s.absent > 0) : report.students);
    const bodyHtml = `
      <div style="font-size:12px;margin-bottom:6px"><strong>Scope:</strong> ${e(meta.scope === "overall" ? "Overall School" : meta.label)} &nbsp;·&nbsp;
        <strong>Period:</strong> ${e(periodLabel)} &nbsp;·&nbsp; <strong>Calendar days:</strong> ${report.periodDays} &nbsp;·&nbsp; <strong>Working days:</strong> ${report.workingDays}</div>
      ${classTable}
      <h3 style="margin:14px 0 8px;font-size:13px">Student-wise Absenteeism${onlyAbsent ? " (students with absences)" : ""}</h3>
      <table style="width:100%;border-collapse:collapse"><thead><tr>
        <th style="${th}">#</th><th style="${th}">Student</th><th style="${th}">Reg No.</th><th style="${th}">Class</th>
        <th style="${th}">Present Days</th><th style="${th}">Absent Days</th><th style="${th}">Leave Days</th><th style="${th}">Absenteeism %</th>
      </tr></thead><tbody>
      ${stuRows.length ? stuRows.map((s, i) => `<tr><td style="${td}">${i + 1}</td><td style="${td}">${e(s.name)}</td><td style="${td}">${e(s.reg)}</td><td style="${td}">${e(s.classLabel)}</td><td style="${td}">${s.present}</td><td style="${td}">${s.absent}</td><td style="${td}">${s.leave}</td><td style="${td}">${s.absentPct}%</td></tr>`).join("")
        : `<tr><td colspan="8" style="${td};text-align:center">No students found.</td></tr>`}
      </tbody></table>`;
    let schoolName = "";
    try { schoolName = (await attendanceService.getReportHeader())?.name || ""; } catch { /* header is optional */ }
    const title = "Student Absenteeism Report";
    const html = buildStandardReportHtml({
      title, format, isColor: true, bodyHtml, schoolName,
      subtitleLine: `${meta.scope === "overall" ? "Overall School" : meta.label} · ${periodLabel}`,
      includeToolbar: format === "pdf",
    });
    if (format === "word") downloadReportAsWord(html, `${reportFileName(title)}.docx`);
    else if (format === "excel") downloadReportHtmlAsExcel(html, `${reportFileName(title)}.xlsx`);
    else openReportWindow(html);
  };

  if (!canDownload) return null;

  const dayWord = result && !result.meta.single ? " Days" : "";
  const T = result?.report.totals;

  return (
    <div className="grp-card" style={{ gridColumn: "1 / -1" }}>
      <div className="grp-card-header">
        <div className="grp-card-icon" style={{ background: GRADIENT }}><i className="fa-solid fa-user-xmark"></i></div>
        <div className="grp-card-info">
          <div className="grp-card-title">Student Absenteeism Report</div>
          <div className="grp-card-sub">Absent days and absenteeism % — overall school or class-wise, for a single day or a date range</div>
        </div>
        <div className="grp-card-meta">
          <span className="grp-card-count">1 Report</span>
          <button className={`grp-view-btn${isOpen ? " open" : ""}`} onClick={() => setIsOpen((o) => !o)}>
            {isOpen ? "Hide Details" : "View Details"}
            <i className="fa-solid fa-chevron-down grp-chev"></i>
          </button>
        </div>
      </div>

      <div className={`grp-card-body${isOpen ? " open" : ""}`} style={isOpen ? { maxHeight: 20000 } : undefined}>
      <div className="grp-card-body-inner">
        <div className="grp-rpt-row">
        <div className="grp-rpt-row-top">
          <div className="grp-rpt-row-label">
            <i className="fa-solid fa-user-xmark" style={{ color: ACCENT }}></i>Student Absenteeism Report
          </div>
          <button className="grp-gen-btn" style={{ background: GRADIENT, ...(loading ? { opacity: .7, cursor: "wait" } : {}) }} onClick={generate} disabled={loading}>
            {loading ? <><i className="fa-solid fa-spinner fa-spin"></i> Generating…</> : <><i className="fa-solid fa-file-lines"></i> Generate</>}
          </button>
        </div>
        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
          <div>
            <div className="grp-rpt-field-lbl" style={{ marginBottom: 6 }}>Date Selection</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={segBtn(dateMode === "single")} onClick={() => setDateMode("single")}>Single Day</button>
              <button type="button" style={segBtn(dateMode === "range")} onClick={() => setDateMode("range")}>Custom Range</button>
            </div>
          </div>
          <div>
            <div className="grp-rpt-field-lbl" style={{ marginBottom: 6 }}>Report Type</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={segBtn(scope === "overall")} onClick={() => setScope("overall")}>Overall School</button>
              <button type="button" style={segBtn(scope === "class")} onClick={() => setScope("class")}>Class Wise</button>
            </div>
          </div>
        </div>

        <div className="grp-rpt-row-filters">
          {dateMode === "single" ? (
            <div className="grp-rpt-field">
              <span className="grp-rpt-field-lbl">Select Date</span>
              <input type="date" className="att-input" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          ) : (
            <>
              <div className="grp-rpt-field">
                <span className="grp-rpt-field-lbl">From Date</span>
                <input type="date" className="att-input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="grp-rpt-field">
                <span className="grp-rpt-field-lbl">To Date</span>
                <input type="date" className="att-input" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          {scope === "class" && (
            <div className="grp-rpt-field">
              <span className="grp-rpt-field-lbl">Class</span>
              <select className="att-select" value={classKey} onChange={(e) => setClassKey(e.target.value)}>
                <option value="">Select class…</option>
                {classOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>

        </div>

        {/* Result */}
        {result && (
          <div className="grp-rpt-row">
            <div style={{ fontSize: 12.5, marginBottom: 10, opacity: .8 }}>
              <strong>{result.meta.scope === "overall" ? "Overall School" : result.meta.label}</strong>
              {" · "}{result.meta.single ? result.meta.start : `${result.meta.start} → ${result.meta.end}`}
              {" · "}{result.report.periodDays} calendar day{result.report.periodDays === 1 ? "" : "s"}
              {" · "}{result.report.workingDays} working day{result.report.workingDays === 1 ? "" : "s"}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 16 }}>
              {[
                ["Total Students", T.total, "#1E40AF"],
                ["Working Days", result.report.workingDays, "#475569"],
                [`Present${dayWord}`, T.present, "#16A34A"],
                [`Absent${dayWord}`, T.absent, "#DC2626"],
                ["Absenteeism", `${T.absentPct}%`, pctColor(T.absentPct)],
              ].map(([k, v, c]) => (
                <div key={k} style={{ border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 11, opacity: .7 }}>{k}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>

            {result.meta.scope === "overall" && (
              <div style={{ overflowX: "auto", marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Class-wise Summary</div>
                <table className="att-student-table" style={{ minWidth: 560 }}>
                  <thead><tr>
                    <th>Class</th><th>Total Students</th><th>Present{dayWord}</th><th>Absent{dayWord}</th>
                    <th>Leave{dayWord}</th><th>Not Marked{dayWord}</th><th>Absenteeism %</th>
                  </tr></thead>
                  <tbody>
                    {result.report.classRows.map((c) => (
                      <tr key={c.key}>
                        <td><strong>{c.label}</strong></td><td>{c.total}</td><td>{c.present}</td>
                        <td>{c.absent}</td><td>{c.leave}</td><td>{c.notMarked}</td>
                        <td style={{ fontWeight: 800, color: pctColor(c.absentPct) }}>{c.absentPct}%</td>
                      </tr>
                    ))}
                    <tr>
                      <td><strong>Total</strong></td><td><strong>{T.total}</strong></td><td><strong>{T.present}</strong></td>
                      <td><strong>{T.absent}</strong></td><td><strong>{T.leave}</strong></td><td><strong>{T.notMarked}</strong></td>
                      <td style={{ fontWeight: 800, color: pctColor(T.absentPct) }}>{T.absentPct}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Student-wise Absenteeism</div>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={onlyAbsent} onChange={(e) => setOnlyAbsent(e.target.checked)} />
                Only students with absences
              </label>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="att-student-table" style={{ minWidth: 640 }}>
                <thead><tr>
                  <th>#</th><th>Student</th><th>Class</th><th>Present Days</th>
                  <th>Absent Days</th><th>Leave Days</th><th>Absenteeism %</th>
                </tr></thead>
                <tbody>
                  {visibleStudents.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: 14, fontStyle: "italic", opacity: .7 }}>
                      {onlyAbsent ? "No absences recorded in this period." : "No students found."}
                    </td></tr>
                  ) : visibleStudents.map((s, i) => (
                    <tr key={s.id}>
                      <td>{i + 1}</td><td><strong>{s.name}</strong></td><td>{s.classLabel}</td>
                      <td>{s.present}</td><td style={{ fontWeight: 800, color: s.absent ? "#DC2626" : undefined }}>{s.absent}</td>
                      <td>{s.leave}</td><td style={{ fontWeight: 800, color: pctColor(s.absentPct) }}>{s.absentPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button className="att-btn-primary" style={{ padding: "7px 16px", fontSize: 12.5 }} onClick={() => download("pdf")}><i className="fa-solid fa-file-pdf"></i> PDF</button>
              <button className="att-btn-primary" style={{ padding: "7px 16px", fontSize: 12.5 }} onClick={() => download("word")}><i className="fa-solid fa-file-word"></i> Word</button>
              <button className="att-btn-primary" style={{ padding: "7px 16px", fontSize: 12.5 }} onClick={() => download("excel")}><i className="fa-solid fa-file-excel"></i> Excel</button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
