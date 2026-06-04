export const COLORS = ['#1E40AF','#0EA5E9','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899','#3B82F6'];

export const INITIAL_CLASSES = [
  {
    id: 0,
    name: '',
    branchID: 0,
    createdAt: '0001-01-01T00:00:00',
    createdBy: 0,
    modifiedAt: '0001-01-01T00:00:00',
    modifiedBy: 0,
    isActive: false,
    networkID: null,
    teacher: '',

    sections: [
      {
        sectionID: 0,
        sectionName: '',
        gradeID: 0,
        createdAt: null,
        createdBy: null,
        modifiedAt: null,
        modifiedBy: null,
        isActive: null,
      },
    ],

    feeHeads: [
      { feeStructureID: 0, headName: '', amount: 0 },
    ],
  },
];

export const INITIAL_SUBJECTS = [];

export const INITIAL_BOOK_LISTS = {
 };

export const INITIAL_DEPARTMENTS = [
  {
    id: 0,
    name: '',
    branchID: 0,
    totalDesignationCount: 0,
    createdBy: 0,
    modifiedBy: 0,

    designations: [
      {
        designationID: 0,
        name: '',
        designationName: '',
        branchID: 0,
        departmentID: 0,
        createdBy: 0,
        modifiedBy: 0,
      },
    ],
  },
];

export const INITIAL_STAFF = [
  {
    id: 0,
    cnic: '',
    firstName: '',
    lastName: '',
    fatherName: '',
    gender: '',
    maritalStatus: '',
    countryID: null,
    provinceID: null,
    cityID: null,
    address: '',
    phone: '',
    branchID: null,
    dateOfBirth: null,
    dateOfJoining: null,
    experience: '',
    bloodGroup: '',
    departmentID: null,
    designationID: null,
    qualificationID: null,
    empImage: null,
    basicSalary: 0,
    medicalAllowanace: 0,
    rentAllowance: 0,
    transportAllowance: 0,
    isPrinciple: false,
    isTeacher: false,
    isParent: false,
    email: '',
    createdAt: null,
    createdBy: null,
    modifiedAt: null,
    modifiedBy: null,
    isActive: true
  }
];

// Field names match the API response from GET /api/Registration/get-branch
export const SCHOOL_INFO_DEFAULTS = {
  id:                      0,
  ID:                      0,
  name:                    '',
  branchCode:              '',
  branchEmail1:            '',
  branchPhone:             '',
  branchOwner:             '',
  description:             '',
  address:                 '',
  landmark:                '',
  countryID:               '',
  provinceID:              '',
  cityID:                  '',
  academicSession:         '',
  branchLogo:              '',
  bankName:                '',
  accountTitle:            '',
  bankAccountno:           '',
  iban:                    '',
  branchName:              '',
  accountDesc:             0,
  fineFee:                 0,
  fineEnabled:             0,
  launchSetup:             0,
  isActive:                true,
  isManualRegNo:           true,
  isOperationalSOPs:       true,
  isFeeReceivingHeadWise:  true,
  isDiscChallan:           true,
  isTransportFee:          true,
  isPLNeeded:              true,
  createdAt:               '',
  createdBy:               0,
};

export const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];