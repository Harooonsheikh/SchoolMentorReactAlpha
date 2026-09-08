import { resolveMediaUrl } from "../utils/apiConfig";

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const ReportHeader = ({
  schoolName = "School Mentor ERP",
  reportTitle = "Report",
  branch = null,
  academicSession = "",
  generatedDate = "",
  generatedTime = "",
  format = "PDF",
  isBW = false,
}) => {
  const headerBg = isBW ? "#FFFFFF" : "#1E3A8A";
  const headerFg = isBW ? "#111111" : "#FFFFFF";

  const headerSubFg = isBW
    ? "#4B5563"
    : "rgba(255,255,255,.75)";

  const headerKick = isBW
    ? "#6B7280"
    : "rgba(255,255,255,.55)";

  const dividerColor = isBW
    ? "#E5E7EB"
    : "rgba(255,255,255,.20)";

  const chipBg = isBW
    ? "transparent"
    : "rgba(255,255,255,.14)";

  const chipBorder = isBW
    ? "#D1D5DB"
    : "transparent";

  const logoUrl = branch?.branchLogo
    ? resolveMediaUrl(branch.branchLogo)
    : null;

  const logo = logoUrl
    ? `
      <img
        src="${escapeHtml(logoUrl)}"
        alt="School Logo"
        width="${isBW ? "56" : "64"}"
        height="${isBW ? "56" : "64"}"
        style="
          width:${isBW ? "56px" : "64px"};
          height:${isBW ? "56px" : "64px"};
          border-radius:${isBW ? "12px" : "16px"};
          object-fit:cover;
          display:block;
          ${
            isBW
              ? "border:1.5px solid #E5E7EB;"
              : `
                box-shadow:
                  0 4px 18px rgba(0,0,0,.35),
                  0 0 0 2px rgba(255,255,255,.15);
              `
          }
        "
        onerror="this.style.display='none'"
      />
    `
    : `
      <div
        style="
          width:${isBW ? "56px" : "64px"};
          height:${isBW ? "56px" : "64px"};
          border-radius:${isBW ? "12px" : "16px"};
          display:flex;
          align-items:center;
          justify-content:center;
          flex-shrink:0;
          font-size:14px;
          font-weight:900;
          ${
            isBW
              ? `
                background:#FFFFFF;
                color:#1F2937;
                border:1.5px solid #1F2937;
              `
              : `
                background:rgba(255,255,255,.12);
                color:#FFFFFF;
                border:1px solid rgba(255,255,255,.20);
              `
          }
        "
      >
        SM
      </div>
    `;

  const generatedText = generatedDate
    ? `${escapeHtml(generatedDate)}${
        generatedTime
          ? ` • ${escapeHtml(generatedTime)}`
          : ""
      }`
    : "";

  if (isBW) {
    return `
      <header
        class="standard-report-header"
        style="
          background:${headerBg};
          padding:22px 32px;
          color:${headerFg};
          border-bottom:1px solid #D1D5DB;
        "
      >
        <div
          style="
            display:flex;
            align-items:center;
            gap:16px;
          "
        >
          ${logo}

          <div>
            <div
              style="
                font-size:9px;
                letter-spacing:2.5px;
                text-transform:uppercase;
                color:${headerKick};
                font-weight:700;
                margin-bottom:3px;
              "
            >
              School Mentor ERP
            </div>

            <div
              style="
                font-size:19px;
                font-weight:800;
                color:${headerFg};
                letter-spacing:-.02em;
                line-height:1.2;
              "
            >
              ${escapeHtml(schoolName)}
            </div>

            ${
              branch?.address
                ? `
                  <div
                    style="
                      font-size:10px;
                      margin-top:4px;
                      color:${headerSubFg};
                    "
                  >
                    ${escapeHtml(branch.address)}
                  </div>
                `
                : ""
            }
          </div>
        </div>

        <div
          style="
            height:1px;
            background:${dividerColor};
            margin:16px 0 14px;
          "
        ></div>

        <div
          style="
            font-size:21px;
            font-weight:800;
            letter-spacing:-.02em;
            margin-bottom:3px;
            color:${headerFg};
          "
        >
          ${escapeHtml(reportTitle)}
        </div>

        <div
          style="
            font-size:12.5px;
            color:${headerSubFg};
            margin-bottom:14px;
          "
        >
          ${
            academicSession
              ? `Academic Year ${escapeHtml(academicSession)}`
              : "Academic Year"
          }
          · Colorless Report
        </div>

        <div
          style="
            display:flex;
            gap:10px;
            flex-wrap:wrap;
          "
        >
          ${
            generatedText
              ? `
                <div
                  style="
                    background:${chipBg};
                    border:1px solid ${chipBorder};
                    padding:5px 12px;
                    border-radius:20px;
                    font-size:11px;
                  "
                >
                  <strong>Generated:</strong>
                  ${generatedText}
                </div>
              `
              : ""
          }

          <div
            style="
              background:${chipBg};
              border:1px solid ${chipBorder};
              padding:5px 12px;
              border-radius:20px;
              font-size:11px;
            "
          >
            <strong>Format:</strong>
            ${escapeHtml(String(format).toUpperCase())}
          </div>
        </div>
      </header>
    `;
  }

  return `
    <header
      class="standard-report-header"
      style="
        background:#1E3A8A;
        padding:24px 32px 28px;
        color:#FFFFFF;
        position:relative;
        overflow:hidden;
      "
    >
      <div
        style="
          position:absolute;
          top:-30px;
          right:-30px;
          width:140px;
          height:140px;
          border-radius:50%;
          background:rgba(255,255,255,.06);
        "
      ></div>

      <div
        style="
          position:absolute;
          bottom:-20px;
          left:120px;
          width:80px;
          height:80px;
          border-radius:50%;
          background:rgba(14,165,233,.15);
        "
      ></div>

      <div
        style="
          display:flex;
          align-items:center;
          gap:18px;
          position:relative;
          z-index:2;
        "
      >
        ${logo}

        <div>
          <div
            style="
              font-size:9px;
              letter-spacing:2.5px;
              text-transform:uppercase;
              color:${headerKick};
              font-weight:700;
              margin-bottom:3px;
            "
          >
            School Mentor ERP
          </div>

          <div
            style="
              font-size:20px;
              font-weight:800;
              color:#FFFFFF;
              letter-spacing:-.02em;
              line-height:1.2;
              text-shadow:0 1px 4px rgba(0,0,0,.2);
            "
          >
            ${escapeHtml(schoolName)}
          </div>

          ${
            branch?.address
              ? `
                <div
                  style="
                    font-size:10px;
                    margin-top:4px;
                    color:${headerSubFg};
                  "
                >
                  ${escapeHtml(branch.address)}
                </div>
              `
              : ""
          }
        </div>
      </div>

      <div
        style="
          height:1px;
          background:${dividerColor};
          margin:18px 0 16px;
          position:relative;
          z-index:2;
        "
      ></div>

      <div
        style="
          font-size:22px;
          font-weight:800;
          letter-spacing:-.02em;
          margin-bottom:4px;
          position:relative;
          z-index:2;
        "
      >
        ${escapeHtml(reportTitle)}
      </div>

      <div
        style="
          font-size:13px;
          color:${headerSubFg};
          margin-bottom:16px;
          position:relative;
          z-index:2;
        "
      >
        ${
          academicSession
            ? `Academic Year ${escapeHtml(academicSession)}`
            : "Academic Year"
        }
        · Colorful Report
      </div>

      <div
        style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          position:relative;
          z-index:2;
        "
      >
        ${
          generatedText
            ? `
              <div
                style="
                  background:${chipBg};
                  border:1px solid ${chipBorder};
                  padding:6px 14px;
                  border-radius:20px;
                  font-size:11.5px;
                "
              >
                <strong>Generated:</strong>
                ${generatedText}
              </div>
            `
            : ""
        }

        <div
          style="
            background:${chipBg};
            border:1px solid ${chipBorder};
            padding:6px 14px;
            border-radius:20px;
            font-size:11.5px;
          "
        >
          <strong>Format:</strong>
          ${escapeHtml(String(format).toUpperCase())}
        </div>
      </div>
    </header>
  `;
};

export default ReportHeader;