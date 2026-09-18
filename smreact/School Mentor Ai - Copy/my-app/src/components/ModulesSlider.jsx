import { useState, useRef, useEffect } from "react";

// Renders a set of module cards: a responsive grid on tablet/desktop,
// and a horizontal swipe slider with dots on mobile (<=768px).
// `Card` is the per-tab ModuleCard component, so each service tab keeps
// its own card styling.
function useIsMobile(bp = 768) {
  const [m, setM] = useState(typeof window !== "undefined" ? window.innerWidth <= bp : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth <= bp);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, [bp]);
  return m;
}

export default function ModulesSlider({ modules, Card }) {
  const isMobile = useIsMobile();
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const itemW = el.scrollWidth / modules.length;
    setActive(Math.max(0, Math.min(Math.round(el.scrollLeft / itemW), modules.length - 1)));
  };
  const scrollToDot = (i) => {
    const el = trackRef.current;
    if (!el) return;
    const itemW = el.scrollWidth / modules.length;
    el.scrollTo({ left: i * itemW, behavior: "smooth" });
    setActive(i);
  };

  // Desktop / tablet — grid (unchanged behaviour)
  if (!isMobile) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, paddingBottom: 8 }}>
        {modules.map((mod, i) => <Card key={i} mod={mod} index={i} />)}
      </div>
    );
  }

  // Mobile — horizontal slider + dots
  return (
    <>
      <style>{`.ms-slider::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="ms-slider"
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          paddingBottom: 4,
        }}
      >
        {modules.map((mod, i) => (
          <div key={i} style={{ flex: "0 0 80%", maxWidth: 300, scrollSnapAlign: "center" }}>
            <Card mod={mod} index={i} />
          </div>
        ))}
      </div>

      {/* Dots */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, marginTop: 14, flexWrap: "wrap" }}>
        {modules.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToDot(i)}
            aria-label={`Go to module ${i + 1}`}
            style={{
              width: i === active ? 24 : 8,
              height: 8,
              borderRadius: i === active ? 4 : "50%",
              background: i === active ? "var(--sm-navy)" : "var(--sm-border)",
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
  );
}
