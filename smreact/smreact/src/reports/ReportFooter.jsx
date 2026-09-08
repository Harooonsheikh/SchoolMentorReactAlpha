const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const ReportFooter = ({
  schoolName = "",
  address = "",
  isBW = false,
}) => {
  const borderColor = isBW
    ? "#000000"
    : "#CBD5E1";

  const textColor = isBW
    ? "#000000"
    : "#64748B";

  return `
    <footer
      class="standard-report-footer"
      style="
        margin-top:auto;
        padding:12px 32px 16px;
      "
    >
      <div
        style="
          border-top:1px solid ${borderColor};
          padding-top:10px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:20px;
          font-size:8.5px;
          color:${textColor};
        "
      >
        <div
          style="
            flex:1;
            min-width:0;
          "
        >
          <strong>
            ${escapeHtml(schoolName)}
          </strong>

          ${
            address
              ? `
                <span>
                  &nbsp;•&nbsp;
                  ${escapeHtml(address)}
                </span>
              `
              : ""
          }
        </div>

        <div
          style="
            white-space:nowrap;
            text-align:center;
          "
        >
          Powered by
          <strong> School Mentor ERP</strong>
        </div>

        <div
          style="
            white-space:nowrap;
            text-align:right;
          "
        >
          Page
          <span class="page-number"></span>
        </div>
      </div>
    </footer>
  `;
};

export default ReportFooter;