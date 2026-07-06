/* ═══════════════════════════════════════════════════════════════════
   OPERATIONAL SOPs — demo data (frontend only)

   Ported from "User Permission, quiz, SOPs, and PAYMENTS .html". Category
   "manual heads" each contain manuals; each manual has a PDF, a tutorial
   video, and attached forms. Mock data only — the integrating developer
   swaps this for API calls + real file storage.
   ═══════════════════════════════════════════════════════════════════ */

export const INITIAL_SOP = {
  catSeq: 10, manualSeq: 100, formSeq: 1000,
  cats: [
    { id: 1, title: 'Academic Manuals',        desc: 'Teaching, learning, assessment, and academic operations manuals',       status: 'active' },
    { id: 2, title: 'Administrative Manuals',   desc: 'School administration, office procedures and compliance manuals',        status: 'active' },
    { id: 3, title: 'HR Manuals',               desc: 'Staff recruitment, onboarding, conduct, and HR policy manuals',          status: 'active' },
    { id: 4, title: 'Health & Safety Manuals',  desc: 'Health protocols, safety drills, emergency response manuals',            status: 'active' },
    { id: 5, title: 'Finance Manuals',          desc: 'Fee management, budgeting, accounts, and finance procedure manuals',     status: 'active' },
    { id: 6, title: 'Operations Manuals',       desc: 'Day-to-day operations, facilities, logistics, and support manuals',      status: 'active' },
  ],
  manuals: [
    { id: 1, catId: 1, title: 'Orientation Day: Activities and Student Integration', code: 'ACD-001', desc: 'Comprehensive manual covering orientation day activities, student integration programs, and first day protocols.', pdfName: '', vidTitle: 'Orientation Day Tutorial', vidUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', vidDesc: 'Step-by-step tutorial for conducting orientation day.', vidStatus: 'available', status: 'active', createdAt: '2026-01-15', forms: [
      { id: 1001, title: 'Student Registration Form', code: 'FORM-001', pageRef: 'Page 5', desc: 'New student registration and data collection form.', fileName: 'Student_Registration_Form.pdf' },
      { id: 1002, title: 'Orientation Feedback Form', code: 'FORM-002', pageRef: 'Page 28', desc: 'Post-orientation feedback form for parents and students.', fileName: 'Orientation_Feedback_Form.pdf' },
    ] },
    { id: 2, catId: 1, title: 'First Day(s) Protocol', code: 'ACD-002', desc: 'Detailed protocols for the first days of school including classroom setup, roll call, and parent communication.', pdfName: '', vidTitle: '', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-01-20', forms: [
      { id: 1003, title: 'Student Attendance Form', code: 'FORM-003', pageRef: 'Page 8', desc: 'Daily attendance record form for the first week.', fileName: 'Student_Attendance_Form.pdf' },
      { id: 1004, title: 'Parent Contact Log', code: 'FORM-004', pageRef: 'Page 15', desc: 'Log for recording first-day parent communications.', fileName: 'Parent_Contact_Log.pdf' },
    ] },
    { id: 3, catId: 1, title: 'Positive Classroom Management: Strategies, Procedures and Teacher Conduct', code: 'ACD-003', desc: 'Manual on classroom management best practices, disciplinary procedures, and professional conduct for teachers.', pdfName: '', vidTitle: 'Classroom Management Tutorial', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-02-01', forms: [
      { id: 1005, title: 'Classroom Incident Report Form', code: 'FORM-005', pageRef: 'Page 12', desc: 'Form for documenting classroom incidents.', fileName: 'Classroom_Incident_Report.pdf' },
      { id: 1006, title: 'Student Behaviour Tracking Sheet', code: 'FORM-006', pageRef: 'Page 19', desc: 'Weekly behaviour monitoring sheet per student.', fileName: 'Behaviour_Tracking_Sheet.pdf' },
    ] },
    { id: 4, catId: 1, title: 'Curriculum Development and Textbook Selection', code: 'ACD-004', desc: 'Guidelines for curriculum design, subject mapping, textbook evaluation, and approval processes.', pdfName: '', vidTitle: '', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-02-10', forms: [
      { id: 1007, title: 'Textbook Review & Evaluation Form', code: 'FORM-007', pageRef: 'Page 22', desc: 'Evaluation form for proposed textbooks.', fileName: 'Textbook_Review_Form.pdf' },
      { id: 1008, title: 'Curriculum Mapping Template', code: 'FORM-008', pageRef: 'Page 34', desc: 'Template for mapping curriculum to learning outcomes.', fileName: 'Curriculum_Mapping_Template.pdf' },
    ] },
    { id: 5, catId: 1, title: 'Timetable Design for Learning Balance and School Efficiency', code: 'ACD-005', desc: 'Step-by-step guide to designing efficient school timetables considering teacher workload and student needs.', pdfName: '', vidTitle: '', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-02-15', forms: [
      { id: 1009, title: 'Teacher Workload Summary Form', code: 'FORM-009', pageRef: 'Page 10', desc: 'Form to track and balance teacher workloads.', fileName: 'Teacher_Workload_Form.pdf' },
      { id: 1010, title: 'Timetable Draft Approval Sheet', code: 'FORM-010', pageRef: 'Page 24', desc: 'Sign-off sheet for timetable approval.', fileName: 'Timetable_Approval_Sheet.pdf' },
    ] },
    { id: 6, catId: 1, title: 'Effective Lesson Planning and Instructional Practices', code: 'ACD-006', desc: 'Manual for writing lesson plans, selecting instructional strategies, and conducting effective lessons.', pdfName: '', vidTitle: 'Lesson Planning Tutorial', vidUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', vidDesc: 'How to write effective lesson plans.', vidStatus: 'available', status: 'active', createdAt: '2026-02-20', forms: [
      { id: 1011, title: 'Lesson Plan Template', code: 'FORM-011', pageRef: 'Page 12', desc: 'Standard lesson plan format for all subjects.', fileName: 'Lesson_Plan_Template.pdf' },
      { id: 1012, title: 'Peer Observation Form', code: 'FORM-012', pageRef: 'Page 26', desc: 'Form for teacher peer observation and feedback.', fileName: 'Peer_Observation_Form.pdf' },
    ] },
    { id: 7, catId: 1, title: 'Holistic Homework Policy, Implementation and Evaluation', code: 'ACD-007', desc: 'Policy document and implementation guide for homework standards, evaluation, and parent communication.', pdfName: '', vidTitle: '', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-03-01', forms: [
      { id: 1013, title: 'Homework Completion Log', code: 'FORM-013', pageRef: 'Page 9', desc: 'Weekly log for tracking student homework completion.', fileName: 'Homework_Completion_Log.pdf' },
      { id: 1014, title: 'Parent Homework Feedback Form', code: 'FORM-014', pageRef: 'Page 18', desc: 'Form for parents to provide feedback on homework load.', fileName: 'Parent_Homework_Feedback.pdf' },
    ] },
    { id: 8, catId: 2, title: 'Teacher Recruitment & Hiring Framework', code: 'ADM-001', desc: 'End-to-end framework for recruiting, interviewing, and onboarding new teaching and non-teaching staff.', pdfName: '', vidTitle: 'Recruitment Process Tutorial', vidUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', vidDesc: 'Tutorial on using the recruitment framework.', vidStatus: 'available', status: 'active', createdAt: '2026-01-10', forms: [
      { id: 1015, title: 'Teacher Interview Scorecard', code: 'FORM-015', pageRef: 'Page 18', desc: 'Scorecard used during teacher interviews.', fileName: 'Interview_Scorecard.pdf' },
      { id: 1016, title: 'Reference Check Form', code: 'FORM-016', pageRef: 'Page 24', desc: 'Form for conducting candidate reference checks.', fileName: 'Reference_Check_Form.pdf' },
    ] },
    { id: 9, catId: 3, title: 'Staff Onboarding & Induction Manual', code: 'HR-001', desc: 'Complete onboarding process for new staff including orientation, documentation, and probation guidelines.', pdfName: '', vidTitle: '', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-01-12', forms: [
      { id: 1017, title: 'New Employee Checklist', code: 'FORM-017', pageRef: 'Page 6', desc: 'Checklist for completing onboarding steps.', fileName: 'New_Employee_Checklist.pdf' },
      { id: 1018, title: 'Probation Review Form', code: 'FORM-018', pageRef: 'Page 20', desc: 'Mid-probation performance review form.', fileName: 'Probation_Review_Form.pdf' },
    ] },
    { id: 10, catId: 4, title: 'Emergency Response & Evacuation Protocol', code: 'HS-001', desc: 'Emergency response procedures, evacuation drills, first aid protocols, and safety compliance requirements.', pdfName: '', vidTitle: 'Emergency Drill Tutorial', vidUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', vidDesc: 'How to conduct a school evacuation drill.', vidStatus: 'available', status: 'active', createdAt: '2026-01-18', forms: [
      { id: 1019, title: 'Evacuation Drill Report Form', code: 'FORM-019', pageRef: 'Page 14', desc: 'Post-drill reporting and sign-off form.', fileName: 'Evacuation_Drill_Report.pdf' },
      { id: 1020, title: 'First Aid Incident Report', code: 'FORM-020', pageRef: 'Page 22', desc: 'Form for documenting first aid incidents.', fileName: 'First_Aid_Incident_Report.pdf' },
    ] },
    { id: 11, catId: 5, title: 'Fee Collection & Challan Management Manual', code: 'FIN-001', desc: 'Procedures for fee collection, challan generation, defaulter tracking, and financial reconciliation.', pdfName: '', vidTitle: '', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-02-05', forms: [
      { id: 1021, title: 'Fee Defaulter Notice Form', code: 'FORM-021', pageRef: 'Page 11', desc: 'Notice form sent to fee defaulters.', fileName: 'Fee_Defaulter_Notice.pdf' },
      { id: 1022, title: 'Fee Concession Application Form', code: 'FORM-022', pageRef: 'Page 18', desc: 'Application form for requesting fee concession.', fileName: 'Fee_Concession_Application.pdf' },
    ] },
    { id: 12, catId: 6, title: 'School Facilities & Maintenance Operations Manual', code: 'OPS-001', desc: 'Guidelines for maintaining school facilities, scheduling maintenance, vendor management, and asset tracking.', pdfName: '', vidTitle: '', vidUrl: '', vidDesc: '', vidStatus: 'coming_soon', status: 'active', createdAt: '2026-02-08', forms: [
      { id: 1023, title: 'Maintenance Request Form', code: 'FORM-023', pageRef: 'Page 8', desc: 'Form for raising facility maintenance requests.', fileName: 'Maintenance_Request_Form.pdf' },
      { id: 1024, title: 'Asset Disposal Approval Form', code: 'FORM-024', pageRef: 'Page 21', desc: 'Approval form for disposing school assets.', fileName: 'Asset_Disposal_Approval.pdf' },
    ] },
  ],
};

export const hasPdf = (m) => Boolean(m.pdfFile || m.pdfName);
export const hasVideo = (m) => Boolean(m.vidUrl && m.vidStatus === 'available');

/* Normalise a YouTube URL to an embeddable form. */
export function embedUrl(url) {
  if (!url) return '';
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
  if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]}`;
  return url;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
