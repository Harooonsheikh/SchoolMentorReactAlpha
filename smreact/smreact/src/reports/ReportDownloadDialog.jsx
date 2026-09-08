import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function ReportDownloadDialog({
  open,
  reportName = "Report",
  initialFormat = "pdf",
  onClose,
  onGenerate,
    filtersContent = null,

}) {
  const [style, setStyle] = useState("color");
  const [format, setFormat] = useState("pdf");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setStyle("color");
      setFormat(initialFormat || "pdf");
      setBusy(false);
    }
  }, [open, initialFormat]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const downloadLabel = `Download ${
    style === "color" ? "Colorful" : "Colorless"
  } ${format === "pdf" ? "PDF" : "Word"}`;

  const onStyleKey = (e, value) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      setStyle(value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setStyle("color");
    } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setStyle("bw");
    }
  };

  const handleGenerate = async () => {
    if (busy) return;

    setBusy(true);

    try {
      await onGenerate?.({
        style,
        format,
        isColor: style === "color",
      });
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <style>{`
        .report-picker-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10,22,40,.5);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .report-picker {
          background: #FFFFFF;
          border-radius: 24px;
          width: 100%;
          max-width: 460px;
          border: 1px solid #E2E8F0;
          box-shadow:
            0 24px 60px rgba(15,23,42,.22),
            0 8px 20px rgba(15,23,42,.10);
          animation: rpModalIn .28s cubic-bezier(.34,1.26,.64,1) both;
          overflow: hidden;
          font-family: 'Segoe UI', Arial, sans-serif;
        }

        @keyframes rpModalIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(.97);
          }

          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .rp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 22px 24px 18px;
          border-bottom: 1px solid #E2E8F0;
          background: linear-gradient(
            135deg,
            rgba(30,58,138,.03),
            transparent
          );
        }

        .rp-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .rp-header-icon {
          width: 40px;
          height: 40px;
          border-radius: 11px;
          background: linear-gradient(135deg,#DBEAFE,#BFDBFE);
          color: #1E40AF;
          font-size: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .rp-title {
          font-size: 16px;
          font-weight: 800;
          color: #0F172A;
          letter-spacing: -.01em;
        }

        .rp-sub {
          font-size: 11.5px;
          color: #64748B;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 315px;
        }

        .rp-close {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          border: none;
          background: #F1F5F9;
          color: #64748B;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 12px;
          transition: .2s ease;
          flex-shrink: 0;
        }

        .rp-close:hover {
          background: rgba(220,38,38,.1);
          color: #DC2626;
        }

        .rp-body {
          padding: 22px 24px 20px;
        }

        .rp-section-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #64748B;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .rp-section-label::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #E2E8F0;
        }

        .rp-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }

        .rp-option {
          border: 2px solid #E2E8F0;
          border-radius: 16px;
          cursor: pointer;
          transition: all .2s cubic-bezier(.4,0,.2,1);
          background: #FFFFFF;
          overflow: hidden;
          position: relative;
        }

        .rp-option:hover {
          border-color: #CBD5E1;
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(15,23,42,.09);
        }

        .rp-option.selected {
          border-color: #1E40AF;
          box-shadow:
            0 0 0 3px rgba(30,58,138,.12),
            0 8px 18px rgba(15,23,42,.09);
          transform: translateY(-2px);
        }

        .rp-check {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg,#1E40AF,#1E3A8A);
          color: #FFFFFF;
          font-size: 9px;
          display: none;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(30,58,138,.4);
          z-index: 2;
        }

        .rp-option.selected .rp-check {
          display: flex;
        }

        .rp-preview {
          height: 110px;
          position: relative;
          overflow: hidden;
        }

        .rp-preview-color {
          width: 100%;
          height: 100%;
          background:
            linear-gradient(
              145deg,
              #1E3A8A 0%,
              #1E40AF 45%,
              #2563EB 100%
            );
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px;
          position: relative;
          overflow: hidden;
        }

        .rp-preview-color::before {
          content: "";
          position: absolute;
          top: -20px;
          right: -20px;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,.06);
        }

        .rp-preview-color::after {
          content: "";
          position: absolute;
          bottom: -15px;
          left: -10px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(14,165,233,.15);
        }

        .rp-mock-header {
          width: 80%;
          height: 7px;
          border-radius: 4px;
          background: rgba(255,255,255,.9);
          position: relative;
          z-index: 1;
        }

        .rp-mock-line {
          border-radius: 3px;
          background: rgba(255,255,255,.5);
          position: relative;
          z-index: 1;
        }

        .rp-mock-chips {
          display: flex;
          gap: 5px;
          position: relative;
          z-index: 1;
          margin-top: 2px;
        }

        .rp-mock-chip {
          width: 28px;
          height: 9px;
          border-radius: 4px;
        }

        .rp-preview-bw {
          width: 100%;
          height: 100%;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 14px;
          border-bottom: 1px solid #E5E7EB;
        }

        .rp-mock-header-bw {
          width: 80%;
          height: 7px;
          border-radius: 2px;
          background: #1F2937;
        }

        .rp-mock-line-bw {
          border-radius: 2px;
          background: #9CA3AF;
        }

        .rp-mock-chips-bw {
          display: flex;
          gap: 5px;
          margin-top: 2px;
        }

        .rp-mock-chip-bw {
          width: 28px;
          height: 9px;
          border-radius: 2px;
          background: transparent;
          border: 1px solid #9CA3AF;
        }

        .rp-option-text {
          padding: 12px 14px;
        }

        .rp-option-name {
          font-size: 13px;
          font-weight: 800;
          color: #0F172A;
          margin-bottom: 3px;
        }

        .rp-option-desc {
          font-size: 11px;
          color: #64748B;
          line-height: 1.45;
        }

        .rp-format-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 6px;
        }

        .rp-format-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 2px solid #E2E8F0;
          background: #F8FAFC;
          cursor: pointer;
          transition: .2s ease;
          text-align: left;
          font-family: inherit;
        }

        .rp-format-pill:hover {
          border-color: #CBD5E1;
          background: #FFFFFF;
        }

        .rp-format-pill.selected-pdf {
          border-color: #DC2626;
          background: rgba(220,38,38,.05);
        }

        .rp-format-pill.selected-word {
          border-color: #1E40AF;
          background: rgba(30,64,175,.05);
        }

        .rp-format-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .selected-pdf .rp-format-icon {
          background: rgba(220,38,38,.1);
          color: #DC2626;
        }

        .selected-word .rp-format-icon {
          background: rgba(30,64,175,.1);
          color: #1E40AF;
        }

        .rp-format-pill:not(.selected-pdf):not(.selected-word)
        .rp-format-icon {
          background: #FFFFFF;
          color: #64748B;
        }

        .rp-format-name {
          font-size: 13px;
          font-weight: 700;
          color: #0F172A;
        }

        .rp-format-desc {
          font-size: 10.5px;
          color: #64748B;
          margin-top: 1px;
        }

        .selected-pdf .rp-format-name {
          color: #DC2626;
        }

        .selected-word .rp-format-name {
          color: #1E40AF;
        }

        .rp-footer {
          display: grid;
          grid-template-columns: 1fr 1.6fr;
          gap: 10px;
          padding: 16px 24px 24px;
          border-top: 1px solid #E2E8F0;
        }

        .rp-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 46px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          transition: .2s ease;
        }

        .rp-btn.cancel {
          background: #F1F5F9;
          border: 1.5px solid #E2E8F0;
          color: #64748B;
        }

        .rp-btn.cancel:hover {
          background: #FFFFFF;
          color: #0F172A;
        }

        .rp-btn.go {
          background: linear-gradient(135deg,#1D4ED8,#1E3A8A);
          color: #FFFFFF;
          box-shadow:
            0 4px 14px rgba(30,58,138,.32),
            inset 0 1px 0 rgba(255,255,255,.2);
        }

        .rp-btn.go:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(30,58,138,.45);
        }

        .rp-btn.go:active {
          transform: scale(.97);
        }

        .rp-btn:disabled {
          opacity: .65;
          cursor: wait;
          transform: none !important;
        }

        .rp-option:focus-visible {
          outline: none;
          box-shadow:
            0 0 0 3px rgba(30,58,138,.18),
            0 8px 18px rgba(15,23,42,.09);
          border-color: #1E40AF;
        }

        @media (max-width:520px) {
          .rp-options,
          .rp-format-row {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .rp-footer {
            grid-template-columns: 1fr 1fr;
            padding: 14px 18px 18px;
          }

          .rp-header {
            padding: 18px 18px 14px;
          }

          .rp-body {
            padding: 18px 18px 16px;
          }

          .rp-btn {
            height: 42px;
            font-size: 13px;
          }
        }
      `}</style>

      <div
        className="report-picker-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rp-title"
      >
        <div className="report-picker">

          <div className="rp-header">
            <div className="rp-header-left">

              <div className="rp-header-icon">
                <i className="fa-solid fa-print"></i>
              </div>

              <div>
                <div className="rp-title" id="rp-title">
                  Download Report
                </div>

                <div className="rp-sub">
                  {reportName} — Choose style and format
                </div>
              </div>

            </div>

            <button
              type="button"
              className="rp-close"
              onClick={onClose}
              aria-label="Close download dialog"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="rp-body">
   {filtersContent && (
    <>
      <div className="rp-section-label">
        Report Filters
      </div>

      <div style={{ marginBottom: 18 }}>
        {filtersContent}
      </div>
    </>
  )}
            <div
              className="rp-section-label"
              id="rp-style-label"
            >
              Report Style
            </div>

            <div
              className="rp-options"
              role="radiogroup"
              aria-labelledby="rp-style-label"
            >

              <div
                className={`rp-option${
                  style === "color" ? " selected" : ""
                }`}
                onClick={() => setStyle("color")}
                role="radio"
                aria-checked={style === "color"}
                tabIndex={style === "color" ? 0 : -1}
                onKeyDown={(e) => onStyleKey(e, "color")}
              >
                <div className="rp-check">
                  <i className="fa-solid fa-check"></i>
                </div>

                <div className="rp-preview">
                  <div className="rp-preview-color">

                    <div className="rp-mock-header"></div>

                    <div
                      className="rp-mock-line"
                      style={{
                        width: "65%",
                        height: 5,
                      }}
                    ></div>

                    <div
                      className="rp-mock-line"
                      style={{
                        width: "50%",
                        height: 5,
                      }}
                    ></div>

                    <div className="rp-mock-chips">

                      <div
                        className="rp-mock-chip"
                        style={{
                          background: "rgba(255,255,255,.85)",
                        }}
                      ></div>

                      <div
                        className="rp-mock-chip"
                        style={{
                          background: "#FCD34D",
                        }}
                      ></div>

                      <div
                        className="rp-mock-chip"
                        style={{
                          background: "#FCA5A5",
                        }}
                      ></div>

                    </div>
                  </div>
                </div>

                <div className="rp-option-text">

                  <div className="rp-option-name">
                    <i
                      className="fa-solid fa-palette"
                      style={{
                        color: "#1E40AF",
                        marginRight: 6,
                        fontSize: 12,
                      }}
                    ></i>

                    Colorful Report
                  </div>

                  <div className="rp-option-desc">
                    Full brand palette, summary cards,
                    colored headers &amp; icons
                  </div>

                </div>
              </div>

              <div
                className={`rp-option${
                  style === "bw" ? " selected" : ""
                }`}
                onClick={() => setStyle("bw")}
                role="radio"
                aria-checked={style === "bw"}
                tabIndex={style === "bw" ? 0 : -1}
                onKeyDown={(e) => onStyleKey(e, "bw")}
              >
                <div className="rp-check">
                  <i className="fa-solid fa-check"></i>
                </div>

                <div className="rp-preview">
                  <div className="rp-preview-bw">

                    <div className="rp-mock-header-bw"></div>

                    <div
                      className="rp-mock-line-bw"
                      style={{
                        width: "65%",
                        height: 5,
                      }}
                    ></div>

                    <div
                      className="rp-mock-line-bw"
                      style={{
                        width: "50%",
                        height: 5,
                      }}
                    ></div>

                    <div className="rp-mock-chips-bw">
                      <div className="rp-mock-chip-bw"></div>
                      <div className="rp-mock-chip-bw"></div>
                      <div className="rp-mock-chip-bw"></div>
                    </div>

                  </div>
                </div>

                <div className="rp-option-text">

                  <div className="rp-option-name">
                    <i
                      className="fa-solid fa-circle-half-stroke"
                      style={{
                        color: "#64748B",
                        marginRight: 6,
                        fontSize: 12,
                      }}
                    ></i>

                    Colorless Report
                  </div>

                  <div className="rp-option-desc">
                    Low-ink layout — white background,
                    light borders, no colored blocks
                  </div>

                </div>
              </div>

            </div>

            <div className="rp-section-label">
              File Format
            </div>

            <div className="rp-format-row">

              <button
                type="button"
                className={`rp-format-pill${
                  format === "pdf"
                    ? " selected-pdf"
                    : ""
                }`}
                onClick={() => setFormat("pdf")}
              >
                <div className="rp-format-icon">
                  <i className="fa-solid fa-file-pdf"></i>
                </div>

                <div>
                  <div className="rp-format-name">
                    PDF
                  </div>

                  <div className="rp-format-desc">
                    Best for sharing
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={`rp-format-pill${
                  format === "word"
                    ? " selected-word"
                    : ""
                }`}
                onClick={() => setFormat("word")}
              >
                <div className="rp-format-icon">
                  <i className="fa-brands fa-microsoft"></i>
                </div>

                <div>
                  <div className="rp-format-name">
                    Word (.docx)
                  </div>

                  <div className="rp-format-desc">
                    Best for editing
                  </div>
                </div>
              </button>

            </div>
          </div>

          <div className="rp-footer">

            <button
              type="button"
              className="rp-btn cancel"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>

            <button
              type="button"
              className="rp-btn go"
              onClick={handleGenerate}
              disabled={busy}
            >
              <i
                className={
                  busy
                    ? "fa-solid fa-spinner fa-spin"
                    : "fa-solid fa-download"
                }
              ></i>

              <span>
                {busy
                  ? "Preparing..."
                  : downloadLabel}
              </span>
            </button>

          </div>

        </div>
      </div>
    </>,
    document.body
  );
}