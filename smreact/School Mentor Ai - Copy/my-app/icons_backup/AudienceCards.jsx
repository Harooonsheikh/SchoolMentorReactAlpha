export default function AudienceCards({ s, T }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={s.section(false)}>
        <div style={s.sectionInner}>
          <div style={s.sectionLabel}>Who It's For</div>
          <h2 style={{ ...s.sectionTitle(), fontSize: "clamp(18px,4vw,32px)", lineHeight: 1.2 }}>
            Built for Everyone in Your School
          </h2>

          <style>{`
            .cards-grid-4 {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 16px;
            }
            @media (max-width: 768px) {
              .cards-grid-4 {
                display: flex;
                overflow-x: auto;
                scroll-snap-type: x mandatory;
                -webkit-overflow-scrolling: touch;
                gap: 12px;
                padding-bottom: 12px;
                scrollbar-width: none;
              }
              .cards-grid-4::-webkit-scrollbar {
                display: none;
              }
              .audience-card {
                flex: 0 0 75vw;
                max-width: 280px;
                scroll-snap-align: start;
              }
            }
            @media (max-width: 480px) {
              .audience-card {
                flex: 0 0 82vw;
              }
            }
          `}</style>

          <div className="cards-grid-4">
            {[
              ["🏫", "Administrators & Principals", "Automate attendance, fees, HR, payroll, exams, and generate reports — from one dashboard.", "for-admin"],
              ["📚", "Teachers", "Mark attendance in seconds, upload assignments, and soon — generate AI lesson plans.", "for-teachers"],
              ["👤", "Parents", "Track your child's progress, fees, and school announcements in real time from your phone.", "for-parents"],
              ["🎓", "Students", "Access homework, timetables, results, and school notices anytime, anywhere.", "for-students"],
            ].map(([icon, title, desc, page]) => (
              <div
                key={page}
                className="audience-card"
                style={{ textAlign: "left" }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: T.tealLight, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 24, marginBottom: 16,
                }}>
                  {icon}
                </div>
                <h3 style={{ fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", color: T.navy, marginBottom: 8 }}>
                  {title}
                </h3>
                <p style={{ fontSize: 13, color: T.gray500, lineHeight: 1.6, margin: 0 }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
