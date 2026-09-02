/* Pre-Enrollment mock data.

   A pre-enrolled student is added through the exact same Add Student form
   used for direct admission (same fields, same reg/adm numbering), but
   held in this separate list until Head Office confirms them — at which
   point "Enroll" moves the record into the real Active Students roster,
   or "Send to Inactive" moves it into Inactive Students if they don't
   proceed. Module-level mutable array (mirrors mockStuInactive's pattern)
   so writes survive across the Students module's tabs. */

export const mockPreEnrollFeeHeads = [
  { name: 'Prospectus / Registration Fee', amt: 2000 },
  { name: 'Admission Fee', amt: 21000 },
  { name: 'Inventory / Uniform Charges', amt: 6000 },
];

export const mockPreEnrollStudents = [
  {
    preId: 'PRE-2026-0001',
    first: 'Hamza', last: 'Sheikh', gender: 'Male', dob: '2017-03-12',
    cls: 'Class 3', sec: 'A', bform: '35202-1234567-1', nat: 'Pakistani',
    reg: '2026-90001', adm: '9001', family: '', admdate: '2026-08-05',
    father: 'Imran Sheikh', fcnic: '35202-7654321-1', focc: 'Businessman',
    mobile: '0300-1234567', mother: 'Ayesha Sheikh', mcnic: '35202-7654321-2',
    guardian: '', gcontact: '', email: 'imran.sheikh@example.com',
    address: 'House 12, Model Town, Lahore', pschool: 'Beaconhouse', pgrade: 'Class 2',
    pcontact: '0300-1234567', photo: null, stdDocs: {}, docs: [], _disc: {},
    createdAt: '2026-08-05',
    challan: {
      heads: [
        { name: 'Prospectus / Registration Fee', amt: 2000 },
        { name: 'Admission Fee', amt: 21000 },
      ],
      month: 'August', type: '1', total: 23000, generatedAt: '2026-08-05T10:00:00',
    },
    payments: [
      { id: 'pep-1', date: '2026-08-05', method: 'Cash', ref: 'PRE-2026-0001', txn: '', amount: 2000,
        perHead: { 'Prospectus / Registration Fee': 2000 }, createdAt: '2026-08-05T10:05:00' },
    ],
  },
  {
    preId: 'PRE-2026-0002',
    first: 'Zara', last: 'Malik', gender: 'Female', dob: '2021-06-20',
    cls: 'Nursery', sec: 'B', bform: '35202-2345678-2', nat: 'Pakistani',
    reg: '2026-90002', adm: '9002', family: '', admdate: '2026-08-11',
    father: 'Kashif Malik', fcnic: '35202-8765432-1', focc: 'Engineer',
    mobile: '0301-2345678', mother: 'Sana Malik', mcnic: '35202-8765432-2',
    guardian: '', gcontact: '', email: 'kashif.malik@example.com',
    address: 'House 45, DHA Phase 3, Lahore', pschool: '', pgrade: '',
    pcontact: '0301-2345678', photo: null, stdDocs: {}, docs: [], _disc: {},
    createdAt: '2026-08-11',
    challan: null,
    payments: [],
  },
  {
    preId: 'PRE-2026-0003',
    first: 'Bilal', last: 'Ahmed', gender: 'Male', dob: '2015-11-02',
    cls: 'Class 5', sec: 'B', bform: '35202-3456789-3', nat: 'Pakistani',
    reg: '2026-90003', adm: '9003', family: '', admdate: '2026-08-19',
    father: 'Waqas Ahmed', fcnic: '35202-9876543-1', focc: 'Doctor',
    mobile: '0302-3456789', mother: 'Rabia Ahmed', mcnic: '35202-9876543-2',
    guardian: '', gcontact: '', email: 'waqas.ahmed@example.com',
    address: 'House 7, Johar Town, Lahore', pschool: 'The City School', pgrade: 'Class 4',
    pcontact: '0302-3456789', photo: null, stdDocs: {}, docs: [], _disc: {},
    createdAt: '2026-08-19',
    challan: {
      heads: [{ name: 'Prospectus / Registration Fee', amt: 2000 }],
      month: 'August', type: '1', total: 2000, generatedAt: '2026-08-19T11:15:00',
    },
    payments: [],
  },
];
