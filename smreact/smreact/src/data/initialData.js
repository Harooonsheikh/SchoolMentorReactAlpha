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
  {id:1,firstName:'Dr Islahudin',lastName:'',fatherName:'MKA',cnic:'35101',dob:'2003-12-05',gender:'Male',maritalStatus:'Single',address:'',mobile:'03119456045',bloodGroup:'A+',dept:'Administration',designation:'Principal',country:'Pakistan',province:'ICT',city:'Islamabad',qualification:'PhD',experience:'10 years',joiningDate:'2025-04-29',salary:30000,medical:5000,rent:5000,transport:500,tasks:{},verified:true,locked:false},
  {id:2,firstName:'Alpha',lastName:'',fatherName:'',cnic:'',dob:'',gender:'Male',maritalStatus:'',address:'',mobile:'',bloodGroup:'',dept:'Administration',designation:'Principal',country:'Pakistan',province:'Punjab',city:'Rawalpindi',qualification:'',experience:'',joiningDate:'',salary:0,medical:0,rent:0,transport:0,tasks:{},verified:false,locked:true},
  {id:3,firstName:'Gamma',lastName:'',fatherName:'',cnic:'',dob:'',gender:'Male',maritalStatus:'',address:'',mobile:'',bloodGroup:'',dept:'Administration',designation:'Vice Principal',country:'',province:'',city:'',qualification:'',experience:'',joiningDate:'',salary:0,medical:0,rent:0,transport:0,tasks:{},verified:true,locked:false},
  {id:4,firstName:'Pi',lastName:'',fatherName:'',cnic:'',dob:'',gender:'Male',maritalStatus:'',address:'',mobile:'',bloodGroup:'',dept:'Academics',designation:'Teacher English',country:'',province:'',city:'',qualification:'',experience:'',joiningDate:'',salary:0,medical:0,rent:0,transport:0,tasks:{},verified:false,locked:true},
  {id:5,firstName:'Xi',lastName:'',fatherName:'',cnic:'',dob:'',gender:'Female',maritalStatus:'',address:'',mobile:'',bloodGroup:'',dept:'Academics',designation:'Teacher SST',country:'',province:'',city:'',qualification:'',experience:'',joiningDate:'',salary:0,medical:0,rent:0,transport:0,tasks:{},verified:false,locked:false},
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