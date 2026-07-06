/* ═══════════════════════════════════════════════════════════════════
   E-TUBE — demo data + helpers (frontend only)

   Ported from "Super_admin_with_ETube (17).html". Mock data so the
   E-Tube screens are fully interactive without a backend. The integrating
   developer replaces these arrays with API calls.
   ═══════════════════════════════════════════════════════════════════ */

/* Category meta — icon / colour / tinted background per category name. */
export const ET_CM = {
  'School Mentor': { i: 'fa-graduation-cap', c: '#1E40AF', bg: 'rgba(30,58,138,.1)' },
  'Science':       { i: 'fa-flask',          c: '#16A34A', bg: 'rgba(22,163,74,.1)' },
  'Technology':    { i: 'fa-microchip',       c: '#0284C7', bg: 'rgba(2,132,199,.1)' },
  'Business':      { i: 'fa-briefcase',       c: '#D97706', bg: 'rgba(217,119,6,.1)' },
  'Books':         { i: 'fa-book',            c: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
  'Universe':      { i: 'fa-meteor',          c: '#1E40AF', bg: 'rgba(30,58,138,.1)' },
  'History':       { i: 'fa-landmark-dome',   c: '#B45309', bg: 'rgba(180,83,9,.1)' },
};

export const catMeta = (cat) =>
  ET_CM[cat] || { i: 'fa-photo-film', c: '#1E40AF', bg: 'rgba(30,58,138,.1)' };

export const INITIAL_CATS = [
  { id: 1, name: 'School Mentor', desc: 'Official School Mentor content and introductions.', icon: 'fa-graduation-cap', color: '#1E40AF' },
  { id: 2, name: 'Science',       desc: 'Educational science videos for all grade levels.',  icon: 'fa-flask',          color: '#16A34A' },
  { id: 3, name: 'Technology',    desc: 'Tech, coding, and digital literacy.',               icon: 'fa-microchip',       color: '#0284C7' },
  { id: 4, name: 'Business',      desc: 'Entrepreneurship and business basics.',             icon: 'fa-briefcase',       color: '#D97706' },
  { id: 5, name: 'Books',         desc: 'Reading habits and literature.',                    icon: 'fa-book',            color: '#7C3AED' },
  { id: 6, name: 'Universe',      desc: 'Space, astronomy, and the cosmos.',                 icon: 'fa-meteor',          color: '#1E40AF' },
  { id: 7, name: 'History',       desc: 'Historical events and civilisations.',              icon: 'fa-landmark-dome',   color: '#B45309' },
];

export const INITIAL_VIDS = [
  { id: 1,  title: 'Mentor AI Feature Walkthrough',    desc: 'Complete guide to Mentor AI tools for lesson planning and worksheets.', cat: 'School Mentor', vis: 'all', status: 'Live',       date: '18 Jun 2026', views: 3240 },
  { id: 2,  title: 'How to Use the E-Tube Platform',   desc: 'Tutorial for schools on uploading and managing educational content.',    cat: 'School Mentor', vis: 'all', status: 'Live',       date: '15 Jun 2026', views: 2190 },
  { id: 3,  title: 'Photosynthesis — Animated Explainer', desc: 'How plants produce food using sunlight — step by step.',              cat: 'Science',       vis: 'all', status: 'Live',       date: '12 Jun 2026', views: 4810 },
  { id: 4,  title: 'The Water Cycle Explained',        desc: 'Evaporation, condensation, precipitation for grade 5-8.',               cat: 'Science',       vis: 'all', status: 'Live',       date: '10 Jun 2026', views: 3660 },
  { id: 5,  title: 'Introduction to Python Programming', desc: 'Beginner-friendly Python — variables, loops, and functions.',          cat: 'Technology',    vis: 'all', status: 'Processing', date: '20 Jun 2026', views: 0 },
  { id: 6,  title: 'What is Artificial Intelligence?',  desc: 'AI explainer for middle school students.',                              cat: 'Technology',    vis: 'all', status: 'Live',       date: '08 Jun 2026', views: 2740 },
  { id: 7,  title: 'Supply and Demand Basics',          desc: 'Core economics concept with relatable examples.',                       cat: 'Business',      vis: 'all', status: 'Live',       date: '06 Jun 2026', views: 1120 },
  { id: 8,  title: 'Ancient Mesopotamia',               desc: 'The cradle of civilisation — Sumerians and the first cities.',          cat: 'History',       vis: 'all', status: 'Live',       date: '04 Jun 2026', views: 1870 },
  { id: 9,  title: 'Reading Comprehension Strategies',  desc: 'Active reading tips to improve student retention.',                     cat: 'Books',         vis: 'all', status: 'Processing', date: '21 Jun 2026', views: 0 },
  { id: 10, title: 'Black Holes Explained',             desc: 'What are black holes and can they be escaped?',                         cat: 'Universe',      vis: 'all', status: 'Live',       date: '02 Jun 2026', views: 5210 },
];

export const INITIAL_REVS = [
  { id: 1, school: 'Daffodil Schools',        cat: 'Science',       vt: 'Photosynthesis — Animated Explainer', vd: 'How plants produce food using sunlight — step by step.',       txt: 'Excellent! Our students loved the animations. Very well-paced for grade 6.',          date: '19 Jun 2026', by: 'Ms. Sara (Science HOD)',  status: 'Pending'  },
  { id: 2, school: 'The Spirit School',       cat: 'Technology',    vt: 'What is Artificial Intelligence?',    vd: 'AI explainer for middle school students.',                     txt: 'Great intro to AI. Could you add a section on robotics? Students ask about it a lot.', date: '18 Jun 2026', by: 'Mr. Ahmed (IT Teacher)',  status: 'Pending'  },
  { id: 3, school: 'Smart School Talagang',   cat: 'School Mentor', vt: 'Mentor AI Feature Walkthrough',       vd: 'Complete guide to Mentor AI tools for lesson planning.',        txt: 'Very helpful for our teachers. The lesson planning section was especially useful.',   date: '17 Jun 2026', by: 'Principal Office',        status: 'Approved' },
  { id: 4, school: 'Faith Montessori Centre', cat: 'Science',       vt: 'The Water Cycle Explained',           vd: 'Evaporation, condensation, precipitation for grade 5-8.',      txt: 'Audio quality in the second half could be improved. Visuals are very clear though.',   date: '14 Jun 2026', by: 'Ms. Ayesha (Teacher)',    status: 'Approved' },
  { id: 5, school: 'Concept School',          cat: 'History',       vt: 'Ancient Mesopotamia',                 vd: 'The cradle of civilisation — Sumerians and the first cities.', txt: 'History students loved this! Please add content on South Asian civilisations too.',    date: '12 Jun 2026', by: 'Mr. Bilal (History Dept)', status: 'Rejected' },
  { id: 6, school: 'MPS School System',       cat: 'Business',      vt: 'Supply and Demand Basics',            vd: 'Core economics concept with relatable examples.',              txt: 'Perfect for class 9 business studies. Very clear explanation.',                        date: '10 Jun 2026', by: 'Ms. Zainab (Commerce)',   status: 'Rejected' },
];

export const INITIAL_SCHOOL_VIDS = [
  { id: 101, school: 'Daffodil Schools',        title: 'States of Matter',         desc: 'Solid, liquid and gas — states of matter for grade school.',        cat: 'Science',    status: 'Approved', date: '14 Jun 2026', views: 320, by: 'Ms. Ayesha (Science Dept)' },
  { id: 102, school: 'The Spirit School',       title: 'Cyber Security Basics',    desc: 'Introduction to online safety and cyber security for students.',    cat: 'Technology', status: 'Approved', date: '13 Jun 2026', views: 190, by: 'Mr. Usman (IT Dept)' },
  { id: 103, school: 'Smart School Talagang',   title: 'Our Solar System Tour',    desc: 'An animated tour through the planets of our solar system.',          cat: 'Universe',   status: 'Approved', date: '13 Jun 2026', views: 410, by: 'Ms. Hina (Science Dept)' },
  { id: 104, school: 'Faith Montessori Centre', title: 'Photosynthesis Made Simple', desc: 'Easy explanation of how plants make their own food.',             cat: 'Science',    status: 'Approved', date: '12 Jun 2026', views: 275, by: 'Ms. Ayesha (Science Dept)' },
  { id: 105, school: 'Concept School',          title: 'The Rise of Islam',        desc: 'Historical overview of the early Islamic period for grade 8.',      cat: 'History',    status: 'Pending',  date: '20 Jun 2026', views: 0,   by: 'Mr. Bilal (History Dept)' },
  { id: 106, school: 'MPS School System',       title: 'Introduction to Algebra',  desc: 'Variables, expressions and simple equations for grade 6.',          cat: 'Science',    status: 'Pending',  date: '21 Jun 2026', views: 0,   by: 'Ms. Zainab (Math Dept)' },
];

export const UPLOAD_CATEGORIES = ['School Mentor', 'Science', 'Technology', 'Business', 'Books', 'Universe', 'History'];

export const REJECT_REASONS = [
  'Not educational / off-topic',
  'Inappropriate for students',
  'Poor video / audio quality',
  'Copyright concern',
  'Duplicate content',
  'Other (see note)',
];

export const CATEGORY_COLORS = [
  { value: '#1E40AF', label: 'Blue' },
  { value: '#16A34A', label: 'Green' },
  { value: '#D97706', label: 'Amber' },
  { value: '#DC2626', label: 'Red' },
  { value: '#7C3AED', label: 'Purple' },
  { value: '#0284C7', label: 'Cyan' },
  { value: '#B45309', label: 'Brown' },
];

export const todayLabel = () =>
  new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
