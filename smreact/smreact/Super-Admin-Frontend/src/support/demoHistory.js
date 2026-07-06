/* ════════════════════════════════════════════════════════════════════
   Demo "Previous Support Sessions" — QA / display data for the AGENT &
   ADMIN side only. The school user never sees this (the school widget only
   loads its own active session). Pure frontend mock; touches no backend, DB,
   SignalR, or text-chat logic.

   Messages use the same UI shape the live chat renders, so they exercise the
   real gallery / voice / video / document rendering. Images are inline SVG
   "screenshots" so everything works offline.
   ════════════════════════════════════════════════════════════════════ */

/* Inline SVG screenshot data-URI (renders as a real <img>). */
function shot(label, c1 = '#1E3A8A', c2 = '#2563EB') {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
    `<rect width="320" height="320" fill="url(#g)"/>` +
    `<rect x="26" y="26" width="268" height="200" rx="12" fill="rgba(255,255,255,.16)"/>` +
    `<rect x="44" y="250" width="180" height="16" rx="8" fill="rgba(255,255,255,.5)"/>` +
    `<rect x="44" y="278" width="120" height="14" rx="7" fill="rgba(255,255,255,.32)"/>` +
    `<text x="160" y="135" font-family="Arial" font-size="20" font-weight="bold" fill="#fff" text-anchor="middle">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

let _id = 1;
const mid = () => `dh${_id++}`;
const text = (kind, sender, body, time) => ({ id: mid(), kind, sender, text: body, time });
const img = (kind, src, name, time) => ({ id: mid(), kind, image: { src, name }, time });
const voice = (kind, sender, secs, time) => ({ id: mid(), kind, sender, audio: { duration: fmt(secs), seconds: secs }, time });
const doc = (kind, name, size, ext, time) => ({ id: mid(), kind, doc: { name, size, ext } , time });
const video = (kind, name, time) => ({ id: mid(), kind, video: { name }, time });
const day = (label) => ({ id: mid(), kind: 'daylabel', text: label });
const note = (body) => ({ id: mid(), kind: 'sysnote', text: body });
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const DEMO_PREVIOUS_SESSIONS = [
  {
    id: 'S1',
    subject: 'Attendance issue',
    schoolName: 'Daffodil Schools', campusName: 'Tarnol Campus',
    agentName: 'Tariq Ahmed', closedBy: 'Tariq Ahmed',
    date: '02 June 2026', startTime: '9:05 AM', endTime: '9:34 AM',
    closingRemarks: 'Attendance register date filter was reset; daily attendance now saving correctly.',
    messages: [
      day('Monday, 02 June 2026'),
      text('in', 'Dr. Asif · Principal', 'Assalam o Alaikum. Today’s attendance is not saving for Class 6.', '9:05 AM'),
      text('out', 'Agent Tariq', 'Walaikum Assalam. Can you share a screenshot of the error?', '9:07 AM'),
      img('in', shot('Attendance Error', '#b91c1c', '#ef4444'), 'attendance_error.png', '9:09 AM'),
      img('in', shot('Class 6 List', '#b91c1c', '#f97316'), 'class6_list.png', '9:09 AM'),
      note('Agent Tariq identified a reset date filter on the attendance register.'),
      text('out', 'Agent Tariq', 'The date filter was stuck on a past week. I’ve reset it — please try saving now.', '9:25 AM'),
      voice('in', 'Dr. Asif · Principal', 14, '9:31 AM'),
      text('in', 'Dr. Asif · Principal', 'It’s working now, JazakAllah!', '9:33 AM'),
    ],
  },
  {
    id: 'S2',
    subject: 'Fee module issue',
    schoolName: 'Daffodil Schools', campusName: 'Tarnol Campus',
    agentName: 'Sara Ali', closedBy: 'Sara Ali',
    date: '28 May 2026', startTime: '11:12 AM', endTime: '11:58 AM',
    closingRemarks: 'Challan generation failed due to an academic session date conflict — corrected from settings.',
    messages: [
      day('Wednesday, 28 May 2026'),
      text('in', 'Accounts Officer', 'Fee challan is not generating for Class 8 since yesterday.', '11:12 AM'),
      img('in', shot('Challan Error', '#0f766e', '#14b8a6'), 'challan_error.png', '11:15 AM'),
      text('out', 'Agent Sara', 'Thanks. Here is a manual challan template you can use meanwhile:', '11:20 AM'),
      doc('out', 'manual_challan_template.pdf', '245 KB · PDF', 'pdf', '11:21 AM'),
      note('Agent Sara found a date conflict in academic session settings.'),
      text('out', 'Agent Sara', 'Fixed the session date conflict. Challan generation works now — please verify.', '11:50 AM'),
      text('in', 'Accounts Officer', 'Confirmed, challans are generating. Thank you!', '11:56 AM'),
    ],
  },
  {
    id: 'S3',
    subject: 'Mobile app login issue',
    schoolName: 'City Grammar School', campusName: 'North Campus',
    agentName: 'Tariq Ahmed', closedBy: 'Tariq Ahmed',
    date: '21 May 2026', startTime: '3:40 PM', endTime: '4:18 PM',
    closingRemarks: 'Parents’ app login fixed — SMS gateway sender ID was misconfigured.',
    messages: [
      day('Wednesday, 21 May 2026'),
      text('in', 'Mr. Imran · Principal', 'Parents cannot log into the mobile app — OTP never arrives.', '3:40 PM'),
      video('in', 'login_screen_recording.mp4', '3:44 PM'),
      text('out', 'Agent Tariq', 'Thanks for the recording. Checking your SMS gateway configuration now.', '3:48 PM'),
      voice('out', 'Agent Tariq', 22, '3:55 PM'),
      note('Sender ID was misconfigured on the SMS gateway.'),
      text('out', 'Agent Tariq', 'Corrected the sender ID. OTPs are being delivered — please ask a parent to retry.', '4:12 PM'),
      text('in', 'Mr. Imran · Principal', 'OTP received and login works. Excellent, thank you.', '4:16 PM'),
    ],
  },
  {
    id: 'S4',
    subject: 'Result card printing issue',
    schoolName: 'Beacon House', campusName: 'Gulberg Campus',
    agentName: 'Sara Ali', closedBy: 'Sara Ali',
    date: '14 May 2026', startTime: '10:02 AM', endTime: '10:46 AM',
    closingRemarks: 'Result card template margins corrected; PDF export aligned for A4.',
    messages: [
      day('Wednesday, 14 May 2026'),
      text('in', 'Ms. Ayesha · Coordinator', 'Result cards are printing with cut-off margins on A4.', '10:02 AM'),
      img('in', shot('Cut-off Print', '#7c3aed', '#a855f7'), 'print_issue_1.png', '10:05 AM'),
      img('in', shot('Margins', '#7c3aed', '#c084fc'), 'print_issue_2.png', '10:05 AM'),
      img('in', shot('A4 Preview', '#6d28d9', '#8b5cf6'), 'print_issue_3.png', '10:06 AM'),
      text('out', 'Agent Sara', 'I see the margin overflow. Sending a corrected template:', '10:20 AM'),
      doc('out', 'result_card_A4_fixed.pdf', '512 KB · PDF', 'pdf', '10:22 AM'),
      doc('out', 'printing_guidelines.docx', '88 KB · DOCX', 'docx', '10:23 AM'),
      text('in', 'Ms. Ayesha · Coordinator', 'Printing perfectly now. JazakAllah.', '10:43 AM'),
    ],
  },
  {
    id: 'S5',
    subject: 'Teacher attendance sync issue',
    schoolName: 'MPS School System', campusName: 'Main Branch',
    agentName: 'Tariq Ahmed', closedBy: 'Super Admin',
    date: '07 May 2026', startTime: '1:15 PM', endTime: '2:03 PM',
    closingRemarks: 'Biometric device time-zone drift corrected; teacher attendance syncing in real time.',
    messages: [
      day('Wednesday, 07 May 2026'),
      text('in', 'HR Manager', 'Teacher attendance from the biometric device is not syncing to the portal.', '1:15 PM'),
      img('in', shot('Sync Error', '#0369a1', '#0ea5e9'), 'sync_error.png', '1:18 PM'),
      voice('in', 'HR Manager', 31, '1:22 PM'),
      text('out', 'Agent Tariq', 'The device clock has drifted by ~7 minutes, breaking the sync window. Fixing now.', '1:40 PM'),
      note('Escalated to Super Admin for device time-zone correction.'),
      text('out', 'Agent Tariq', 'Device time-zone corrected and re-synced. Last 3 days of records are now imported.', '1:58 PM'),
      text('in', 'HR Manager', 'All records are showing. Thank you for the quick help!', '2:01 PM'),
    ],
  },
];
