import { useState, useEffect, useCallback, useId } from "react";

/**
 * The site-wide "Contact Us" form.
 *
 *  • <ContactForm />        — the form itself (used inline on the Contact page)
 *  • <DemoRequestModal />   — the same form in a popup; mounted once at App root
 *  • openDemoForm(source)   — opens the popup from anywhere (every "Book a Free
 *                             Demo" button on the site calls this)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EMAIL DELIVERY — READ THIS TO SWITCH IT ON
 * ─────────────────────────────────────────────────────────────────────────────
 * Submissions POST straight to the inbox below. Get a free access key at
 * https://web3forms.com — enter the destination address, they email you a key,
 * paste it into ACCESS_KEY. Nothing else to set up (no server, no signup).
 *
 * Until ACCESS_KEY is filled in, the form falls back to opening a prefilled
 * email in the visitor's mail client so no lead is ever lost.
 */

const ACCESS_KEY = "";                       // ← paste your Web3Forms access key here
const INBOX = "info@schoolmentor.ai";        // ← dedicated inbox that receives leads

const DEMO_FORM_EVENT = "sm:open-demo-form";

export function openDemoForm(source = "") {
  window.dispatchEvent(new CustomEvent(DEMO_FORM_EVENT, { detail: { source } }));
}

const CITIES = ["Islamabad", "Lahore", "Karachi", "Rawalpindi", "Other"];
const SIZES = ["Under 300", "300–700", "700–1500", "1500+"];
const INQUIRIES = ["Demo Request", "Pricing", "Support", "Training", "General"];

const emptyForm = (inquiry = "") => ({
  name: "", school: "", phone: "", email: "",
  city: "", students: "", inquiry, message: "",
});

const FORM_CSS = `
  @keyframes smFormFade { from { opacity: 0 } to { opacity: 1 } }
  @keyframes smFormRise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
  @keyframes smFormSpin { to { transform: rotate(360deg) } }
  .sm-form-field:focus {
    border-color: var(--sm-teal) !important;
    box-shadow: 0 0 0 3px var(--sm-navy-tint);
    background: var(--sm-surface) !important;
  }
  .sm-form-field::placeholder { color: var(--sm-text-muted); }
  .sm-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 20px; }
  .sm-form-full { grid-column: 1 / -1; }
  .sm-form-submit:disabled { opacity: .65; cursor: default; }
  @media (max-width: 640px) { .sm-form-grid { grid-template-columns: 1fr; } }
`;

const fieldStyle = (err) => ({
  padding: "12px 16px",
  border: `1.5px solid ${err ? "var(--sm-red)" : "var(--sm-border)"}`,
  borderRadius: 10,
  fontSize: 15,
  fontFamily: "inherit",
  color: "var(--sm-text)",
  background: "var(--sm-surface-alt)",
  outline: "none",
  width: "100%",
});

const labelStyle = { fontSize: 14, fontWeight: 600, color: "var(--sm-navy)" };
const errStyle = { fontSize: 12.5, color: "var(--sm-red)" };
const cellStyle = { display: "flex", flexDirection: "column", gap: 8 };

