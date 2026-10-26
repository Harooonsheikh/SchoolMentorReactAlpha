import React, { useEffect, useMemo, useState } from "react";
import Tooltip from "./Tooltip";
import * as hrAnnualLeaveService from "../services/hrAnnualLeaveService";
import { useSettings, formatDate } from "../pages/Settings/settingsStore";
import {
  buildStandardReportHtml, buildReportTableHtml, openReportWindow,
  downloadReportAsWord, downloadReportHtmlAsExcel, reportFileName,
} from "../reports/reportKit";

/* ═══════════════════════════════════════════════════════════════════
   HR → Reports → Annual Leave Summary — Report 1 (all employees) and
   Report 2 (individual statement) in one persistent in-page screen,
   the same "own screen, not the generic print-popup" pattern
   SecurityRetentionReport already established in this file (the only
   existing precedent for a drill-down HR report) — this is the second
   report to use it, not a competing pattern.

   BRANCH RESTRICTION: This report is only active for branchId === 1
   ═══════════════════════════════════════════════════════════════════ */

const HAL_CSS = `
.hal-root { display:flex; flex-direction:column; gap:18px; }
.hal-back-row { display:flex; align-items:center; gap:10px; margin-bottom:2px; }
.hal-back-btn { display:inline-flex; align-items:center; gap:7px; background:none; border:none; color:var(--brand-solid,#1E40AF); font:700 13px/1 var(--font-body,inherit); cursor:pointer; padding:6px 0; }

.hal-filters { background:var(--bg-card,#fff); border:1.5px solid var(--border-light,#E2E8F0); border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:12px; }
.hal-filter-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
.hal-field { display:flex; flex-direction:column; gap:6px; }
.hal-label { font:700 10.5px/1 var(--font-body,inherit); text-transform:uppercase; letter-spacing:.4px; color:var(--text-muted,#64748B); }
.hal-input, .hal-select { padding:9px 12px; border-radius:8px; border:1.5px solid var(--border-light,#E2E8F0); background:var(--bg-card,#fff); color:var(--text-primary); font:600 13px/1.3 var(--font-body,inherit); }
.hal-actions-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.hal-btn { padding:9px 15px; border-radius:8px; border:1.5px solid var(--border-light,#E2E8F0); background:var(--bg-card,#fff); font:700 12px/1 var(--font-body,inherit); color:var(--text-secondary,#334155); cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
.hal-btn.primary { border-color:#7C3AED; background:rgba(124,92,246,.08); color:#6D28D9; }

.hal-tabs { display:flex; gap:4px; background:#fff; border:1.5px solid #E9D5FF; border-radius:14px; padding:5px; }
.hal-tab { flex:1; padding:10px 14px; border-radius:10px; border:none; background:transparent; font:700 13px/1 var(--font-body,inherit); color:var(--text-secondary,#334155); cursor:pointer; }
.hal-tab.active { background:linear-gradient(135deg,#6D28D9,#7C3AED); color:#fff; }

.hal-card-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px; }
.hal-card { border-radius:12px; padding:13px 15px; color:#fff; display:flex; flex-direction:column; gap:4px; }
.hal-card-label { font:700 10.5px/1 var(--font-body,inherit); text-transform:uppercase; letter-spacing:.3px; opacity:.9; }
.hal-card-value { font:800 21px/1.2 var(--font-body,inherit); }
.hal-card-sub { font:600 10.5px/1.3 var(--font-body,inherit); opacity:.85; }

.hal-section { background:var(--bg-card,#fff); border:1.5px solid var(--border-light,#E2E8F0); border-radius:14px; padding:16px 18px; }
.hal-section-title { font:800 13.5px/1.3 var(--font-body,inherit); color:var(--text-primary); margin-bottom:10px; }

.hal-table-wrap { overflow-x:auto; }
.hal-table { width:100%; border-collapse:collapse; min-width:1000px; }
.hal-table th { text-align:left; font:800 10px/1 var(--font-body,inherit); text-transform:uppercase; letter-spacing:.3px; color:var(--text-muted,#64748B); padding:9px 10px; border-bottom:1.5px solid var(--border-light,#E2E8F0); white-space:nowrap; }
.hal-table td { padding:10px; border-bottom:1px solid var(--border-light,#E2E8F0); font:600 12.5px/1.4 var(--font-body,inherit); color:var(--text-primary); white-space:nowrap; }
.hal-table tr:hover { background:rgba(124,92,246,.03); }

.hal-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:999px; font:800 10px/1 var(--font-body,inherit); text-transform:uppercase; }
.hal-badge--ok { background:rgba(22,163,74,.12); color:#15803D; }
.hal-badge--warn { background:rgba(220,38,38,.12); color:#B91C1C; }
.hal-badge--neutral { background:#F1F5F9; color:#475569; }
.hal-badge--approved, .hal-badge--present, .hal-badge--leave { background:rgba(22,163,74,.12); color:#15803D; }
.hal-badge--pending { background:rgba(217,119,6,.12); color:#B45309; }
.hal-badge--rejected, .hal-badge--absent { background:rgba(220,38,38,.12); color:#B91C1C; }
.hal-badge--cancelled, .hal-badge--norecord { background:#F1F5F9; color:#475569; }

.hal-msg-box { background:rgba(124,92,246,.07); border:1.5px solid rgba(124,92,246,.25); border-radius:10px; padding:13px 15px; font:600 13px/1.6 var(--font-body,inherit); color:#4C1D95; margin-bottom:14px; }
.hal-empty { text-align:center; padding:34px 20px; color:var(--text-muted,#64748B); font-size:12.5px; }
.hal-loading { text-align:center; padding:28px; color:var(--text-muted,#64748B); font-size:12.5px; }

.hal-header-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:10px; margin-bottom:16px; }
.hal-header-item { background:var(--bg-muted,#F8FAFF); border-radius:9px; padding:10px 12px; }
.hal-header-label { font:700 10.5px/1 var(--font-body,inherit); text-transform:uppercase; letter-spacing:.3px; color:var(--text-muted,#64748B); margin-bottom:4px; }
.hal-header-value { font:700 13px/1.3 var(--font-body,inherit); color:var(--text-primary); }
`;

