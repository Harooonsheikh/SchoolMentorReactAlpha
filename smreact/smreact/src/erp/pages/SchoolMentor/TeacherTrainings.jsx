import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Tooltip from '../../components/Tooltip';
import TutorialModal from '../../components/TutorialModal';

/* ═══════════════════════════════════════════════════════════════════
   TEACHER TRAININGS — recorded monthly workshop library

   Self-contained module mirroring the School SOPs design language
   (brand-blue gradient header, Plus Jakarta Sans, light-blue banner,
   white stat cards, full-width category tab bar, pill search input,
   simple data rows with one primary action).
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Categories ─── */
const CATEGORY_OPTIONS = [
  { id: 'Academic',       label: 'Academic Trainings',       icon: 'fa-graduation-cap' },
  { id: 'Administrative', label: 'Administrative Trainings', icon: 'fa-building'       },
  { id: 'Parenting',      label: 'Parenting',                icon: 'fa-people-roof'    },
  { id: 'Character',      label: 'Character Building',       icon: 'fa-heart'          },
  { id: 'Others',         label: 'Others',                   icon: 'fa-folder-open'    },
];

/* ─── Mock data ─── */
const TRAININGS = [
  /* Academic */
  { id: 1,  sno: 1, topic: 'Effective Lesson Planning & Instructional Design',
    category: 'Academic', trainer: 'Dr. Sarah Ahmed', trainerDesignation: 'Senior Academic Consultant',
    trainerBio: 'Dr. Sarah Ahmed has 18 years of experience in curriculum development and teacher training across Pakistan and the UK. She specializes in outcome-based lesson design and formative assessment.',
    date: '10 May 2026', duration: '52 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'This session covers the fundamentals of designing lessons that align with learning outcomes, student engagement techniques, and practical lesson plan templates used in top schools.' },
  { id: 2,  sno: 2, topic: 'Classroom Management Strategies for Every Teacher',
    category: 'Academic', trainer: 'Usman Khalid', trainerDesignation: 'Lead Trainer, School Mentor',
    trainerBio: 'Usman Khalid is a master trainer with 12 years in school capacity building. He has trained over 3,000 teachers across 200+ schools in Pakistan on classroom management and positive discipline.',
    date: '12 Apr 2026', duration: '48 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Practical strategies for maintaining a positive, focused classroom environment. Covers preventive techniques, student engagement, seating arrangements, and handling disruptions professionally.' },
  { id: 3,  sno: 3, topic: "Bloom's Taxonomy: Designing Higher-Order Questions",
    category: 'Academic', trainer: 'Dr. Sarah Ahmed', trainerDesignation: 'Senior Academic Consultant',
    trainerBio: 'Dr. Sarah Ahmed has 18 years of experience in curriculum development and teacher training across Pakistan and the UK.',
    date: '15 Mar 2026', duration: '44 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: "A deep dive into applying Bloom's Taxonomy in daily teaching. Learn how to craft questions that develop critical thinking from recall level to creation level across all subjects." },
  { id: 4,  sno: 4, topic: 'Formative Assessment: Checking Understanding Daily',
    category: 'Academic', trainer: 'Fareeha Noor', trainerDesignation: 'Assessment Specialist',
    trainerBio: 'Fareeha Noor is an assessment and evaluation specialist with expertise in designing formative tools, rubrics, and feedback systems for K-12 schools.',
    date: '08 Feb 2026', duration: '39 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Learn to use exit tickets, think-pair-share, white boards, and other formative tools to check student understanding in real time without waiting for exams.' },
  /* Administrative */
  { id: 5,  sno: 1, topic: 'School Documentation Management & Record Keeping',
    category: 'Administrative', trainer: 'Ahmed Raza', trainerDesignation: 'School Operations Consultant',
    trainerBio: 'Ahmed Raza specializes in school administration, documentation systems, and ERP implementation. He has worked with 150+ schools on administrative efficiency.',
    date: '05 Apr 2026', duration: '41 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'A practical guide to maintaining student files, staff records, admission documents, and official correspondence in an organized and audit-ready manner.' },
  { id: 6,  sno: 2, topic: 'Professional Parent Communication Skills',
    category: 'Administrative', trainer: 'Sana Mirza', trainerDesignation: 'Communication & PR Trainer',
    trainerBio: 'Sana Mirza is a communication coach who helps school staff build confident, professional, and empathetic relationships with parents and communities.',
    date: '09 Mar 2026', duration: '36 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Covers best practices for parent meetings, handling complaints, writing professional notices, and using the mobile app for daily communication.' },
  { id: 7,  sno: 3, topic: 'Admission Handling & Enrollment Best Practices',
    category: 'Administrative', trainer: 'Ahmed Raza', trainerDesignation: 'School Operations Consultant',
    trainerBio: 'Ahmed Raza specializes in school administration, documentation systems, and ERP implementation.',
    date: '12 Feb 2026', duration: '33 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'A step-by-step walkthrough of the admissions process — from inquiry management to enrollment — using the School Mentor ERP Admission CRM module.' },
  /* Parenting */
  { id: 8,  sno: 1, topic: 'Building Strong Parent-School Partnerships',
    category: 'Parenting', trainer: 'Dr. Hira Malik', trainerDesignation: 'Child Development & Family Counsellor',
    trainerBio: 'Dr. Hira Malik is a child psychologist and family counsellor with 14 years of experience in school-based mental health and parent engagement programs.',
    date: '18 Apr 2026', duration: '45 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Explores how schools and parents can become true learning partners. Covers PTM design, communication channels, parent volunteer programs, and trust building.' },
  { id: 9,  sno: 2, topic: 'Understanding Child Behavior & Emotional Needs',
    category: 'Parenting', trainer: 'Dr. Hira Malik', trainerDesignation: 'Child Development & Family Counsellor',
    trainerBio: 'Dr. Hira Malik is a child psychologist and family counsellor with 14 years of experience in school-based mental health and parent engagement programs.',
    date: '20 Mar 2026', duration: '50 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Helps teachers understand the emotional and psychological drivers of student behavior. Covers developmental stages, trauma-informed teaching, and behavior de-escalation.' },
  /* Character */
  { id: 10, sno: 1, topic: 'Integrating Moral Education into Daily Teaching',
    category: 'Character', trainer: 'Usman Khalid', trainerDesignation: 'Lead Trainer, School Mentor',
    trainerBio: 'Usman Khalid is a master trainer with 12 years in school capacity building.',
    date: '22 Apr 2026', duration: '38 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Practical methods for weaving values, ethics, and character education into everyday lessons across all subjects without a separate dedicated class.' },
  { id: 11, sno: 2, topic: 'Student Discipline with Compassion & Care',
    category: 'Character', trainer: 'Dr. Hira Malik', trainerDesignation: 'Child Development & Family Counsellor',
    trainerBio: 'Dr. Hira Malik is a child psychologist with 14 years of school-based mental health experience.',
    date: '14 Mar 2026', duration: '42 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Moving beyond punishment — this session covers restorative practices, logical consequences, and building a school culture of accountability and respect.' },
  /* Others */
  { id: 12, sno: 1, topic: 'Teacher Wellbeing: Avoiding Burnout in Schools',
    category: 'Others', trainer: 'Fareeha Noor', trainerDesignation: 'Assessment & Wellbeing Specialist',
    trainerBio: 'Fareeha Noor works in assessment design and teacher wellbeing programs across private and government schools.',
    date: '27 Apr 2026', duration: '35 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Addresses the signs of teacher burnout, stress management tools, work-life balance strategies, and how school leadership can support staff mental health.' },
  { id: 13, sno: 2, topic: 'Technology Integration in Classrooms',
    category: 'Others', trainer: 'Bilal Hassan', trainerDesignation: 'EdTech Integration Specialist',
    trainerBio: 'Bilal Hassan is an education technology specialist helping schools adopt digital tools, apps, and ERP systems effectively across all grade levels.',
    date: '13 Apr 2026', duration: '47 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Practical guide to using digital tools — projectors, school apps, online quizzes, and the School Mentor platform — to make teaching more engaging and efficient.' },
  { id: 14, sno: 3, topic: 'Psychological Support for Students in Distress',
    category: 'Others', trainer: 'Dr. Hira Malik', trainerDesignation: 'Child Development & Family Counsellor',
    trainerBio: 'Dr. Hira Malik is a child psychologist with 14 years of school-based mental health experience.',
    date: '05 May 2026', duration: '53 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Training for teachers on identifying signs of student distress, how to approach sensitive conversations, referral pathways, and creating a psychologically safe classroom.' },
  { id: 15, sno: 4, topic: 'Using School Mentor ERP — Teacher Complete Guide',
    category: 'Others', trainer: 'Bilal Hassan', trainerDesignation: 'EdTech Integration Specialist',
    trainerBio: 'Bilal Hassan is an education technology specialist helping schools adopt digital tools and ERP systems.',
    date: '01 May 2026', duration: '58 min', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    description: 'Complete walkthrough of all teacher-facing features in the School Mentor ERP — lesson plans, attendance, homework diary, results entry, and the mobile app.' },
];

/* Tiny helper — initials from a free-text trainer name. */
function initialsOf(name) {
  if (!name) return '?';
  return name.replace(/Dr\.|Mr\.|Ms\.|Mrs\./g, '').trim()
    .split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function TeacherTrainings({ toast = () => {} }) {
  const [cat,    setCat]    = useState('Academic');
  const [search, setSearch] = useState('');
  const [videoFor, setVideoFor] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /* Live-filtered trainings. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TRAININGS
      .filter(t => t.category === cat)
      .filter(t => {
        if (!q) return true;
        const hay = `${t.topic} ${t.trainer}`.toLowerCase();
        return hay.includes(q);
      });
  }, [cat, search]);

  /* Headline stats. */
  const stats = useMemo(() => ({
    totalTrainings: TRAININGS.length,
    categories:     CATEGORY_OPTIONS.length,
    latest:         'May 2026',
  }), []);

  return (
    <>
      <style>{TRAINING_CSS}</style>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-title-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}>
            <i className="fa-solid fa-chalkboard-user"></i>
          </div>
          <div>
            <div className="page-title">Teacher Trainings</div>
            <div className="page-sub">Watch recorded monthly workshop sessions by School Mentor</div>
          </div>
        </div>
        <Tooltip text="Play a short tutorial for the Teacher Trainings module">
          <button
            className="tutorial-btn page-tutorial-btn"
            onClick={() => setTutorialOpen(true)}
            aria-label="Open Teacher Trainings tutorials"
          >
            <div className="play-dot"><i className="fa-solid fa-play" style={{ fontSize: 8 }}></i></div>
            <span className="tutorial-label">Tutorial</span>
          </button>
        </Tooltip>
      </div>

      {/* ── Info banner ── */}
      <div className="tt-banner">
        <div className="tt-banner-ic"><i className="fa-solid fa-circle-info" aria-hidden="true"></i></div>
        <div className="tt-banner-body">
          School Mentor conducts monthly online teacher training workshops. Teachers who missed a session or new joiners can watch any previous training from this library at any time.
        </div>
      </div>

      {/* ── Stat cards (3) ── */}
      <div className="tt-stats">
        <Stat tone="blue"   icon="fa-video"          label="Total Trainings" value={stats.totalTrainings}
              sub={`Across ${stats.categories} categories`} />
        <Stat tone="green"  icon="fa-layer-group"    label="Categories"      value={stats.categories}
              sub="Organised by focus area" />
        <Stat tone="indigo" icon="fa-calendar-check" label="Latest Training" value={stats.latest}
              sub="Most recent session" />
      </div>

      {/* ── Category tabs ── */}
      <div className="tt-cats" role="tablist" aria-label="Training categories">
        {CATEGORY_OPTIONS.map(c => {
          const count = TRAININGS.filter(t => t.category === c.id).length;
          return (
            <Tooltip key={c.id} text="Filter trainings by category">
              <button
                type="button"
                className={`tt-cat${cat === c.id ? ' on' : ''}`}
                role="tab"
                aria-selected={cat === c.id}
                tabIndex={cat === c.id ? 0 : -1}
                onClick={() => setCat(c.id)}
              >
                <i className={`fa-solid ${c.icon}`} aria-hidden="true"></i>
                <span>{c.label}</span>
                <span className="tt-cat-count">{count}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* ── Filter bar — search only ── */}
      <div className="tt-filters">
        <Tooltip text="Search trainings by topic or trainer">
          <div className="tt-search">
            <i className="fa-solid fa-magnifying-glass tt-search-ic" aria-hidden="true"></i>
            <input
              type="text"
              className="tt-search-input"
              placeholder="Search by topic or trainer name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search trainings"
            />
            {search && (
              <Tooltip text="Clear search">
                <button type="button" className="tt-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
              </Tooltip>
            )}
          </div>
        </Tooltip>
      </div>

      {/* ── Training list ── */}
      {filtered.length === 0 ? (
        <div className="tt-empty">
          <div className="tt-empty-ic"><i className="fa-solid fa-video-slash" aria-hidden="true"></i></div>
          <div className="tt-empty-title">No trainings available</div>
          <div className="tt-empty-sub">No trainings found in this category yet. Check back after the next monthly session.</div>
        </div>
      ) : (
        <div className="tt-table">
          <div className="tt-table-head">
            <div className="th c" style={{ width: 50 }}>S.No</div>
            <div className="th">Topic</div>
            <div className="th" style={{ width: 220 }}>Trainer</div>
            <div className="th" style={{ width: 120 }}>Date</div>
            <div className="th c" style={{ width: 90 }}>Duration</div>
            <div className="th c" style={{ width: 170 }}>Action</div>
          </div>
          {filtered.map(t => (
            <TrainingRow key={t.id} training={t} onView={() => setVideoFor(t)} />
          ))}
        </div>
      )}

      {/* ── Video player modal ── */}
      {videoFor && (
        <VideoPlayerModal
          training={videoFor}
          onClose={() => setVideoFor(null)}
        />
      )}

      <TutorialModal
        open={tutorialOpen}
        moduleKey="teacherTrainings"
        onClose={() => setTutorialOpen(false)}
        toast={toast}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════════════ */
function Stat({ tone, icon, label, value, sub }) {
  return (
    <Tooltip text={label} placement="top">
      <div className={`tt-stat tt-stat--${tone}`}>
        <div className="tt-stat-ic"><i className={`fa-solid ${icon}`} aria-hidden="true"></i></div>
        <div className="tt-stat-lbl">{label}</div>
        <div className="tt-stat-val">{value}</div>
        {sub && <div className="tt-stat-sub">{sub}</div>}
      </div>
    </Tooltip>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TRAINING ROW
   ═══════════════════════════════════════════════════════════════════ */
function TrainingRow({ training, onView }) {
  return (
    <div className="tt-rowwrap">
      <div className="tt-row">
        <div className="td c tt-sno-cell">{training.sno}</div>
        <div className="td tt-topic-cell">
          <span className="tt-topic-text">{training.topic}</span>
        </div>
        <div className="td tt-trainer-cell">
          <Tooltip text={`Trainer: ${training.trainer}`} placement="top">
            <div className="tt-avatar tt-avatar--sm" aria-hidden="true">{initialsOf(training.trainer)}</div>
          </Tooltip>
          <div className="tt-trainer-text">
            <div className="tt-trainer-name">{training.trainer}</div>
            <div className="tt-trainer-desig">{training.trainerDesignation}</div>
          </div>
        </div>
        <Tooltip text="Recorded on this date" placement="top">
          <div className="td tt-date">{training.date}</div>
        </Tooltip>
        <div className="td c">
          <Tooltip text="Training duration" placement="top">
            <span className="tt-badge tt-badge--blue">{training.duration}</span>
          </Tooltip>
        </div>
        <div className="td c tt-actions">
          <Tooltip text="Watch recorded training">
            <button type="button" className="tt-btn tt-btn-primary tt-btn-sm" onClick={onView}>
              <i className="fa-solid fa-play" aria-hidden="true"></i>
              View Training
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VIDEO PLAYER MODAL — trainer profile + video + description
   ═══════════════════════════════════════════════════════════════════ */
function VideoPlayerModal({ training, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const embedUrl = training.videoUrl.includes('?')
    ? `${training.videoUrl}&rel=0&modestbranding=1`
    : `${training.videoUrl}?rel=0&modestbranding=1`;

  return createPortal((
    <div
      className="tt-modal-back"
      role="dialog" aria-modal="true" aria-labelledby="tt-video-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="tt-modal">
        <div className="tt-modal-head">
          <div className="tt-modal-head-l">
            <div className="tt-modal-icn"><i className="fa-solid fa-play-circle" aria-hidden="true"></i></div>
            <div>
              <div className="tt-modal-title" id="tt-video-title">{training.topic}</div>
              <div className="tt-modal-sub">
                <span className="tt-badge tt-badge--blue">{training.category}</span>
              </div>
            </div>
          </div>
          <Tooltip text="Close (Esc)">
            <button className="tt-modal-x" onClick={onClose} aria-label="Close">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </Tooltip>
        </div>

        <div className="tt-modal-body">
          {/* Trainer profile */}
          <div className="tt-trainer-card">
            <Tooltip text={`Trainer: ${training.trainer}`} placement="top">
              <div className="tt-avatar tt-avatar--lg" aria-hidden="true">{initialsOf(training.trainer)}</div>
            </Tooltip>
            <div className="tt-trainer-body">
              <div className="tt-trainer-card-name">{training.trainer}</div>
              <div className="tt-trainer-card-desig">{training.trainerDesignation}</div>
              <div className="tt-trainer-bio">{training.trainerBio}</div>
              <div className="tt-trainer-meta">
                <Tooltip text="Recording date" placement="top">
                  <span className="tt-meta-chip">
                    <i className="fa-solid fa-calendar-alt" aria-hidden="true"></i> {training.date}
                  </span>
                </Tooltip>
                <Tooltip text="Total runtime" placement="top">
                  <span className="tt-meta-chip">
                    <i className="fa-solid fa-clock" aria-hidden="true"></i> {training.duration}
                  </span>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* 16:9 video */}
          <div className="tt-video-wrap">
            <iframe
              className="tt-video"
              src={embedUrl}
              title={`${training.topic} — recorded training`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Description */}
          <div className="tt-desc-block">
            <div className="tt-desc-h">About this training</div>
            <div className="tt-desc-body">{training.description}</div>
          </div>
        </div>

        <div className="tt-modal-foot tt-modal-foot--split">
          <div className="tt-foot-note">
            <i className="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span>Recorded session from {training.date}</span>
          </div>
          <button type="button" className="tt-btn tt-btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  ), document.body);
}

/* ═══════════════════════════════════════════════════════════════════
   Module CSS — mirrors the School SOPs brand-blue chrome
   ═══════════════════════════════════════════════════════════════════ */
const TRAINING_CSS = `
:root { --tt-font: 'Plus Jakarta Sans', var(--font-body, system-ui), -apple-system, Segoe UI, sans-serif; }
@keyframes ttFade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ttPop  { from { transform: translateY(8px) scale(.985); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }

/* ─── Info banner ─── */
.tt-banner {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 14px;
}
.tt-banner-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1E3A8A, #1E40AF);
  color: #fff;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  box-shadow: 0 4px 10px rgba(30, 58, 138, .28);
}
.tt-banner-body {
  font-family: var(--tt-font);
  font-size: 13px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.55;
}
[data-theme="dark"] .tt-banner-body { color: #BFDBFE; }

/* ─── Stats ─── */
.tt-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 14px;
}
.tt-stat {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
  transition: all .2s ease;
  display: flex; flex-direction: column; gap: 4px;
}
[data-theme="dark"] .tt-stat {
  background: var(--bg-card, #0F172A);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.tt-stat:hover { border-color: #CBD5E1; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(15, 23, 42, .06); }
.tt-stat-ic {
  width: 34px; height: 34px;
  border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px;
  margin-bottom: 6px;
}
.tt-stat--blue   .tt-stat-ic { background: rgba(30, 64, 175, .12);  color: #1E40AF; }
.tt-stat--green  .tt-stat-ic { background: rgba(21, 128, 61, .12);  color: #15803D; }
.tt-stat--indigo .tt-stat-ic { background: rgba(67, 56, 202, .12);  color: #4338CA; }
.tt-stat-lbl {
  font-family: var(--tt-font);
  font-size: 11px;
  font-weight: 700;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
.tt-stat-val {
  font-family: var(--tt-font);
  font-size: 22px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.02em;
  line-height: 1.15;
  margin: 2px 0;
  word-break: break-word;
}
[data-theme="dark"] .tt-stat-val { color: var(--text-primary, #E2E8F0); }
.tt-stat-sub {
  font-family: var(--tt-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.3;
}

/* ─── Category tabs ─── */
.tt-cats {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding: 4px;
  margin-bottom: 14px;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border-light, #E2E8F0);
  border-radius: 14px;
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, .04));
}
[data-theme="dark"] .tt-cats { background: var(--bg-card, #0F172A); }
.tt-cat {
  flex: 1; min-width: 160px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-family: var(--tt-font);
  font-size: 13px;
  font-weight: 700;
  color: #64748B;
  cursor: pointer;
  transition: all .2s ease;
}
.tt-cat:hover:not(.on) { background: #F8FAFF; color: #1E40AF; }
[data-theme="dark"] .tt-cat:hover:not(.on) { background: rgba(255,255,255,.03); }
.tt-cat.on {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 60%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 6px 20px rgba(30, 58, 138, .4), inset 0 1px 0 rgba(255, 255, 255, .2);
}
.tt-cat i { font-size: 12px; }
.tt-cat-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(100, 116, 139, .14);
  color: #475569;
  font: 700 10.5px/1 var(--tt-font);
  letter-spacing: .02em;
}
.tt-cat.on .tt-cat-count { background: rgba(255, 255, 255, .25); color: #fff; }

/* ─── Filter bar (search only) ─── */
.tt-filters {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
}
.tt-search {
  position: relative;
  display: flex;
  align-items: center;
}
.tt-search-ic {
  position: absolute;
  left: 13px;
  color: #94A3B8;
  font-size: 12px;
  pointer-events: none;
}
.tt-search-input {
  width: 100%;
  height: 38px;
  padding: 0 36px;
  border: 1.5px solid #E2E8F0;
  border-radius: 999px;
  background: #fff;
  color: #0F172A;
  font-family: var(--tt-font);
  font-size: 13px;
  font-weight: 500;
  transition: all .15s ease;
}
[data-theme="dark"] .tt-search-input {
  background: var(--bg-card, #0F172A);
  color: var(--text-primary, #E2E8F0);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.tt-search-input::placeholder { color: #94A3B8; }
.tt-search-input:focus { outline: none; border-color: #1E3A8A; box-shadow: 0 0 0 3px rgba(30, 58, 138, .12); }
.tt-search-clear {
  position: absolute;
  right: 7px;
  width: 24px; height: 24px;
  border: none;
  background: #F1F5F9;
  border-radius: 999px;
  color: #64748B;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px;
  transition: all .15s ease;
}
.tt-search-clear:hover { background: #E2E8F0; color: #0F172A; }

/* ─── Buttons ─── */
.tt-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: var(--tt-font);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -.005em;
  cursor: pointer;
  transition: all .18s ease;
  white-space: nowrap;
}
.tt-btn-sm { height: 32px; padding: 0 12px; font-size: 11.5px; }
.tt-btn i { font-size: 11px; }
.tt-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(30, 64, 175, .28); }
.tt-btn-primary {
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(30, 58, 138, .28), inset 0 1px 0 rgba(255, 255, 255, .14);
}
.tt-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(30, 58, 138, .38); }
.tt-btn-ghost {
  background: #fff;
  color: #1E293B;
  border-color: #E2E8F0;
}
[data-theme="dark"] .tt-btn-ghost { background: var(--bg-card); color: var(--text-primary); border-color: var(--border-light); }
.tt-btn-ghost:hover { background: #F1F5F9; border-color: #CBD5E1; color: #1E40AF; }

/* ─── Table ─── */
.tt-table {
  background: #fff;
  border: 1px solid #E2E8F0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(15, 23, 42, .04);
}
[data-theme="dark"] .tt-table {
  background: var(--bg-card, #0F172A);
  border-color: var(--border-light, rgba(255,255,255,.08));
}
.tt-table-head {
  display: grid;
  grid-template-columns: 50px 1fr 220px 120px 90px 170px;
  gap: 12px;
  padding: 12px 16px;
  background: #F8FAFF;
  border-bottom: 1px solid #E2E8F0;
  font-family: var(--tt-font);
  font-size: 10.5px;
  font-weight: 700;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
}
[data-theme="dark"] .tt-table-head { background: rgba(255,255,255,.03); border-color: var(--border-light); }
.tt-table-head .th.c { text-align: center; }

.tt-rowwrap {
  border-bottom: 1px solid #F1F5F9;
  transition: background .15s ease;
}
[data-theme="dark"] .tt-rowwrap { border-color: var(--border-light); }
.tt-rowwrap:last-child { border-bottom: none; }
.tt-rowwrap:hover { background: #FAFBFF; }
[data-theme="dark"] .tt-rowwrap:hover { background: rgba(255,255,255,.03); }

.tt-row {
  display: grid;
  grid-template-columns: 50px 1fr 220px 120px 90px 170px;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  min-height: 64px;
}
.tt-row .td.c { text-align: center; display: flex; align-items: center; justify-content: center; }
.tt-sno-cell {
  font-family: var(--tt-font);
  font-size: 12px;
  font-weight: 700;
  color: #94A3B8;
}
.tt-topic-cell { display: flex; align-items: center; min-width: 0; }
.tt-topic-text {
  font-family: var(--tt-font);
  font-size: 13.5px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -.005em;
  line-height: 1.4;
}
[data-theme="dark"] .tt-topic-text { color: var(--text-primary, #E2E8F0); }
.tt-trainer-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
.tt-trainer-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.tt-trainer-name {
  font-family: var(--tt-font);
  font-size: 12.5px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -.005em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
[data-theme="dark"] .tt-trainer-name { color: var(--text-primary, #E2E8F0); }
.tt-trainer-desig {
  font-family: var(--tt-font);
  font-size: 11px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tt-date { font-family: var(--tt-font); font-size: 12px; font-weight: 500; color: #64748B; }
.tt-actions { display: inline-flex; gap: 6px; justify-content: flex-end; }

/* Avatar */
.tt-avatar {
  border-radius: 50%;
  background: linear-gradient(135deg, #1E40AF, #2563EB);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--tt-font);
  font-weight: 800;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(30, 64, 175, .2);
  letter-spacing: .02em;
}
.tt-avatar--sm { width: 32px; height: 32px; font-size: 11px; }
.tt-avatar--lg { width: 48px; height: 48px; font-size: 16px; box-shadow: 0 4px 12px rgba(30, 64, 175, .25); }

/* Badge */
.tt-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: var(--tt-font);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: .03em;
  line-height: 1;
  white-space: nowrap;
}
.tt-badge--blue { background: rgba(30, 64, 175, .14); color: #1E40AF; }

/* ─── Empty state ─── */
.tt-empty {
  padding: 48px 24px;
  text-align: center;
  background: #fff;
  border: 1.5px dashed #CBD5E1;
  border-radius: 14px;
}
[data-theme="dark"] .tt-empty { background: var(--bg-card, #0F172A); border-color: var(--border-light, rgba(255,255,255,.08)); }
.tt-empty-ic {
  width: 56px; height: 56px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(30, 64, 175, .12), rgba(30, 64, 175, .04));
  color: #1E40AF;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}
.tt-empty-title {
  font-family: var(--tt-font);
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
}
[data-theme="dark"] .tt-empty-title { color: var(--text-primary, #E2E8F0); }
.tt-empty-sub {
  font-family: var(--tt-font);
  font-size: 12.5px;
  font-weight: 500;
  color: #64748B;
  margin: 6px auto 0;
  max-width: 420px;
}

/* ─── Modal shell ─── */
.tt-modal-back {
  position: fixed;
  inset: 0;
  background: rgba(8, 13, 26, .55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: ttFade .14s ease-out;
}
.tt-modal {
  width: min(780px, 100%);
  max-height: 92vh;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(8, 13, 26, .35);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--tt-font);
  animation: ttPop .18s cubic-bezier(.2, .8, .2, 1);
}
[data-theme="dark"] .tt-modal { background: var(--bg-card, #0F172A); }
.tt-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 22px;
  background: linear-gradient(135deg, #1E3A8A 0%, #1E40AF 50%, #2563EB 100%);
  color: #fff;
  flex-shrink: 0;
}
.tt-modal-head-l { display: flex; align-items: center; gap: 14px; min-width: 0; }
.tt-modal-icn {
  width: 42px; height: 42px;
  border-radius: 12px;
  background: rgba(255, 255, 255, .15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
}
.tt-modal-title {
  font-family: var(--tt-font);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -.01em;
  line-height: 1.3;
  word-break: break-word;
}
.tt-modal-sub {
  font-family: var(--tt-font);
  font-size: 11.5px;
  font-weight: 500;
  color: rgba(255, 255, 255, .85);
  margin-top: 4px;
}
.tt-modal-sub .tt-badge { background: rgba(255, 255, 255, .25); color: #fff; }
.tt-modal-x {
  width: 34px; height: 34px;
  border: none;
  background: rgba(255, 255, 255, .14);
  color: #fff;
  border-radius: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
  transition: background .15s ease;
}
.tt-modal-x:hover { background: rgba(255, 255, 255, .22); }
.tt-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 18px 22px;
  background: #F0F4FF;
}
[data-theme="dark"] .tt-modal-body { background: rgba(255,255,255,.03); }
.tt-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 22px;
  background: #fff;
  border-top: 1px solid #E2E8F0;
  flex-shrink: 0;
}
[data-theme="dark"] .tt-modal-foot { background: var(--bg-card); border-color: var(--border-light); }
.tt-modal-foot--split { justify-content: space-between; align-items: center; }
.tt-foot-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #EFF6FF;
  border-radius: 8px;
  font-family: var(--tt-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #1E40AF;
}
[data-theme="dark"] .tt-foot-note { background: rgba(30, 64, 175, .14); color: #93C5FD; }
.tt-foot-note i { font-size: 11px; }

/* ─── Trainer profile card (inside modal) ─── */
.tt-trainer-card {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 14px;
  align-items: flex-start;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 14px;
  margin-bottom: 16px;
}
[data-theme="dark"] .tt-trainer-card { background: var(--bg-card); border-color: var(--border-light); }
.tt-trainer-body { min-width: 0; }
.tt-trainer-card-name {
  font-family: var(--tt-font);
  font-size: 14px;
  font-weight: 800;
  color: #0F172A;
  letter-spacing: -.01em;
  line-height: 1.3;
}
[data-theme="dark"] .tt-trainer-card-name { color: var(--text-primary, #E2E8F0); }
.tt-trainer-card-desig {
  font-family: var(--tt-font);
  font-size: 12px;
  font-weight: 600;
  color: #1E40AF;
  margin-top: 2px;
}
[data-theme="dark"] .tt-trainer-card-desig { color: #93C5FD; }
.tt-trainer-bio {
  font-family: var(--tt-font);
  font-size: 11.5px;
  font-weight: 500;
  color: #64748B;
  line-height: 1.6;
  margin-top: 4px;
}
.tt-trainer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 10px;
}
.tt-meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: #F0F4FF;
  border: 1px solid #BFDBFE;
  border-radius: 999px;
  font-family: var(--tt-font);
  font-size: 11px;
  font-weight: 600;
  color: #1E3A5F;
}
[data-theme="dark"] .tt-meta-chip { background: rgba(30, 64, 175, .14); border-color: rgba(30, 64, 175, .35); color: #CBD5E1; }
.tt-meta-chip i { color: #1E40AF; font-size: 10px; }
[data-theme="dark"] .tt-meta-chip i { color: #93C5FD; }

/* ─── Video player (16:9) ─── */
.tt-video-wrap {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  border-radius: 12px;
  overflow: hidden;
  background: #0F172A;
  margin-bottom: 16px;
}
.tt-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* ─── Description block ─── */
.tt-desc-block {
  background: #fff;
  border: 1px solid #BFDBFE;
  border-radius: 12px;
  padding: 14px 16px;
}
[data-theme="dark"] .tt-desc-block { background: var(--bg-card); border-color: var(--border-light); }
.tt-desc-h {
  font-family: var(--tt-font);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: #64748B;
  margin-bottom: 6px;
  line-height: 1;
}
.tt-desc-body {
  font-family: var(--tt-font);
  font-size: 13px;
  font-weight: 500;
  color: #1E3A5F;
  line-height: 1.7;
}
[data-theme="dark"] .tt-desc-body { color: #CBD5E1; }

/* ─── Responsive ─── */
@media (max-width: 1180px) {
  .tt-stats { grid-template-columns: repeat(2, 1fr); }
  .tt-table-head, .tt-row {
    grid-template-columns: 50px 1fr 200px 100px 160px;
  }
  .tt-table-head > .th:nth-child(5),
  .tt-row > .td:nth-child(5) { display: none; }
}
@media (max-width: 900px) {
  .tt-stats { grid-template-columns: repeat(2, 1fr); }
  .tt-cats { gap: 6px; }
  .tt-cat { min-width: calc(50% - 6px); flex-basis: calc(50% - 6px); }
  .tt-filters { flex-wrap: wrap; }
  .tt-table { overflow-x: auto; }
  .tt-modal { max-width: 96vw; width: 96vw; }
  .tt-modal-head { padding: 14px 16px; }
  .tt-modal-body { padding: 14px 16px; }
  .tt-modal-foot { padding: 12px 16px; }
}
@media (max-width: 820px) {
  .tt-stats { grid-template-columns: 1fr; }
  .tt-cat { min-width: 100%; flex-basis: 100%; }
  .tt-table-head { display: none; }
  .tt-row {
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 14px;
    align-items: flex-start;
  }
  .tt-row .td.c { justify-content: flex-start; text-align: left; }
  .tt-sno-cell {
    align-self: flex-start;
    padding: 2px 9px;
    background: #F1F5F9;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 700;
    color: #475569;
    width: fit-content !important;
  }
  .tt-actions { width: 100%; justify-content: stretch; }
  .tt-actions .tt-btn { flex: 1; justify-content: center; }
  .tt-modal-back { padding: 0; }
  .tt-modal { max-height: 100vh; border-radius: 0; width: 100%; }
  .tt-trainer-card { grid-template-columns: 1fr; gap: 12px; text-align: center; }
  .tt-trainer-card .tt-avatar { margin: 0 auto; }
  .tt-trainer-meta { justify-content: center; }
}
@media (max-width: 600px) {
  .tt-stats { grid-template-columns: 1fr; gap: 10px; }
  .tt-cats {
    padding: 4px;
    gap: 4px;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .tt-cats::-webkit-scrollbar { display: none; }
  .tt-cat {
    min-width: max-content;
    flex-basis: auto;
    flex-shrink: 0;
    white-space: nowrap;
    padding: 9px 12px;
    font-size: 12.5px;
  }
  .tt-filters { grid-template-columns: 1fr; flex-wrap: wrap; }
  .tt-search-input { font-size: 12.5px; }
  .tt-banner { grid-template-columns: 32px 1fr; padding: 10px 12px; }
  .tt-banner-ic { width: 32px; height: 32px; font-size: 12px; }
  .tt-banner-body { font-size: 12px; }
  .tt-modal-back { padding: 0; }
  .tt-modal {
    max-width: 100vw;
    width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
  .tt-modal-head { padding: 12px 14px; gap: 10px; }
  .tt-modal-title { font-size: 14px; }
  .tt-modal-icn { width: 36px; height: 36px; font-size: 14px; }
  .tt-modal-body { padding: 12px 14px; }
  .tt-modal-foot { padding: 10px 14px; flex-wrap: wrap; }
  .tt-modal-foot--split { gap: 8px; }
  .tt-trainer-card { padding: 12px 14px; }
  .tt-trainer-meta { flex-wrap: wrap; }
  .tt-desc-block { padding: 12px 14px; }
  .tt-desc-body { font-size: 12.5px; }
  .tt-empty { padding: 32px 16px; }
}
`;
