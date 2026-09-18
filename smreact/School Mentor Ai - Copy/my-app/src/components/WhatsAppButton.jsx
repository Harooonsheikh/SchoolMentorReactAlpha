import React from "react";

// Floating WhatsApp button — fixed to the bottom-right on every page.
const WHATSAPP_NUMBER = "923700036867"; // +92 370 0036867
const DEFAULT_MESSAGE = "Hi, I'd like to know more about School Mentor.";

const STYLES = `
.wa-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: 0 18px 0 10px;
  border-radius: 999px;
  background: #15703d;
  color: #ffffff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.wa-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(21, 112, 61, 0.5);
}
.wa-fab__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wa-fab__icon i {
  font-size: 30px;
  line-height: 1;
  color: #ffffff;
}

/* Tablets / small laptops */
@media (max-width: 768px) {
  .wa-fab { bottom: 20px; right: 20px; }
}

/* Phones — shrink a touch */
@media (max-width: 600px) {
  .wa-fab {
    bottom: 16px;
    right: 16px;
    height: 44px;
    font-size: 13px;
    padding: 0 16px 0 9px;
  }
  .wa-fab__icon i { font-size: 26px; }
}

/* Small phones — collapse to an icon-only circle */
@media (max-width: 420px) {
  .wa-fab {
    height: 52px;
    width: 52px;
    padding: 0;
    justify-content: center;
    gap: 0;
  }
  .wa-fab__label { display: none; }
  .wa-fab__icon i { font-size: 28px; }
}

/* Respect reduced-motion preferences */
@media (prefers-reduced-motion: reduce) {
  .wa-fab { transition: none; }
  .wa-fab:hover { transform: none; }
}
`;

export default function WhatsAppButton() {
  const href =
    `https://wa.me/${WHATSAPP_NUMBER}?text=` + encodeURIComponent(DEFAULT_MESSAGE);

  return (
    <>
      <style>{STYLES}</style>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with Support Team"
        className="wa-fab"
      >
        <span className="wa-fab__icon">
          <i className="fa-brands fa-whatsapp" aria-hidden="true" />
        </span>
        <span className="wa-fab__label">Chat with Support Team</span>
      </a>
    </>
  );
}