const fmtPct = (v) => (v == null ? "N/A" : `${v}%`);
const fmtNum = (v) => (v == null ? "Not Configured" : v);
const fmtMoney = (v) => `PKR ${(Number(v) || 0).toLocaleString("en-PK")}`;

function SummaryCard({ icon, label, value, sub, gradient }) {
  return (
    <div className="hal-card" style={{ background: gradient }}>
      <div className="hal-card-label"><i className={`fa-solid ${icon}`}></i> {label}</div>
      <div className="hal-card-value">{value}</div>
      {sub && <div className="hal-card-sub">{sub}</div>}
    </div>
  );
}

const GRAD = {
  purple: "linear-gradient(135deg,#6D28D9,#7C3AED)",
  green: "linear-gradient(135deg,#065f46,#059669)",
  amber: "linear-gradient(135deg,#B45309,#D97706)",
  red: "linear-gradient(135deg,#991B1B,#DC2626)",
  gray: "linear-gradient(135deg,#475569,#64748B)",
  blue: "linear-gradient(135deg,#1E3A8A,#2563EB)",
};

/* ─── Report 1: All Employees ─── */
function AllEmployeesTab({ depts, sessionStart, sessionEnd, onViewDetails, toast }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    setLoading(true);
    try {
      const res = await hrAnnualLeaveService.computeAnnualLeaveSummary({
        sessionStart, sessionEnd,
        department: department ? Number(department) : null,
        status: status || null,
        query,
      });
      setData(res);
    } catch (e) {
      toast(e?.message || "Unable to generate the report. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (sessionStart && sessionEnd) search(); }, [sessionStart, sessionEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setQuery(""); setDepartment(""); setStatus(""); search(); };

  const exportHtml = () => {
    if (!data) return null;
    const tableHtml = buildReportTableHtml({
      columns: [
        { label: "#" }, { label: "Employee" }, { label: "ID" }, { label: "Department" }, { label: "Designation" },
        { label: "Allowed" }, { label: "Availed" }, { label: "Remaining" }, { label: "Excess" }, { label: "Absence Days" },
        { label: "Deduct Enabled" }, { label: "Rate" }, { label: "Total Deduction" },
      ],
      rows: data.rows.map((r, i) => [i + 1, r.employeeName, r.employeeEid, r.department, r.designation,
        fmtNum(r.annualLeavesAllowed), r.annualLeavesAvailed, fmtNum(r.annualLeavesRemaining), r.excessLeaves,
        r.absenceDays, r.deductionEnabled ? "Yes" : "No", fmtMoney(r.deductionRate), fmtMoney(r.totalDeductionAmount)]),
      isColor: true,
      emptyText: "No employees match the selected filters.",
    });
    const s = data.summary;
    const bodyHtml = `
      <p style="margin-bottom:14px;color:#555">Total Active Employees: ${s.totalActiveEmployees} · Total Allowed: ${s.totalAllowed} · Total Availed: ${s.totalAvailed} · Total Remaining: ${s.totalRemaining} · Employees Exceeded: ${s.employeesExceeded} · Total Deductions: ${fmtMoney(s.totalDeduction)}</p>
      ${tableHtml}
    `;
    return buildStandardReportHtml({
      title: "Annual Leave Summary — All Employees",
      isColor: true,
      bodyHtml,
      subtitleLine: `Session: ${sessionStart} to ${sessionEnd}`,
    });
  };
  const handlePrint = () => { const h = exportHtml(); if (h) openReportWindow(h); };
  const handleWord = () => { const h = exportHtml(); if (h) downloadReportAsWord(h, `${reportFileName("Annual-Leave-Summary")}.doc`); };
  const handleExcel = () => { const h = exportHtml(); if (h) downloadReportHtmlAsExcel(h, `${reportFileName("Annual-Leave-Summary")}.xls`); };

  return (
    <div className="hal-root">
      <div className="hal-filters">
        <div className="hal-filter-row">
          <div className="hal-field">
            <span className="hal-label">Employee Name or ID</span>
            <input className="hal-input" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="hal-field">
            <span className="hal-label">Department</span>
            <select className="hal-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All Departments</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="hal-field">
            <span className="hal-label">Entitlement Status</span>
            <select className="hal-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Employees</option>
              <option value="exceeded">Exceeded Entitlement</option>
              <option value="within">Within Entitlement</option>
            </select>
          </div>
        </div>
        <div className="hal-actions-row">
          <button type="button" className="hal-btn primary" onClick={search} disabled={loading}>
            <i className={`fa-solid ${loading ? "fa-circle-notch fa-spin" : "fa-magnifying-glass"}`}></i> Search
          </button>
          <button type="button" className="hal-btn" onClick={reset}><i className="fa-solid fa-rotate-left"></i> Reset</button>
          {data && (
            <>
              <button type="button" className="hal-btn" onClick={handlePrint}><i className="fa-solid fa-print"></i> Print</button>
              <button type="button" className="hal-btn" onClick={handleWord}><i className="fa-solid fa-file-word"></i> Export PDF/Word</button>
              <button type="button" className="hal-btn" onClick={handleExcel}><i className="fa-solid fa-file-excel"></i> Export Excel</button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="hal-loading"><i className="fa-solid fa-circle-notch fa-spin"></i> Loading…</div>
      ) : !data ? null : (
        <>
          <div className="hal-card-grid">
            <SummaryCard icon="fa-users" label="Total Active Employees" value={data.summary.totalActiveEmployees} gradient={GRAD.gray} />
            <SummaryCard icon="fa-calendar-plus" label="Total Annual Leaves Allowed" value={data.summary.totalAllowed} gradient={GRAD.purple} />
            <SummaryCard icon="fa-calendar-check" label="Total Annual Leaves Availed" value={data.summary.totalAvailed} gradient={GRAD.blue} />
            <SummaryCard icon="fa-calendar-day" label="Total Annual Leaves Remaining" value={data.summary.totalRemaining} gradient={GRAD.green} />
            <SummaryCard icon="fa-triangle-exclamation" label="Exceeded Entitlement" value={data.summary.employeesExceeded} sub="employees" gradient={GRAD.amber} />
            <SummaryCard icon="fa-sack-dollar" label="Total Salary Deductions" value={fmtMoney(data.summary.totalDeduction)} gradient={GRAD.red} />
          </div>

          <div className="hal-section">
            <div className="hal-section-title">Annual Leave Summary — All Employees</div>
            {data.rows.length === 0 ? (
              <div className="hal-empty"><i className="fa-solid fa-inbox"></i>No employees match the selected filters.</div>
            ) : (
              <div className="hal-table-wrap">
                <table className="hal-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Employee</th><th>ID</th><th>Department</th><th>Designation</th>
                      <th>Allowed</th><th>Availed</th><th>Remaining</th><th>Excess</th><th>Absence Days</th>
                      <th>Paid/Unpaid</th><th>Deduct?</th><th>Rate/Day</th><th>Total Deduction</th><th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={r.employeeId}>
                        <td>{i + 1}</td><td>{r.employeeName}</td><td>{r.employeeEid}</td><td>{r.department}</td><td>{r.designation}</td>
                        <td>{fmtNum(r.annualLeavesAllowed)}</td><td>{r.annualLeavesAvailed}</td><td>{fmtNum(r.annualLeavesRemaining)}</td>
                        <td>{r.excessLeaves > 0 ? <span className="hal-badge hal-badge--warn">{r.excessLeaves}</span> : "0"}</td>
                        <td>{r.absenceDays}</td><td>{r.paidUnpaidAbsenceStatus}</td>
                        <td>{r.deductionEnabled ? <span className="hal-badge hal-badge--ok">Yes</span> : <span className="hal-badge hal-badge--neutral">No</span>}</td>
                        <td>{fmtMoney(r.deductionRate)}</td>
                        <td>{r.totalDeductionAmount > 0 ? <b style={{ color: "#B91C1C" }}>{fmtMoney(r.totalDeductionAmount)}</b> : fmtMoney(0)}</td>
                        <td>
                          <Tooltip text="View this employee's full Annual Leave & Attendance Statement">
                            <button type="button" className="hal-btn" style={{ padding: "4px 9px" }} onClick={() => onViewDetails(r.employeeId)}>
                              <i className="fa-solid fa-eye"></i>
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Report 2: Individual Statement ─── */
function IndividualStatementTab({ employees, sessionStart, sessionEnd, empId, onEmpIdChange, toast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = async (id) => {
    if (!id) { setData(null); return; }
    setLoading(true);
    try {
      const res = await hrAnnualLeaveService.computeIndividualAnnualLeaveStatement({ employeeId: Number(id), sessionStart, sessionEnd });
      setData(res);
    } catch (e) {
      toast(e?.message || "Unable to load the employee statement.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (empId) load(empId); else setData(null); }, [empId, sessionStart, sessionEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredHistory = useMemo(() => {
    if (!data) return [];
    return data.history.filter((h) => (!monthFilter || h.date.slice(0, 7) === monthFilter)
      && (!typeFilter || h.leaveType === typeFilter)
      && (!statusFilter || h.classification.toLowerCase().includes(statusFilter.toLowerCase())));
  }, [data, monthFilter, typeFilter, statusFilter]);

  const exportHtml = () => {
    if (!data) return null;
    const monthsTable = buildReportTableHtml({
      columns: [{ label: "Month" }, { label: "Scheduled" }, { label: "Present" }, { label: "Absent" }, { label: "Half-Days" }, { label: "Approved Leave" }, { label: "Attendance %" }, { label: "Absenteeism %" }],
      rows: data.months.map((m) => [m.month, m.scheduledWorkingDays, m.presentDays, m.absentDays, m.halfDays, m.approvedLeaveDays, fmtPct(m.attendancePercentage), fmtPct(m.absenteeismPercentage)]),
      isColor: true,
    });
    const historyTable = buildReportTableHtml({
      columns: [{ label: "Date" }, { label: "Day" }, { label: "Status" }, { label: "In" }, { label: "Out" }, { label: "Classification" }, { label: "Remarks" }],
      rows: data.history.map((h) => [h.date, h.day, h.status || "—", h.inTime || "—", h.outTime || "—", h.classification, h.remarks || "—"]),
      isColor: true,
    });
    const bodyHtml = `
      <h2>${data.employee.name} (${data.employee.eid})</h2>
      <p style="color:#555">${data.employee.department} · ${data.employee.designation} · Joined ${data.employee.joinDate}</p>
      <p style="margin:12px 0;color:#333">${data.statusMessage}</p>
      <h3 style="margin:16px 0 8px">Monthly Attendance Summary</h3>${monthsTable}
      <h3 style="margin:16px 0 8px">Detailed Attendance &amp; Leave History</h3>${historyTable}
    `;
    return buildStandardReportHtml({
      title: `Annual Leave & Attendance Statement — ${data.employee.name}`,
      isColor: true,
      bodyHtml,
      subtitleLine: `Session: ${sessionStart} to ${sessionEnd}`,
    });
  };
  const handlePrint = () => { const h = exportHtml(); if (h) openReportWindow(h); };
  const handleWord = () => { const h = exportHtml(); if (h) downloadReportAsWord(h, `${reportFileName(`Annual-Leave-Statement-${data?.employee?.eid || ""}`)}.doc`); };
  const handleExcel = () => { const h = exportHtml(); if (h) downloadReportHtmlAsExcel(h, `${reportFileName(`Annual-Leave-Statement-${data?.employee?.eid || ""}`)}.xls`); };

  return (
    <div className="hal-root">
      <div className="hal-filters">
        <div className="hal-filter-row">
          <div className="hal-field" style={{ gridColumn: "1 / -1" }}>
            <span className="hal-label">Employee Name / ID</span>
            <select className="hal-select" value={empId || ""} onChange={(e) => onEmpIdChange(e.target.value)}>
              <option value="">Select an employee…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.eid} ({e.deptName})</option>)}
            </select>
          </div>
        </div>
        {data && (
          <div className="hal-actions-row">
            <button type="button" className="hal-btn" onClick={handlePrint}><i className="fa-solid fa-print"></i> Print Statement</button>
            <button type="button" className="hal-btn" onClick={handleWord}><i className="fa-solid fa-file-word"></i> Export PDF/Word</button>
            <button type="button" className="hal-btn" onClick={handleExcel}><i className="fa-solid fa-file-excel"></i> Export Excel</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="hal-loading"><i className="fa-solid fa-circle-notch fa-spin"></i> Loading…</div>
      ) : !data ? (
        <div className="hal-empty"><i className="fa-solid fa-user"></i>Select an employee above to view their Annual Leave &amp; Attendance Statement.</div>
      ) : (
        <>
          <div className="hal-section">
            <div className="hal-header-grid">
              <div className="hal-header-item"><div className="hal-header-label">Employee</div><div className="hal-header-value">{data.employee.name}</div></div>
              <div className="hal-header-item"><div className="hal-header-label">Employee ID</div><div className="hal-header-value">{data.employee.eid}</div></div>
              <div className="hal-header-item"><div className="hal-header-label">Department</div><div className="hal-header-value">{data.employee.department}</div></div>
              <div className="hal-header-item"><div className="hal-header-label">Designation</div><div className="hal-header-value">{data.employee.designation}</div></div>
              <div className="hal-header-item"><div className="hal-header-label">Joining Date</div><div className="hal-header-value">{data.employee.joinDate}</div></div>
              <div className="hal-header-item"><div className="hal-header-label">Status</div><div className="hal-header-value">{data.employee.status}</div></div>
              <div className="hal-header-item"><div className="hal-header-label">Session</div><div className="hal-header-value">{sessionStart} → {sessionEnd}</div></div>
            </div>

            <div className="hal-card-grid" style={{ marginBottom: 16 }}>
              <SummaryCard icon="fa-calendar-week" label="Scheduled Working Days" value={data.attendance.scheduledWorkingDays} gradient={GRAD.gray} />
              <SummaryCard icon="fa-circle-check" label="Present Days" value={data.attendance.presentDays} gradient={GRAD.green} />
              <SummaryCard icon="fa-circle-xmark" label="Absent Days" value={data.attendance.absentDays} gradient={GRAD.red} />
              <SummaryCard icon="fa-umbrella-beach" label="Approved Leave Days" value={data.attendance.approvedLeaveDays} gradient={GRAD.blue} />
              <SummaryCard icon="fa-calendar-plus" label="Annual Leaves Allowed" value={fmtNum(data.annual.annualLeavesAllowed)} gradient={GRAD.purple} />
              <SummaryCard icon="fa-calendar-check" label="Annual Leaves Availed" value={data.annual.annualLeavesAvailed} gradient={GRAD.blue} />
              <SummaryCard icon="fa-calendar-day" label="Annual Leaves Remaining" value={fmtNum(data.annual.annualLeavesRemaining)} gradient={GRAD.green} />
              <SummaryCard icon="fa-triangle-exclamation" label="Excess Leaves" value={data.annual.excessLeaves} gradient={GRAD.amber} />
              <SummaryCard icon="fa-sack-dollar" label="Total Salary Deduction" value={data.annual.deductionEnabled ? fmtMoney(data.annual.totalDeductionAmount) : "Not Applicable"} gradient={GRAD.red} />
            </div>

            <div className="hal-msg-box"><i className="fa-solid fa-circle-info"></i> {data.statusMessage}</div>

            <div className="hal-section-title">Annual Leave Entitlement &amp; Utilization</div>
            <div className="hal-table-wrap" style={{ marginBottom: 18 }}>
              <table className="hal-table" style={{ minWidth: 0 }}>
                <tbody>
                  <tr><td>Annual Leaves Allowed</td><td>{fmtNum(data.annual.annualLeavesAllowed)}</td></tr>
                  <tr><td>Annual Leaves Availed</td><td>{data.annual.annualLeavesAvailed}</td></tr>
                  <tr><td>Annual Leaves Remaining</td><td>{fmtNum(data.annual.annualLeavesRemaining)}</td></tr>
                  <tr><td>Excess Leaves</td><td>{data.annual.excessLeaves}</td></tr>
                  <tr><td>Deduction Enabled</td><td>{data.annual.deductionEnabled ? "Yes" : "No"}</td></tr>
                  <tr><td>Deduction Rate</td><td>{fmtMoney(data.annual.deductionRate)} per excess day</td></tr>
                  <tr><td>Deductible Excess Days</td><td>{data.annual.deductionEnabled ? data.annual.excessLeaves : 0}</td></tr>
                  <tr><td>Total Deduction</td><td><b>{data.annual.deductionEnabled ? fmtMoney(data.annual.totalDeductionAmount) : "PKR 0"}</b></td></tr>
                </tbody>
              </table>
            </div>

            <div className="hal-section-title">Monthly Attendance Summary</div>
            <div className="hal-table-wrap" style={{ marginBottom: 18 }}>
              <table className="hal-table">
                <thead><tr><th>Month</th><th>Scheduled</th><th>Present</th><th>Absent</th><th>Half-Days</th><th>Approved Leave</th><th>Attendance %</th><th>Absenteeism %</th></tr></thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td><td>{m.scheduledWorkingDays}</td><td>{m.presentDays}</td><td>{m.absentDays}</td>
                      <td>{m.halfDays}</td><td>{m.approvedLeaveDays}</td><td>{fmtPct(m.attendancePercentage)}</td><td>{fmtPct(m.absenteeismPercentage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hal-section-title">Detailed Attendance &amp; Leave History</div>
            <div className="hal-actions-row" style={{ marginBottom: 10 }}>
              <input type="month" className="hal-input" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
              <select className="hal-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">All Leave Types</option>
                <option value="Annual">Annual</option><option value="Casual">Casual</option><option value="Sick">Sick</option>
              </select>
              <select className="hal-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="present">Present</option><option value="leave">Approved Leave</option>
                <option value="absence">Unexcused Absence</option><option value="no record">No Record</option>
              </select>
            </div>
            <div className="hal-table-wrap">
              <table className="hal-table">
                <thead><tr><th>Date</th><th>Day</th><th>Status</th><th>In</th><th>Out</th><th>Classification</th><th>Approval</th><th>Remarks</th></tr></thead>
                <tbody>
                  {filteredHistory.slice(0, 120).map((h) => {
                    const cls = h.classification.toLowerCase().includes("approved") ? "leave" : h.classification.toLowerCase().includes("unexcused") ? "absent" : h.classification.toLowerCase().includes("no record") ? "norecord" : "present";
                    return (
                      <tr key={h.date}>
                        <td>{h.date}</td><td>{h.day}</td>
                        <td style={{ textTransform: "capitalize" }}>{h.status || "—"}</td>
                        <td>{h.inTime || "—"}</td><td>{h.outTime || "—"}</td>
                        <td><span className={`hal-badge hal-badge--${cls}`}>{h.classification}</span></td>
                        <td>{h.approvalStatus ? <span className={`hal-badge hal-badge--${h.approvalStatus}`}>{h.approvalStatus}</span> : "—"}</td>
                        <td>{h.remarks || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredHistory.length > 120 && <div className="hal-empty">Showing the most recent 120 of {filteredHistory.length} records — narrow the filters above to see more precisely.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Root ─── */
export default function AnnualLeaveSummaryReport({ emps, depts, desigs, getDeptName, getDesigName, toast, onBack, branchId = 1 }) {
  const { sessions, currentSession } = useSettings();
  const [sessionId, setSessionId] = useState(currentSession?.id || null);
  const [tab, setTab] = useState("summary");
  const [empId, setEmpId] = useState(null);

  const session = useMemo(() => sessions.find((s) => s.id === sessionId) || currentSession, [sessions, sessionId, currentSession]);

  const employees = useMemo(() => emps.filter((e) => e.status === "Active").map((e) => ({
    id: e.id, eid: e.eid, name: `${e.firstName || ""} ${e.lastName || ""}`.trim(), deptName: getDeptName(e.dId), desigName: getDesigName(e.desId),
  })), [emps, getDeptName, getDesigName]);

  if (branchId !== 1) {
    return (
      <div className="hal-root">
        <style>{HAL_CSS}</style>
        <div className="hal-empty"><i className="fa-solid fa-lock"></i>This report is only available for the main branch.</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="hal-root">
        <style>{HAL_CSS}</style>
        <div className="hal-empty"><i className="fa-solid fa-calendar-xmark"></i>No academic session is configured yet — set one up in Settings → Session Management first.</div>
      </div>
    );
  }

  return (
    <div className="section-card">
      <style>{HAL_CSS}</style>
      <div className="hal-back-row">
        <button type="button" className="hal-back-btn" onClick={onBack}><i className="fa-solid fa-arrow-left"></i> Back to Reports</button>
      </div>
      <div className="hal-filters" style={{ marginBottom: 14 }}>
        <div className="hal-filter-row">
          <div className="hal-field">
            <span className="hal-label">Academic Year / Session</span>
            <select className="hal-select" value={session.id} onChange={(e) => setSessionId(Number(e.target.value))}>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}{s.status === "current" ? " (Current)" : ""}</option>)}
            </select>
          </div>
          <div className="hal-field">
            <span className="hal-label">Session Dates</span>
            <div className="hal-input" style={{ background: "var(--bg-muted,#F8FAFF)" }}>{formatDate(session.startDate)} → {formatDate(session.endDate)}</div>
          </div>
        </div>
      </div>

      <div className="hal-tabs" style={{ marginBottom: 14 }}>
        <button type="button" className={`hal-tab${tab === "summary" ? " active" : ""}`} onClick={() => setTab("summary")}>Annual Leave Summary — All Employees</button>
        <button type="button" className={`hal-tab${tab === "individual" ? " active" : ""}`} onClick={() => setTab("individual")}>Individual Employee Statement</button>
      </div>

      {tab === "summary" ? (
        <AllEmployeesTab
          depts={depts}
          sessionStart={session.startDate}
          sessionEnd={session.endDate}
          toast={toast}
          onViewDetails={(id) => { setEmpId(id); setTab("individual"); }}
        />
      ) : (
        <IndividualStatementTab
          employees={employees}
          sessionStart={session.startDate}
          sessionEnd={session.endDate}
          empId={empId}
          onEmpIdChange={setEmpId}
          toast={toast}
        />
      )}
    </div>
  );
}
