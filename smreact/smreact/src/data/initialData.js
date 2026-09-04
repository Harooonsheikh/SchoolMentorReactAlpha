export const COLORS = ['#1E40AF','#0EA5E9','#F59E0B','#8B5CF6','#EF4444','#06B6D4','#EC4899','#3B82F6'];

/* Khali — classes API se aati hain (ClassesTab ▸ getclassesdata). Pehle yahan ek blank row (id 0, name '') padi thi jo pehle paint par dummy class ki tarah dikhti thi. */
export const INITIAL_CLASSES = [];

export const INITIAL_SUBJECTS = [];

export const INITIAL_BOOK_LISTS = {
 };

/* Khali — departments API se aate hain (DepartmentsTab ▸ getDeparmentdata). */
export const INITIAL_DEPARTMENTS = [];

/* Khali — staff API se aata hai (StaffTab ▸ getStaffdata). */
export const INITIAL_STAFF = [];

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