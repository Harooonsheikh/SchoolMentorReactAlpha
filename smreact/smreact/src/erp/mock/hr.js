/* HR mock data — ported from School-Mentor-Front-end for Annual Leave Summary Report */

export const mockHrStats = {
  totalStaff: 87,
  teachingStaff: 62,
  onLeaveToday: 4,
  openPositions: 3,
};

export const mockHrDepts = [
  { id: 1, name: 'Administration',   desc: 'School administration and management' },
  { id: 2, name: 'Academics',        desc: 'Teaching and curriculum' },
  { id: 3, name: 'Security',         desc: 'Campus security and safety' },
  { id: 4, name: 'Quality Control',  desc: 'Quality assurance and audits' },
  { id: 5, name: 'Support Staff',    desc: 'Cleaning, facilities and campus support' },
];

export const mockHrDesigs = [
  { id: 1, dId: 1, name: 'Principal',        qual: 'MSc',    desc: 'Head of institution' },
  { id: 2, dId: 1, name: 'Vice Principal',   qual: 'MSc',    desc: 'Deputy head' },
  { id: 3, dId: 1, name: 'Accountant',       qual: 'B.Com',  desc: 'Financial accounts' },
  { id: 4, dId: 2, name: 'Teacher English',  qual: 'BA',     desc: 'English teacher' },
  { id: 5, dId: 2, name: 'Teacher SST',      qual: 'BEd',    desc: 'Social studies teacher' },
  { id: 6, dId: 2, name: 'Teacher Science',  qual: 'BSc',    desc: 'Science teacher' },
  { id: 7, dId: 3, name: 'Security Guard',   qual: 'Matric', desc: 'Campus guard' },
  { id: 8, dId: 4, name: 'QA Officer',       qual: 'MBA',    desc: 'Quality auditor' },
  { id: 9,  dId: 2, name: 'Teacher Math', qual: 'BSc', desc: 'Mathematics teacher' },
  { id: 10, dId: 2, name: 'Teacher Urdu', qual: 'BA',  desc: 'Urdu teacher' },
  { id: 11, dId: 5, name: 'Cleaner / Support Staff', qual: 'Matric', desc: 'Cleaning and campus support' },
];

export function hrDefaultLeaves() {
  return {
    annual: 20, casual: 10, sick: 8, maternity: 0, balance: 20,
    policy: 'Standard', deductEn: true, absentDed: 100, unpaidDed: 1000,
  };
}

export const mockHrEmployees = [
  {
    id: 1, eid: 'EMP-001',
    firstName: 'Dr. Islahudin', lastName: '', fn: 'MKA',
    dId: 1, desId: 1, join: '2025-04-29', type: 'Permanent', status: 'Active',
    basicSalary: 80000,
    leaves: { annual: 25, casual: 10, sick: 8, maternity: 0, balance: 23, policy: 'Senior Staff', deductEn: true, absentDed: 200, unpaidDed: 1500 },
  },
  {
    id: 2, eid: 'EMP-002',
    firstName: 'Alpha', lastName: '',
    dId: 1, desId: 1, join: '2024-08-15', type: 'Permanent', status: 'Active',
    basicSalary: 60000,
    leaves: hrDefaultLeaves(),
  },
  {
    id: 3, eid: 'EMP-003',
    firstName: 'Gamma', lastName: '',
    dId: 1, desId: 2, join: '2024-03-01', type: 'Permanent', status: 'Active',
    basicSalary: 55000,
    leaves: hrDefaultLeaves(),
  },
  {
    id: 4, eid: 'EMP-004',
    firstName: 'Pi', lastName: '',
    dId: 2, desId: 4, join: '2023-09-01', type: 'Permanent', status: 'Active',
    basicSalary: 40000,
    leaves: hrDefaultLeaves(),
  },
  {
    id: 5, eid: 'EMP-005',
    firstName: 'Xi', lastName: '',
    dId: 2, desId: 5, join: '2024-01-10', type: 'Contractual', status: 'Active',
    basicSalary: 38000,
    leaves: hrDefaultLeaves(),
  },
  {
    id: 11, eid: 'EMP-011', firstName: 'Mr. Ahmed Ali', lastName: '',
    dId: 2, desId: 6, join: '2022-03-01', type: 'Permanent', status: 'Active',
    basicSalary: 60000,
    leaves: { annual: 20, casual: 10, sick: 8, maternity: 0, balance: 14, policy: 'Standard', deductEn: true, absentDed: 100, unpaidDed: 1000 },
  },
  {
    id: 12, eid: 'EMP-012', firstName: 'Ms. Fatima Noor', lastName: '',
    dId: 2, desId: 4, join: '2021-08-15', type: 'Permanent', status: 'Active',
    basicSalary: 62000,
    leaves: { annual: 20, casual: 10, sick: 8, maternity: 0, balance: 18, policy: 'Standard', deductEn: true, absentDed: 100, unpaidDed: 1000 },
  },
  {
    id: 13, eid: 'EMP-013', firstName: 'Mr. Usman Raza', lastName: '',
    dId: 2, desId: 9, join: '2023-01-10', type: 'Permanent', status: 'Active',
    basicSalary: 58000,
    leaves: { annual: 20, casual: 10, sick: 8, maternity: 0, balance: 9, policy: 'Standard', deductEn: true, absentDed: 100, unpaidDed: 1000 },
  },
  {
    id: 14, eid: 'EMP-014', firstName: 'Ms. Ayesha Khan', lastName: '',
    dId: 2, desId: 10, join: '2020-06-01', type: 'Permanent', status: 'Active',
    basicSalary: 57000,
    leaves: { annual: 20, casual: 10, sick: 8, maternity: 2, balance: 21, policy: 'Standard', deductEn: true, absentDed: 100, unpaidDed: 1000 },
  },
  {
    id: 15, eid: 'EMP-015', firstName: 'Mr. Bilal Hassan', lastName: '',
    dId: 2, desId: 5, join: '2019-09-01', type: 'Permanent', status: 'Active',
    basicSalary: 61000,
    leaves: { annual: 20, casual: 10, sick: 8, maternity: 0, balance: 5, policy: 'Standard', deductEn: true, absentDed: 100, unpaidDed: 1000 },
  },
];

export const mockHrNextDeptId  = 6;
export const mockHrNextDesigId = 9;
export const mockHrNextEmpId   = 7;