// ── The form ──────────────────────────────────────────────────────────────────
export function ContactForm({
  source = "",
  defaultInquiry = "",
  submitLabel = "Send Message →",
  onDone,
  padding = "0",
}) {
  const uid = useId();
  const [form, setForm] = useState(() => emptyForm(defaultInquiry));
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => (er[k] ? { ...er, [k]: "" } : er));
  };

  const validate = () => {
    const er = {};
    if (!form.name.trim()) er.name = "Please enter your name";
    if (!form.school.trim()) er.school = "Please enter your school name";
    if (!/^[+\d][\d\s()-]{7,}$/.test(form.phone.trim())) er.phone = "Enter a valid phone number";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) er.email = "Enter a valid email address";
    setErrors(er);
    return Object.keys(er).length === 0;
  };

  // Plain-text version of the submission, used for the email body and as the
  // mail-client fallback when no access key is configured.
  const asText = () => [
    `Name: ${form.name.trim()}`,
    `School: ${form.school.trim()}`,
    `Phone: ${form.phone.trim()}`,
    `Email: ${form.email.trim()}`,
    `City: ${form.city || "—"}`,
    `Number of Students: ${form.students || "—"}`,
    `Inquiry Type: ${form.inquiry || "—"}`,
    "",
    "Message:",
    form.message.trim() || "—",
    "",
    source ? `Submitted from: ${source}` : "",
  ].filter(Boolean).join("\n");

  const subject = () =>
    `${form.inquiry || "Website Enquiry"} — ${form.school.trim() || form.name.trim()}`;

  const openMailFallback = () => {
    const url =
      "https://mail.google.com/mail/?view=cm&fs=1" +
      `&to=${encodeURIComponent(INBOX)}` +
      `&su=${encodeURIComponent(subject())}` +
      `&body=${encodeURIComponent(asText())}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (status === "sending") return;
    if (!validate()) return;

    // No key configured yet → hand off to the visitor's mail client.
    if (!ACCESS_KEY) {
      openMailFallback();
      setStatus("sent");
      return;
    }

    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: subject(),
          from_name: "SchoolMentor Website",
          replyto: form.email.trim(),
          "Name": form.name.trim(),
          "School": form.school.trim(),
          "Phone": form.phone.trim(),
          "Email": form.email.trim(),
          "City": form.city || "—",
          "Number of Students": form.students || "—",
          "Inquiry Type": form.inquiry || "—",
          "Message": form.message.trim() || "—",
          "Submitted From": source || "Website",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setStatus("sent");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div style={{ padding: "40px 4px", textAlign: "center" }}>
        <style>{FORM_CSS}</style>
        <div style={{
          width: 62, height: 62, borderRadius: "50%", margin: "0 auto 18px",
          background: "var(--sm-teal-light)", color: "var(--sm-navy)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
        }}>
          <i className="fa-solid fa-check" aria-hidden="true" />
        </div>
        <h4 style={{ margin: "0 0 8px", fontSize: 20, color: "var(--sm-navy)", fontFamily: "'DM Sans', sans-serif" }}>
          {ACCESS_KEY ? "Thank you — we've got your details" : "Almost there — hit send in the email window"}
        </h4>
        <p style={{ margin: "0 auto 22px", maxWidth: 430, fontSize: 14.5, color: "var(--sm-text-soft)", lineHeight: 1.6 }}>
          {ACCESS_KEY
            ? <>Our team will get back to you within 24 hours. In a hurry? WhatsApp us at <strong>+92 370 0036867</strong>.</>
            : <>We opened a prefilled email with your details — press send and our team will reply within 24 hours. Prefer WhatsApp? <strong>+92 370 0036867</strong>.</>}
        </p>
        <button
          type="button"
          onClick={() => {
            if (onDone) onDone();
            else { setForm(emptyForm(defaultInquiry)); setStatus("idle"); }
          }}
          style={{
            padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "var(--sm-teal)", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit",
          }}
        >
          Done
        </button>
      </div>
    );
  }

  const textField = (key, label, extra = {}) => (
    <div style={cellStyle}>
      <label style={labelStyle} htmlFor={`${uid}-${key}`}>{label}</label>
      <input
        id={`${uid}-${key}`}
        className="sm-form-field"
        style={fieldStyle(errors[key])}
        value={form[key]}
        onChange={set(key)}
        {...extra}
      />
      {errors[key] && <span style={errStyle}>{errors[key]}</span>}
    </div>
  );

  const selectField = (key, label, options) => (
    <div style={cellStyle}>
      <label style={labelStyle} htmlFor={`${uid}-${key}`}>{label}</label>
      <select id={`${uid}-${key}`} className="sm-form-field" style={fieldStyle(false)} value={form[key]} onChange={set(key)}>
        <option value="">Select</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate style={{ padding }}>
      <style>{FORM_CSS}</style>
      <div className="sm-form-grid">

        {textField("name", "Your Name *", { placeholder: "e.g. Ahmed Hassan", autoComplete: "name" })}
        {textField("school", "School Name *", { placeholder: "e.g. Lahore Grammar School" })}
        {textField("phone", "Phone Number *", { type: "tel", placeholder: "+92 300 0000000", autoComplete: "tel" })}
        {textField("email", "Email Address *", { type: "email", placeholder: "you@school.edu.pk", autoComplete: "email" })}

        {selectField("city", "City", CITIES)}
        {selectField("students", "Number of Students", SIZES)}
        {selectField("inquiry", "Inquiry Type", INQUIRIES)}

        <div className="sm-form-full" style={cellStyle}>
          <label style={labelStyle} htmlFor={`${uid}-message`}>Message (optional)</label>
          <textarea
            id={`${uid}-message`} className="sm-form-field" rows={4}
            style={{ ...fieldStyle(false), resize: "vertical" }}
            value={form.message} onChange={set("message")}
            placeholder="Tell us about your school and what you're looking for..."
          />
        </div>

        {status === "error" && (
          <div className="sm-form-full" style={{
            padding: "12px 16px", borderRadius: 10, fontSize: 14,
            background: "var(--sm-navy-tint)", color: "var(--sm-red)",
          }}>
            Something went wrong sending your message.{" "}
            <button
              type="button"
              onClick={() => { openMailFallback(); setStatus("sent"); }}
              style={{ background: "none", border: "none", padding: 0, color: "var(--sm-navy)", fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}
            >
              Send it by email instead
            </button>{" "}
            or WhatsApp us at +92 370 0036867.
          </div>
        )}

        <div className="sm-form-full" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginTop: 4 }}>
          <button
            type="submit"
            className="sm-form-submit"
            disabled={status === "sending"}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 32px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "var(--sm-teal)", color: "#fff", fontSize: 16, fontWeight: 600, fontFamily: "inherit",
            }}
          >
            {status === "sending" && (
              <span style={{
                width: 15, height: 15, borderRadius: "50%", display: "inline-block",
                border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff",
                animation: "smFormSpin .7s linear infinite",
              }} />
            )}
            {status === "sending" ? "Sending…" : submitLabel}
          </button>
          <span style={{ fontSize: 13, color: "var(--sm-text-muted)" }}>
            We reply within 24 hours. Your details are never shared.
          </span>
        </div>

      </div>
    </form>
  );
}

// ── The popup ─────────────────────────────────────────────────────────────────
export default function DemoRequestModal() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onOpen = (e) => { setSource(e.detail?.source || ""); setOpen(true); };
    window.addEventListener(DEMO_FORM_EVENT, onOpen);
    return () => window.removeEventListener(DEMO_FORM_EVENT, onOpen);
  }, []);

  // Esc to close + lock background scroll while the dialog is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sm-form-title"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(8, 20, 40, 0.55)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "clamp(12px, 4vh, 48px) 16px", overflowY: "auto",
        animation: "smFormFade .2s ease",
      }}
    >
      <style>{FORM_CSS}</style>
      <div
        style={{
          width: "100%", maxWidth: 760, background: "var(--sm-surface)",
          borderRadius: 18, border: "1px solid var(--sm-border)",
          boxShadow: "0 24px 60px rgba(8,20,40,.35)", overflow: "hidden",
          animation: "smFormRise .28s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div style={{ padding: "22px 28px", background: "var(--sm-navy)", color: "#fff", position: "relative" }}>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              position: "absolute", top: 16, right: 16, width: 34, height: 34,
              borderRadius: "50%", border: "none", cursor: "pointer",
              background: "rgba(255,255,255,.15)", color: "#fff", fontSize: 16, lineHeight: 1,
            }}
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
          <div style={{ fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", opacity: .75, marginBottom: 6 }}>
            Free · No Obligation
          </div>
          <h3 id="sm-form-title" style={{ margin: 0, fontSize: 22, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            Book Your Free Demo
          </h3>
          <p style={{ margin: "6px 0 0", fontSize: 14, opacity: .85 }}>
            Fill in your details and our team will get back to you within 24 hours.
          </p>
        </div>

        <div style={{ padding: "26px 28px 30px" }}>
          <ContactForm
            source={source || "Book a Free Demo popup"}
            defaultInquiry="Demo Request"
            submitLabel="Book My Free Demo →"
            onDone={close}
          />
        </div>
      </div>
    </div>
  );
}
