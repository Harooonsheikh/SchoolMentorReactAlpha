import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";

import {
  fetchReportHeader,
  resolveAcademicSession,
} from "../utils/pdfReports";

/* ---------------------------------------------
   BASIC HELPERS
--------------------------------------------- */

const escapeHtml = (value = "") => {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const getDateTime = () => {
  const now = new Date();

  return {
    date: now.toLocaleDateString("en-PK", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),

    time: now.toLocaleTimeString("en-PK", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

const safeFileName = (name = "Report") => {
  return name
    .replace(/[<>:"/\\|?*]+/g, "")
    .replace(/\s+/g, "_");
};

/* ---------------------------------------------
   META BAR
--------------------------------------------- */

const buildMetaBar = (
  items = [],
  isBW = false
) => {
  if (!items?.length) return "";

  return `
    <div
      style="
        margin:18px 32px 0;
        display:grid;
        grid-template-columns:repeat(${Math.min(
          items.length,
          4
        )},1fr);
        gap:8px;
      "
    >
      ${items
        .map(
          (item) => `
            <div
              style="
                padding:10px 12px;
                border-radius:${isBW ? "3px" : "9px"};
                border:1px solid ${
                  isBW ? "#777777" : "#DBEAFE"
                };
                background:${
                  isBW ? "#FFFFFF" : "#F8FAFC"
                };
              "
            >
              <div
                style="
                  font-size:8px;
                  font-weight:800;
                  text-transform:uppercase;
                  letter-spacing:.7px;
                  color:${
                    isBW ? "#444" : "#64748B"
                  };
                  margin-bottom:3px;
                "
              >
                ${escapeHtml(item.label)}
              </div>

              <div
                style="
                  font-size:11px;
                  font-weight:800;
                  color:${
                    isBW ? "#000" : "#0F172A"
                  };
                "
              >
                ${escapeHtml(item.value ?? "—")}
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
};

/* ---------------------------------------------
   SECTION TITLE
--------------------------------------------- */

const buildSectionTitle = (
  title,
  isBW = false
) => {
  if (!title) return "";

  return `
    <div
      style="
        margin:20px 32px 10px;
        display:flex;
        align-items:center;
        gap:9px;
      "
    >
      <div
        style="
          width:4px;
          height:18px;
          border-radius:10px;
          background:${
            isBW ? "#000000" : "#1E40AF"
          };
        "
      ></div>

      <div
        style="
          font-size:12px;
          font-weight:800;
          color:${
            isBW ? "#000000" : "#0F172A"
          };
        "
      >
        ${escapeHtml(title)}
      </div>
    </div>
  `;
};

/* ---------------------------------------------
   TABLE
--------------------------------------------- */

const buildTable = ({
  columns = [],
  rows = [],
  isBW = false,
}) => {
  return `
    <div
      style="
        margin:0 32px 24px;
        border:1px solid ${
          isBW ? "#666666" : "#E2E8F0"
        };
        border-radius:${isBW ? "0" : "10px"};
        overflow:hidden;
      "
    >
      <table
        style="
          width:100%;
          border-collapse:collapse;
          table-layout:auto;
        "
      >
        <thead>
          <tr>
            ${columns
              .map(
                (column) => `
                  <th
                    style="
                      padding:9px 10px;
                      text-align:${
                        column.align || "left"
                      };
                      font-size:8.5px;
                      font-weight:800;
                      letter-spacing:.4px;
                      text-transform:uppercase;
                      color:${
                        isBW
                          ? "#000000"
                          : "#1E3A8A"
                      };
                      background:${
                        isBW
                          ? "#FFFFFF"
                          : "#EFF6FF"
                      };
                      border-bottom:${
                        isBW
                          ? "2px solid #000"
                          : "1px solid #BFDBFE"
                      };
                      ${
                        column.width
                          ? `width:${column.width};`
                          : ""
                      }
                    "
                  >
                    ${escapeHtml(column.label)}
                  </th>
                `
              )
              .join("")}
          </tr>
        </thead>

        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row, rowIndex) => `
                    <tr
                      style="
                        background:${
                          isBW
                            ? "#FFFFFF"
                            : rowIndex % 2 === 0
                            ? "#FFFFFF"
                            : "#F8FAFC"
                        };
                      "
                    >
                      ${columns
                        .map((column) => {
                          let value;

                          if (
                            typeof column.render ===
                            "function"
                          ) {
                            value = column.render(
                              row,
                              rowIndex
                            );
                          } else if (
                            column.key === "sr"
                          ) {
                            value = rowIndex + 1;
                          } else {
                            value =
                              row?.[column.key] ??
                              "—";
                          }

                          return `
                            <td
                              style="
                                padding:9px 10px;
                                text-align:${
                                  column.align ||
                                  "left"
                                };
                                font-size:9px;
                                line-height:1.45;
                                color:${
                                  isBW
                                    ? "#000000"
                                    : "#334155"
                                };
                                border-bottom:1px solid ${
                                  isBW
                                    ? "#CCCCCC"
                                    : "#E2E8F0"
                                };
                              "
                            >
                              ${
                                column.raw
                                  ? value ?? ""
                                  : escapeHtml(
                                      value ?? "—"
                                    )
                              }
                            </td>
                          `;
                        })
                        .join("")}
                    </tr>
                  `
                  )
                  .join("")
              : `
                <tr>
                  <td
                    colspan="${Math.max(
                      columns.length,
                      1
                    )}"
                    style="
                      padding:30px;
                      text-align:center;
                      font-size:10px;
                      color:#64748B;
                    "
                  >
                    No records found
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>
    </div>
  `;
};

/* ---------------------------------------------
   COMPLETE REPORT HTML
--------------------------------------------- */

export const buildStandardReport = async ({
  title = "Report",

  columns = [],

  rows = [],

  meta = [],

  sectionTitle = "",

  style = "color",

  schoolInfo = null,

  customContent = "",

  orientation = "portrait",
}) => {
  const isBW = style === "bw";

  let branch = null;

  try {
    branch = await fetchReportHeader();
  } catch (error) {
    console.error(
      "Could not load report header:",
      error
    );
  }

  const { date, time } = getDateTime();

  const schoolName =
    branch?.branchName ||
    schoolInfo?.schoolName ||
    schoolInfo?.name ||
    "School";

  const address =
    branch?.address ||
    schoolInfo?.address ||
    "";

  const academicSession =
    resolveAcademicSession(branch) ||
    schoolInfo?.academicSession ||
    "";

  const header = ReportHeader({
    schoolName,
    reportTitle: title,
    branch,
    academicSession,
    generatedDate: date,
    generatedTime: time,
    isBW,
  });

  const footer = ReportFooter({
    schoolName,
    address,
    isBW,
  });

  const metaHtml = buildMetaBar(
    meta,
    isBW
  );

  const sectionHtml = buildSectionTitle(
    sectionTitle,
    isBW
  );

  const tableHtml = buildTable({
    columns,
    rows,
    isBW,
  });

  return `
    <!DOCTYPE html>

    <html>
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <title>
          ${escapeHtml(title)}
        </title>

        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />

        <style>
          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
          }

          body {
            font-family:
              "Plus Jakarta Sans",
              Arial,
              sans-serif;

            background: #ffffff;

            color: ${
              isBW ? "#000000" : "#0F172A"
            };
          }

          .report-page {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: #ffffff;

            display: flex;
            flex-direction: column;
          }

          table {
            page-break-inside: auto;
          }

          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }

          thead {
            display: table-header-group;
          }

          tfoot {
            display: table-footer-group;
          }

          img {
            max-width: 100%;
          }

          @page {
            size: A4 ${orientation};
            margin: 0;
          }

          @media print {
            html,
            body {
              width: 100%;
              background: #ffffff;
            }

            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .report-page {
              margin: 0;
              width: 100%;
              min-height: 100vh;
            }

            .standard-report-header {
              page-break-inside: avoid;
            }

            .standard-report-footer {
              page-break-inside: avoid;
            }
          }
        </style>
      </head>

      <body>
        <div class="report-page">

          ${header}

          ${metaHtml}

          ${sectionHtml}

          ${
            customContent ||
            tableHtml
          }

          ${footer}

        </div>
      </body>
    </html>
  `;
};

/* ---------------------------------------------
   PDF / PRINT
--------------------------------------------- */

const openPDF = (
  html,
  title = "Report"
) => {
  const printWindow = window.open(
    "",
    "_blank",
    "width=1000,height=800,scrollbars=yes"
  );

  if (!printWindow) {
    throw new Error(
      "Popup blocked. Please allow popups for this website."
    );
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.document.title = title;

      printWindow.focus();

      printWindow.print();
    }, 500);
  };
};

/* ---------------------------------------------
   WORD EXPORT
--------------------------------------------- */

const downloadWord = (
  html,
  fileName
) => {
  /*
    This generates a Word-compatible .doc file.

    Word opens this normally and the report
    keeps most HTML formatting.

    A genuine .docx package requires a DOCX
    library such as "docx".
  */

  const wordHtml = `
    <html
      xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40"
    >
      <head>
        <meta charset="utf-8" />
      </head>

      <body>
        ${html}
      </body>
    </html>
  `;

  const blob = new Blob(
    ["\ufeff", wordHtml],
    {
      type:
        "application/msword;charset=utf-8",
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    `${safeFileName(fileName)}.doc`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

/* ---------------------------------------------
   MAIN DOWNLOAD FUNCTION
--------------------------------------------- */

export const downloadStandardReport = async ({
  title = "Report",

  columns = [],

  rows = [],

  meta = [],

  sectionTitle = "",

  style = "color",

  format = "pdf",

  schoolInfo = null,

  customContent = "",

  orientation = "portrait",
}) => {
  const html =
    await buildStandardReport({
      title,
      columns,
      rows,
      meta,
      sectionTitle,
      style,
      schoolInfo,
      customContent,
      orientation,
    });

  if (format === "word") {
    downloadWord(
      html,
      title
    );

    return;
  }

  openPDF(
    html,
    title
  );
};

export default downloadStandardReport;