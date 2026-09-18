import { useState, useRef, useEffect } from "react";

// ── Cards data ────────────────────────────────────────────────────
const CARDS = [
  [<i className="fa-solid fa-lock" />, "Smart & Secure Platform", "Cloud-based with role-based access control, data encryption, and 99.9% uptime guarantee.", "for-admin"],
  [<i className="fa-solid fa-handshake" />, "Professional Implementation", "Our team guides you through setup, configuration, and staff onboarding for smooth adoption.", "for-teachers"],
  [<i className="fa-solid fa-trophy" />, "Certified Processes", "Our workflows are built around proven academic and administrative best practices.", "for-parents"],
  [<i className="fa-solid fa-flag" />, "Built for Pakistan", "Designed specifically for Pakistani curricula, school systems, and the cultural context of education.", "for-students"],
];

// ── Mobile breakpoint hook ────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth <= bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

export default function AudienceCards({ s, T }) {
  const isMobile = useIsMobile();
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  // Track the nearest card while swiping
  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const itemW = el.scrollWidth / CARDS.length;
    const idx = Math.round(el.scrollLeft / itemW);
    setActive(Math.max(0, Math.min(idx, CARDS.length - 1)));
  };

  const scrollToDot = (i) => {
    const el = trackRef.current;
    if (!el) return;
    const itemW = el.scrollWidth / CARDS.length;
    el.scrollTo({ left: i * itemW, behavior: "smooth" });
    setActive(i);
  };

  // Card visual (shared by grid + slider)
  const renderCard = ([icon, title, desc]) => (
    <>
      <div
        className="why-card-icon"
        style={{
          width: 52, height: 52, borderRadius: 12,
          background: T.tealLight, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 24, color: T.navy,
        }}
      >
        {icon}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: T.navy, marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: T.gray500, lineHeight: 1.6, margin: 0 }}>
        {desc}
      </p>
    </>
  );

  return (
    <div style={s.section(false)}>
      <div style={s.sectionInner}>
        <div style={{ ...s.sectionLabel, textAlign: "center" }}>Why Us</div>
        <h2 style={{ ...s.sectionTitle(), textAlign: "center", fontSize: "clamp(18px,4vw,32px)", lineHeight: 1.2 }}>
          Why Choose SchoolMentor?
        </h2>

        <style>{`
          .why-cards-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            margin-top: 36px;
            align-items: stretch;
          }
          .why-card {
            text-align: left;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            background: var(--sm-surface);
            border: 1px solid var(--sm-border);
            border-radius: 14px;
            padding: 28px;
            box-shadow: 0 4px 14px rgba(30,58,95,0.07);
            transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
          }
          .why-card:hover {
            box-shadow: 0 14px 32px rgba(30,58,95,0.12);
            transform: translateY(-4px);
            border-color: var(--sm-gray300);
          }
          .why-card-icon {
            margin: 0 0 18px;
          }
          /* Tablet — balanced 2x2, cards fill the row */
          @media (max-width: 1024px) {
            .why-cards-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
            }
          }

          /* ── Mobile slider ── */
          .why-cards-slider {
            display: flex;
            gap: 16px;
            margin-top: 28px;
            padding: 4px 2px 8px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
          }
          .why-cards-slider::-webkit-scrollbar { display: none; }
          .why-slide {
            flex: 0 0 80%;
            max-width: 320px;
            scroll-snap-align: center;
          }
          .why-slide .why-card {
            padding: 22px;
          }
        `}</style>

        {isMobile ? (
          <>
            <div className="why-cards-slider" ref={trackRef} onScroll={onScroll}>
              {CARDS.map((card) => (
                <div key={card[3]} className="why-slide">
                  <div className="why-card">{renderCard(card)}</div>
                </div>
              ))}
            </div>

            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
              {CARDS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToDot(i)}
                  aria-label={`Go to card ${i + 1}`}
                  style={{
                    width: i === active ? 26 : 9,
                    height: 9,
                    borderRadius: i === active ? 5 : "50%",
                    background: i === active ? "linear-gradient(135deg,#3B82F6,#2563EB)" : "var(--sm-border)",
                    border: i === active ? "none" : "1.5px solid var(--sm-gray300)",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                    transition: "all .35s cubic-bezier(.22,.97,.47,1)",
                  }}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="why-cards-grid" data-sr-stagger>
            {CARDS.map((card) => (
              <div key={card[3]} className="why-card" data-sr>
                {renderCard(card)}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
