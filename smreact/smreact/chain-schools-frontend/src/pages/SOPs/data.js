/* ═══════════════════════════════════════════════════════════════════
   OPERATIONAL SOPs — manual categories, manuals, attached forms.
   Ported from the Super Admin design; localStorage-backed demo store.
   ═══════════════════════════════════════════════════════════════════ */
const KEY = 'csp_sop_data'
const YT = 'https://www.youtube.com/embed/dQw4w9WgXcQ'
const f = (id, title, code, pageRef, desc, fileName) => ({ id, title, code, pageRef, desc, file: 'demo', fileName })
const m = (id, catId, title, code, desc, vid, forms, createdAt) => ({
  id, catId, title, code, desc, pdfName: '', pdfFile: '',
  vidTitle: vid.title || '', vidUrl: vid.url || '', vidDesc: vid.desc || '', vidStatus: vid.url ? 'available' : 'coming_soon',
  status: 'active', forms, createdAt,
})

const SEED = {
  catSeq: 10, manualSeq: 100, formSeq: 1100,
  cats: [
    { id: 1, title: 'Academic Manuals', desc: 'Teaching, learning, assessment, and academic operations manuals', status: 'active' },
    { id: 2, title: 'Administrative Manuals', desc: 'School administration, office procedures and compliance manuals', status: 'active' },
    { id: 3, title: 'HR Manuals', desc: 'Staff recruitment, onboarding, conduct, and HR policy manuals', status: 'active' },
    { id: 4, title: 'Health & Safety Manuals', desc: 'Health protocols, safety drills, emergency response manuals', status: 'active' },
    { id: 5, title: 'Finance Manuals', desc: 'Fee management, budgeting, accounts, and finance procedure manuals', status: 'active' },
    { id: 6, title: 'Operations Manuals', desc: 'Day-to-day operations, facilities, logistics, and support manuals', status: 'active' },
  ],
  manuals: [
    m(1, 1, 'Orientation Day: Activities and Student Integration', 'ACD-001', 'Comprehensive manual covering orientation day activities, student integration programs, and first day protocols.', { title: 'Orientation Day Tutorial', url: YT, desc: 'Step-by-step tutorial for conducting orientation day.' }, [f(1001, 'Student Registration Form', 'FORM-001', 'Page 5', 'New student registration and data collection form.', 'Student_Registration_Form.pdf'), f(1002, 'Orientation Feedback Form', 'FORM-002', 'Page 28', 'Post-orientation feedback form for parents and students.', 'Orientation_Feedback_Form.pdf')], '2026-01-15'),
    m(2, 1, 'First Day(s) Protocol', 'ACD-002', 'Detailed protocols for the first days of school including classroom setup, roll call, and parent communication.', {}, [f(1003, 'Student Attendance Form', 'FORM-003', 'Page 8', 'Daily attendance record form for the first week.', 'Student_Attendance_Form.pdf'), f(1004, 'Parent Contact Log', 'FORM-004', 'Page 15', 'Log for recording first-day parent communications.', 'Parent_Contact_Log.pdf')], '2026-01-20'),
    m(3, 1, 'Positive Classroom Management: Strategies, Procedures and Teacher Conduct', 'ACD-003', 'Manual on classroom management best practices, disciplinary procedures, and professional conduct for teachers.', {}, [f(1005, 'Classroom Incident Report Form', 'FORM-005', 'Page 12', 'Form for documenting classroom incidents.', 'Classroom_Incident_Report.pdf'), f(1006, 'Student Behaviour Tracking Sheet', 'FORM-006', 'Page 19', 'Weekly behaviour monitoring sheet per student.', 'Behaviour_Tracking_Sheet.pdf')], '2026-02-01'),
    m(4, 1, 'Curriculum Development and Textbook Selection', 'ACD-004', 'Guidelines for curriculum design, subject mapping, textbook evaluation, and approval processes.', {}, [f(1007, 'Textbook Review & Evaluation Form', 'FORM-007', 'Page 22', 'Evaluation form for proposed textbooks.', 'Textbook_Review_Form.pdf'), f(1008, 'Curriculum Mapping Template', 'FORM-008', 'Page 34', 'Template for mapping curriculum to learning outcomes.', 'Curriculum_Mapping_Template.pdf')], '2026-02-10'),
    m(5, 1, 'Timetable Design for Learning Balance and School Efficiency', 'ACD-005', 'Step-by-step guide to designing efficient school timetables considering teacher workload and student needs.', {}, [f(1009, 'Teacher Workload Summary Form', 'FORM-009', 'Page 10', 'Form to track and balance teacher workloads.', 'Teacher_Workload_Form.pdf'), f(1010, 'Timetable Draft Approval Sheet', 'FORM-010', 'Page 24', 'Sign-off sheet for timetable approval.', 'Timetable_Approval_Sheet.pdf')], '2026-02-15'),
    m(6, 1, 'Effective Lesson Planning and Instructional Practices', 'ACD-006', 'Manual for writing lesson plans, selecting instructional strategies, and conducting effective lessons.', { title: 'Lesson Planning Tutorial', url: YT, desc: 'How to write effective lesson plans.' }, [f(1011, 'Lesson Plan Template', 'FORM-011', 'Page 12', 'Standard lesson plan format for all subjects.', 'Lesson_Plan_Template.pdf'), f(1012, 'Peer Observation Form', 'FORM-012', 'Page 26', 'Form for teacher peer observation and feedback.', 'Peer_Observation_Form.pdf')], '2026-02-20'),
    m(7, 1, 'Holistic Homework Policy, Implementation and Evaluation', 'ACD-007', 'Policy document and implementation guide for homework standards, evaluation, and parent communication.', {}, [f(1013, 'Homework Completion Log', 'FORM-013', 'Page 9', 'Weekly log for tracking student homework completion.', 'Homework_Completion_Log.pdf'), f(1014, 'Parent Homework Feedback Form', 'FORM-014', 'Page 18', 'Form for parents to provide feedback on homework load.', 'Parent_Homework_Feedback.pdf')], '2026-03-01'),
    m(8, 2, 'Teacher Recruitment & Hiring Framework', 'ADM-001', 'End-to-end framework for recruiting, interviewing, and onboarding new teaching and non-teaching staff.', { title: 'Recruitment Process Tutorial', url: YT, desc: 'Tutorial on using the recruitment framework.' }, [f(1015, 'Teacher Interview Scorecard', 'FORM-015', 'Page 18', 'Scorecard used during teacher interviews.', 'Interview_Scorecard.pdf'), f(1016, 'Reference Check Form', 'FORM-016', 'Page 24', 'Form for conducting candidate reference checks.', 'Reference_Check_Form.pdf')], '2026-01-10'),
    m(9, 3, 'Staff Onboarding & Induction Manual', 'HR-001', 'Complete onboarding process for new staff including orientation, documentation, and probation guidelines.', {}, [f(1017, 'New Employee Checklist', 'FORM-017', 'Page 6', 'Checklist for completing onboarding steps.', 'New_Employee_Checklist.pdf'), f(1018, 'Probation Review Form', 'FORM-018', 'Page 20', 'Mid-probation performance review form.', 'Probation_Review_Form.pdf')], '2026-01-12'),
    m(10, 4, 'Emergency Response & Evacuation Protocol', 'HS-001', 'Emergency response procedures, evacuation drills, first aid protocols, and safety compliance requirements.', { title: 'Emergency Drill Tutorial', url: YT, desc: 'How to conduct a school evacuation drill.' }, [f(1019, 'Evacuation Drill Report Form', 'FORM-019', 'Page 14', 'Post-drill reporting and sign-off form.', 'Evacuation_Drill_Report.pdf'), f(1020, 'First Aid Incident Report', 'FORM-020', 'Page 22', 'Form for documenting first aid incidents.', 'First_Aid_Incident_Report.pdf')], '2026-01-18'),
    m(11, 5, 'Fee Collection & Challan Management Manual', 'FIN-001', 'Procedures for fee collection, challan generation, defaulter tracking, and financial reconciliation.', {}, [f(1021, 'Fee Defaulter Notice Form', 'FORM-021', 'Page 11', 'Notice form sent to fee defaulters.', 'Fee_Defaulter_Notice.pdf'), f(1022, 'Fee Concession Application Form', 'FORM-022', 'Page 18', 'Application form for requesting fee concession.', 'Fee_Concession_Application.pdf')], '2026-02-05'),
    m(12, 6, 'School Facilities & Maintenance Operations Manual', 'OPS-001', 'Guidelines for maintaining school facilities, scheduling maintenance, vendor management, and asset tracking.', {}, [f(1023, 'Maintenance Request Form', 'FORM-023', 'Page 8', 'Form for raising facility maintenance requests.', 'Maintenance_Request_Form.pdf'), f(1024, 'Asset Disposal Approval Form', 'FORM-024', 'Page 21', 'Approval form for disposing school assets.', 'Asset_Disposal_Approval.pdf')], '2026-02-08'),
  ],
}

export function loadSop() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d?.cats) return d } catch { /* reseed */ }
  localStorage.setItem(KEY, JSON.stringify(SEED))
  return JSON.parse(JSON.stringify(SEED))
}
export const saveSop = (d) => localStorage.setItem(KEY, JSON.stringify(d))

/* Normalise a YouTube URL to an embeddable form. */
export function toEmbed(url = '') {
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/')
  if (url.includes('youtu.be/')) return 'https://www.youtube.com/embed/' + url.split('youtu.be/')[1]
  return url
}
