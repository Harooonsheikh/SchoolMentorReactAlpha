import React, { useCallback, useEffect, useRef, useState } from 'react';
import { COLORS } from '../data/initialData';
import { downloadStaffReport } from '../utils/pdfReports';
import { buildUrl } from '../utils/apiConfig';
import staffTemplate from '../BulkStaff_Quick.xlsx';

const STAFF_PER_PAGE = 8;

const GENDER = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const MARITAL = ['Single', 'Married', 'Divorced', 'Widowed'];

function StaffModal({ open, staff, deptsData, onClose, onSave, setDeptsData, showToast }) {
  const [tab, setTab] = useState('personal');
  const [subTab, setSubTab] = useState('official');
  const [form, setForm] = useState({});
   const [countryList, setCountryList]   = useState([]);
    const [provinceList, setProvinceList] = useState([]);
    const [cityList, setCityList]         = useState([]);
  const [Qualification, setQualification] = useState({});
  /* Duplicate-number popup: number pehle se ho to email maango, email ko phone field me
     map karke email ke through add karo. */
  const [dupPopup, setDupPopup] = useState(false);
  const [dupEmail, setDupEmail] = useState('');


  React.useEffect(() => {
    if (open && staff) {
      const dateOnly = (v) => (v ? String(v).split('T')[0] : '');
      setForm({
        ...staff,
        // map API field names → the keys the dropdowns/inputs use
        dept:          staff.departmentID  ?? staff.dept ?? '',
        designation:   staff.designationID ?? staff.designation ?? '',
        country:       staff.countryID     ?? staff.country ?? 4,
        province:      staff.provinceID    ?? staff.province ?? 13,
        city:          staff.cityID        ?? staff.city ?? 20,
        qualification: staff.qualificationID ?? staff.qualification ?? '',
        joiningDate:   dateOnly(staff.dateOfJoining ?? staff.joiningDate),
        dateOfBirth:   dateOnly(staff.dateOfBirth),
        basicSalary:        staff.basicSalary        ?? staff.salary ?? 0,
        medicalAllowanace:   staff.medicalAllowanace  ?? staff.medical ?? 0,
        rentAllowance:       staff.rentAllowance      ?? staff.rent ?? 0,
        transportAllowance:  staff.transportAllowance ?? staff.transport ?? 0,
        isPrincipal:   staff.isPrinciple ?? staff.isPrincipal ?? false,
        // Naya staff (id null) → by default Teacher; existing edit → jo saved tha wahi.
        isTeacher:     staff.isTeacher ?? (staff.id == null),
        isParent:      staff.isParent ?? false,
        // show existing image (URL); keep file undefined until user picks a new one
        profileImage:  staff.empImage ?? staff.profileImage ?? '',
        profileImageFile: undefined,
      });
    }
    if (!open) { setTab('personal'); setSubTab('official'); }
  }, [open, staff]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const getDeparmentdata = useCallback(async () => {
    try {
      const branchID = sessionStorage.getItem('branchID');
      const res      = await fetch(buildUrl(`/api/LaunchSetup/get-departments-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
      const json     = await res.json();
      const d        = json.data ?? {};
      setDeptsData(d);
    } catch { showToast('Could not load branch data', 'error'); }
  }, [setDeptsData, showToast]);

  async function getCountryList() {
      try {
        const res  = await fetch(buildUrl('/api/Setting/get-countries'), { headers: { Accept: '*/*' } });
        const json = await res.json();
        setCountryList(json.data ?? []);
      } catch { showToast('Could not load countries', 'error'); }
    }
  
    async function getProvinceList(countryId) {
      try {
        const res  = await fetch(buildUrl(`/api/Setting/get-provinces-by-country/${countryId}`), { headers: { Accept: '*/*' } });
        const json = await res.json();
        setProvinceList(json.data ?? []);
      } catch { showToast('Could not load provinces', 'error'); }
    }
  
    async function getCityList(provinceId) {
      try {
        const res  = await fetch(buildUrl(`/api/Setting/get-cities-by-province/${provinceId}`), { headers: { Accept: '*/*' } });
        const json = await res.json();
        setCityList(json.data ?? []);
      } catch { showToast('Could not load cities', 'error'); }
    }

    async function getQualification() {
          try {
            const res  = await fetch(buildUrl(`/api/LaunchSetup/get-qualifications/0`), { headers: { Accept: '*/*' } });
            const json = await res.json();
            setQualification(json.data ?? []);
            console.log(Qualification)
          } catch { showToast('Could not load cities', 'error'); }
        }

  useEffect(() => {
    if (open) {
      getDeparmentdata();
      getCountryList();
      getQualification();
      if (staff?.countryID ?? staff?.country)  getProvinceList(staff.countryID ?? staff.country);
      if (staff?.provinceID ?? staff?.province) getCityList(staff.provinceID ?? staff.province);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, getDeparmentdata]);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(prev => ({ ...prev, profileImageFile: file }));
    const reader = new FileReader();
    reader.onload = () => set('profileImage', reader.result);
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  const deptList = Array.isArray(deptsData) ? deptsData : [];
  const selectedDept = deptList.find(d => String(d.id) === String(form.dept));
  const desigOptions = selectedDept?.designations ?? [];
  const isNew = !staff?.id || staff?.id === 'new';

  // small green "looks good" helper
  const Good = ({ show, text }) => show ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--success)', marginTop: 5 }}>
      <i className="fas fa-check-circle" style={{ fontSize: 12 }}></i> {text}
    </span>
  ) : null;

  // footer button changes per tab/subtab
  const footerBtn = () => {
    if (tab === 'personal') {
      return (
        <button className="btn btn-primary btn-md" onClick={() => [handleSave(), console.log(form)]}>
          <i className="fas fa-save"></i> Save
        </button>
      );
    }
    if (subTab === 'official') {
      return (
        <button className="btn btn-primary btn-md" onClick={() => [handleupdateOffical(), console.log(form)]}>
          <i className="fas fa-arrow-right"></i> Save & Next
        </button>
      );
    }
    return (
      <button className="btn btn-primary btn-md" onClick={() => [handleupdatesalary(), console.log(form), ]}>
        <i className="fas fa-save"></i> Save & Close
      </button>
    );
  };

  const handleSave = async (phoneOverride) => {
    /* phoneOverride: duplicate-number popup se aane wala email — Phone field ki jagah
       is email ko use karo (email ke through add). Warna normal form.phone. */
    const effPhone = (typeof phoneOverride === 'string' && phoneOverride.trim())
      ? phoneOverride.trim() : form.phone;
    /* Personal Information ke required fields (form par * waale). Koi bhi missing ho
       to yahin rok do aur us EXACT field ka toast dikhao — taake API call na ho aur
       galti se "Employee saved successfully" wala toast na aaye. */
    const requiredFields = [
      ['firstName',  'First Name'],
      ['fatherName', 'Father / Husband Name'],
      ['cnic',       'CNIC'],
      ['phone',      'Phone Number'],
    ];
    for (const [key, label] of requiredFields) {
      const v = key === 'phone' ? effPhone : form[key];
      if (!v || !String(v).trim()) {
        showToast(`${label} is required`, 'error');
        return;
      }
    }
    /* Role UI hidden hai aur har staff by default Teacher (isTeacher = true) hota
       hai — is liye role-selection validation ki zaroorat nahi rahi. */
    // if (!form.isPrincipal && !form.isTeacher && !form.isParent) {
    //   showToast('Please select at least one role (Principal or Teacher).', 'error');
    //   return;
    // }
    if (form.dateOfBirth && form.dateOfBirth > new Date().toISOString().slice(0, 10)) {
      showToast('Date of birth cannot be in the future.', 'error');
      return;
    }
      try {
        const UserID = sessionStorage.getItem('UserID') || 0;
        const BranchID = sessionStorage.getItem('branchID') || 0;
        const now = new Date().toISOString();
        const fd = new FormData();
        fd.append('ID',                  form.id ?? form.ID ?? 0);
        fd.append('CNIC',                form.cnic ?? '');
        fd.append('FirstName',           form.firstName ?? '');
        fd.append('LastName',            form.lastName ?? '');
        fd.append('FatherName',          form.fatherName ?? '');
        fd.append('Gender',              form.gender ?? '');
        // fd.append('MaritalStatus',       form.maritalStatus ?? '');
        fd.append('CountryID',           form.country || 0);
        fd.append('ProvinceID',          form.province || 0);
        fd.append('CityID',              form.city || 0);
        fd.append('Address',             form.address ?? '');
        fd.append('Phone',               effPhone ?? '');
        fd.append('BranchID',            BranchID);
        fd.append('DateOfBirth',         form.dateOfBirth ?? now);
        fd.append('DateOfJoining',       form.joiningDate ?? '');
        fd.append('experience', form.experience == null || form.experience === '' ? 0 : form.experience);
        fd.append(
  'Email',
  form.email == null || form.email.trim() === ''
    ? 'N/A'
    : form.email
);

fd.append(
  'EmpImage',
  form.empImage == null || form.empImage.trim() === ''
    ? 'N/A'
    : form.empImage
);

fd.append(
  'BloodGroup',
  form.bloodGroup == null || form.bloodGroup.trim() === ''
    ? 'N/A'
    : form.bloodGroup
);

fd.append(
  'MaritalStatus',
  form.maritalStatus == null || form.maritalStatus.trim() === ''
    ? 'N/A'
    : form.maritalStatus
);
        fd.append('bloodGroup',          form.bloodGroup ?? '');
        fd.append('DepartmentID',        form.dept || 0);
        fd.append('DesignationID',       form.designation || 0);
        fd.append('QualificationID',     form.qualification || 0);
        fd.append('EmpImage',            form.empImage ?? '');
        fd.append('BasicSalary',         form.basicSalary || 0);
        fd.append('MedicalAllowanace',   form.medicalAllowanace || 0);
        fd.append('RentAllowance',       form.rentAllowance || 0);
        fd.append('TransportAllowance',  form.transportAllowance || 0);
        fd.append('IsPrinciple',         form.isPrincipal ? true : false);
        fd.append('IsTeacher',           form.isTeacher ? true : false);
        fd.append('IsParent',            form.isParent ? true : false);
        fd.append('Email',               form.email ?? '');
        fd.append('CreatedAt',           now);
        fd.append('CreatedBy',           UserID);
        fd.append('ModifiedAt',          now);
        fd.append('ModifiedBy',          UserID);
        fd.append('IsActive',            true);
        fd.append('DepartmentName',       'test');
        fd.append('DesignationName',      'test');
        fd.append('QualificationName',    'test');
        if (form.profileImageFile) fd.append('EmpImageFile', form.profileImageFile);

        const res  = await fetch(buildUrl('/api/LaunchSetup/save-employee'), { method: 'POST', headers: { Accept: '*/*' }, body: fd });
        const data = await res.json();

        if (res.status == 200) {
          /* API HTTP 200 + top-level "Employee saved successfully" deta hai, magar
             ASLI result data[0] ke andar hota hai. Duplicate (e.g. CNIC/phone) par
             data[0] = { Success: 0, Message: "Number already exist" } aata hai — is
             case ko fail samjho aur inner Message ka error toast dikhao (na "saved"). */
          const inner = Array.isArray(data?.data) ? data.data[0] : null;
          if (inner && (inner.Success === 0 || inner.Success === false)) {
            const msg = inner.Message || data?.message || 'Save failed';
            showToast(msg, 'error');   // toaster same rahega ("Number already exist")
            /* Duplicate number → popup kholo taake email de kar (email ke through) add ho sake.
               Agar ye pehle se email-retry tha aur wo bhi duplicate nikla, to us email ko
               prefill karke dobara maango (loop nahi — user ko Enter dabana padega). */
            if (/exist|number|already/i.test(msg)) {
              setDupEmail(phoneOverride ? String(phoneOverride) : '');
              setDupPopup(true);
            }
            return false;
          }
          const newId = inner?.id ?? data?.id ?? inner?.ID ?? data?.ID;
          if (newId) setForm(prev => ({ ...prev, id: newId }));
          showToast('Employee saved successfully', 'success');
           setTab('employee')
           setSubTab('official')
          return true;
        }
        showToast(data?.message || 'Save failed', 'error');
        return false;
      } catch (err) {
        showToast('Network error. Please try again.', 'error');
        console.error(err);
        return false;
      }
    };

    /* Duplicate-number popup ka Enter/Confirm: email ko phone-number field me map karo
       (UI bhi update) aur usi email ke through dobara add karo. */
    const confirmDupEmail = () => {
      const email = (dupEmail || '').trim();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        showToast('Please enter a valid email', 'error');
        return;
      }
      set('phone', email);      // email → phone-number input (field me dikhega)
      setDupPopup(false);
      handleSave(email);        // email ke saath add (reliable override, stale state se bachne ke liye)
    };

    const handleupdateOffical = async() => {
         try {
          // Department & Designation are required — block the save and keep the modal open.
          if (!form.dept || Number(form.dept) === 0) {
            showToast('Department is required', 'error');
            return;
          }
          if (!form.designation || Number(form.designation) === 0) {
            showToast('Designation is required', 'error');
            return;
          }
          const branchID = sessionStorage.getItem('branchID');
        const userID = sessionStorage.getItem('UserID') || 0;
            const now = new Date().toISOString();

        const payload = {
  id: form.id,
  cnic: form.cnic,
  firstName: form.firstName,
  lastName: form.lastName,
  fatherName: form.fatherName,
  gender: form.gender,
  maritalStatus: form.maritalStatus,
  countryID: !form.country || Number(form.country) === 0 ? 4 : Number(form.country),
provinceID: !form.province || Number(form.province) === 0 ? 13 : Number(form.province),
cityID: !form.city || Number(form.city) === 0 ? 20 : Number(form.city),
  address: form.address,
  phone: form.phone ?? '',
  branchID: branchID,
  dateOfBirth: form.dateOfBirth ? form.dateOfBirth : now,
  dateOfJoining: form.joiningDate || new Date().toISOString(),
  experience: form.experience,
  bloodGroup: form.bloodGroup,
  departmentID: form.dept,
  designationID: form.designation,
  qualificationID: form.qualification ? form.qualification : 0,
  empImage: form.empImage ?? '',
  basicSalary: Number(form.basicSalary) || 0,
  medicalAllowanace: Number(form.medicalAllowanace) || 0,
  rentAllowance: Number(form.rentAllowance) || 0,
  transportAllowance: Number(form.transportAllowance) || 0,
  isPrinciple: form.isPrincipal ? true : false,
  isTeacher: form.isTeacher ? true : false,
  isParent: form.isParent ? true : false,
  email: form.email ?? '',
  createdAt: new Date().toISOString(),
  createdBy: userID,
  modifiedAt: new Date().toISOString(),
  modifiedBy: userID,
  isActive: true,
  departmentName: "string",
  designationName: "string",
  qualificationName: "string",
};
console.log(payload)
        const res = await fetch(buildUrl('/api/LaunchSetup/update-employee-employment'), {
          method: 'PUT',
          headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
    
        const data = await res.json();
    
        if (!res.ok) {
        showToast(data?.message || 'Could not save official details. Please check the required fields.', 'error');
        console.log(data)
        console.log(res.data)
          return;
        }
    setSubTab('salary')
    
      } catch (err) {
        console.error(err);
        showToast('Network error. Please try again.', 'error');
      }
      };

      const handleupdatesalary = async() => {
         try {
          const branchID = sessionStorage.getItem('branchID');
        const userID = sessionStorage.getItem('UserID') || 0;
                const now = new Date().toISOString();

        const payload = {
  id: form.id,
  cnic: form.cnic,
  firstName: form.firstName,
  lastName: form.lastName,
  fatherName: form.fatherName,
  gender: form.gender,
  maritalStatus: form.maritalStatus,
  countryID: !form.country || Number(form.country) === 0 ? 4 : Number(form.country),
provinceID: !form.province || Number(form.province) === 0 ? 13 : Number(form.province),
cityID: !form.city || Number(form.city) === 0 ? 20 : Number(form.city),
  address: form.address,
  phone: form.phone ?? '',
  branchID: branchID,
dateOfBirth:
  !form.dateOfBirth || form.dateOfBirth.trim?.() === ''
    ? now
    : form.dateOfBirth,
  dateOfJoining: form.joiningDate || new Date().toISOString(),
  experience: form.experience,
  bloodGroup: form.bloodGroup,
  departmentID: form.dept,
  designationID: form.designation,
qualificationID:
  !form.qualification || Number(form.qualification) === 0
    ? null
    : Number(form.qualification),
      empImage: form.empImage ?? '',
  basicSalary: Number(form.basicSalary) || 0,
  medicalAllowanace: Number(form.medicalAllowanace) || 0,
  rentAllowance: Number(form.rentAllowance) || 0,
  transportAllowance: Number(form.transportAllowance) || 0,
  isPrinciple: form.isPrincipal ? true : false,
  isTeacher: form.isTeacher ? true : false,
  isParent: form.isParent ? true : false,
  email: form.email ?? '',
  createdAt: new Date().toISOString(),
  createdBy: userID,
  modifiedAt: new Date().toISOString(),
  modifiedBy: userID,
  isActive: true,
   departmentName: "string",
  designationName: "string",
  qualificationName: "string",
};
console.log(payload)
        const res = await fetch(buildUrl('/api/LaunchSetup/update-employee-salary'), {
          method: 'PUT',
          headers: {
            'Accept': '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
    
        const data = await res.json();
    
        if (!res.ok) {
        showToast(data?.message || 'Could not save salary details. Please try again.', 'error');
        console.log(data)
        console.log(res.data)
          return;
        }
            onClose()
    onSave(form);
    
      } catch (err) {
        console.error(err);
        showToast('Network error. Please try again.', 'error');
      }
      };


  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Employment Details of</div>
            <div className="modal-subtitle">Fill in all sections carefully</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-primary)', marginTop: 2 }}>
              {isNew ? 'New Employee' : `${form.firstName || ''} ${form.lastName || ''}`}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="modal-body">
          {/* Main tabs */}
          <div className="emp-modal-tabs">
            <button className={`emp-tab-btn${tab === 'personal' ? ' active' : ''}`} onClick={() => setTab('personal')}>
              <i className="fas fa-user" style={{ marginRight: 6 }}></i>Personal Information
            </button>
            <button className={`emp-tab-btn${tab === 'employee' ? ' active' : ''}`} onClick={() => setTab('employee')}>
              <i className="fas fa-briefcase" style={{ marginRight: 6 }}></i>Employee Details
            </button>
          </div>

          {/* ── PERSONAL ── */}
          {tab === 'personal' && (
            <>
              <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">First name <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-user input-icon"></i>
                    <input className="form-input has-icon" value={form.firstName || ''} onChange={e => set('firstName', e.target.value)} placeholder="First name" />
                  </div>
                  <Good show={!!form.firstName?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <div className="input-wrapper">
                    <i className="fas fa-user input-icon"></i>
                    <input className="form-input has-icon" value={form.lastName || ''} onChange={e => set('lastName', e.target.value)} placeholder="Enter Last Name" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Father / Husband name <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-users input-icon"></i>
                    <input className="form-input has-icon" value={form.fatherName || ''} onChange={e => set('fatherName', e.target.value)} placeholder="Enter name" />
                  </div>
                  <Good show={!!form.fatherName?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">CNIC <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-id-card input-icon"></i>
                    <input className="form-input has-icon" value={form.cnic || ''} onChange={e => set('cnic', e.target.value)} placeholder="35201-1234567-8" />
                  </div>
                  <Good show={!!form.cnic?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <div className="input-wrapper">
                    <i className="fas fa-calendar input-icon"></i>
                    <input className="form-input has-icon" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth || ''} onChange={e => set('dateOfBirth', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
                    <option value="">Select</option>
                    {GENDER.map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Address</label>
                  <div className="input-wrapper">
                    <i className="fas fa-map-marker-alt input-icon"></i>
                    <input className="form-input has-icon" value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Enter Address" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone/Email <span className="req-star">*</span></label>
                  <div className="input-wrapper">
                    <i className="fas fa-phone input-icon"></i>
                    <input className="form-input has-icon" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="0300 0000000" />
                  </div>
                  <Good show={!!form.phone?.trim()} text="Looks good" />
                </div>
                <div className="form-group">
                  <label className="form-label">Marital Status</label>
                  <select className="form-select" value={form.maritalStatus || ''} onChange={e => set('maritalStatus', e.target.value)}>
                    <option value="">Select</option>
                    {MARITAL.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select className="form-select" value={form.bloodGroup || ''} onChange={e => set('bloodGroup', e.target.value)}>
                    <option value="">Select</option>
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                {/* ROLE section hidden — har naya staff by default Teacher (isTeacher = true)
                    hota hai. Dobara enable karna ho to `false &&` hata dein. */}
                {false && (
                <div className="form-group" style={{ marginLeft: 14 }}>
                <label className="form-label">Role</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 25 , marginTop: 10}}>
                  {/* {['Principal', 'Teacher', 'Parent'].map(role =&gt; { */}
                  {['Principal', 'Teacher'].map(role => {
                    const key = `is${role}`;
                    return (
                      <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={!!form[key]}
                          onChange={e => set(key, e.target.checked)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                        />
                        {role}
                      </label>
                    );
                  })}
                </div>
              </div>
              )}
              </div>

              {/* Image upload + preview */}
              <div className="form-grid form-grid-2" style={{ gap: 14, marginTop: 14 }}>
                <div className="form-group">
                  <label className="form-label">Please Provide Profile Image</label>
                  <label style={{ display: 'block', border: '1.5px dashed var(--border-light)', borderRadius: 'var(--radius-md)', padding: 18, textAlign: 'center', cursor: 'pointer', background: 'var(--bg-base)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <i className="fas fa-upload" style={{ marginRight: 6 }}></i>Click to Upload Image
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>PNG, JPG allowed</div>
                    <input type="file" accept="image/png,image/jpeg" onChange={handleImage} style={{ display: 'none' }} />
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Profile Image Preview</label>
                  <div style={{ border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', height: 76, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(30,58,138,.05)', overflow: 'hidden' }}>
                    {form.profileImage
                      ? <img src={form.profileImage} alt="preview" style={{ height: '100%', objectFit: 'contain' }} />
                      : <i className="fas fa-user-circle" style={{ fontSize: 34, color: 'var(--brand-primary)' }}></i>}
                  </div>
                </div>
              </div>

              {/* Role checkboxes */}
              
            </>
          )}

          {/* ── EMPLOYEE ── */}
          {tab === 'employee' && (
            <>
              <div className="emp-sub-tabs">
                <button className={`emp-sub-tab-btn${subTab === 'official' ? ' active' : ''}`} onClick={() => setSubTab('official')}>Official Details</button>
                <button className={`emp-sub-tab-btn${subTab === 'salary' ? ' active' : ''}`} onClick={() => setSubTab('salary')}>Salary Details</button>
              </div>

              {subTab === 'official' && (
                <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Department <span className="req-star">*</span></label>
                    <select className="form-select" value={form.dept || ''} onChange={e => { set('dept', e.target.value); set('designation', ''); }}>
                      <option value="">Select</option>
                      {deptList.map(d => <option key={d.id} value={d.id}>{d.departmentName}</option>)}
                    </select>
                    <Good show={!!form.dept} text="Department selected" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designation <span className="req-star">*</span></label>
                    <select className="form-select" value={form.designation || ''} onChange={e => set('designation', e.target.value)} disabled={!form.dept}>
                      <option value="">Select</option>
                      {desigOptions.map(x => <option key={x.designationID} value={x.designationID}>{x.designationName}</option>)}
                    </select>
                    <Good show={!!form.designation} text="Designation selected" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Country</label>
                    <select
                      className="form-select"
                      value={form.country || ''}
                      onChange={e => {
                        const val = e.target.value;
                        set('country', val);
                        set('province', '');
                        set('city', '');
                        setProvinceList([]);
                        setCityList([]);
                        if (val) getProvinceList(val);
                      }}
                    >
                      <option value="">Select Country</option>
                      {countryList.map(c => <option key={c.ID} value={c.ID}>{c.Name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Province</label>
                    <select
                      className="form-select"
                      value={form.province || ''}
                      onChange={e => {
                        const val = e.target.value;
                        set('province', val);
                        set('city', '');
                        setCityList([]);
                        if (val) getCityList(val);
                      }}
                      disabled={!form.country}
                    >
                      <option value="">Select Province</option>
                      {provinceList.map(p => <option key={p.ID} value={p.ID}>{p.Name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <select
                      className="form-select"
                      value={form.city || ''}
                      onChange={e => set('city', e.target.value)}
                      disabled={!form.province}
                    >
                      <option value="">Select City</option>
                      {cityList.map(c => <option key={c.ID} value={c.ID}>{c.Name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <select
                      className="form-select"
                      value={form.qualification || ''}
                      onChange={e => set('qualification', e.target.value)}
                    >
                      <option value="">Select Qualification</option>
                      {(Array.isArray(Qualification) ? Qualification : []).map(q => (
                        <option key={q.qualificationID ?? q.id} value={q.qualificationID ?? q.id}>{q.qualificationName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">experience</label>
                    <div className="input-wrapper">
                      <i className="fas fa-clock input-icon"></i>
                      <input className="form-input has-icon" value={form.experience || ''} onChange={e => set('experience', e.target.value)} placeholder="e.g. 5 years" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Joining</label>
                    <div className="input-wrapper">
                      <i className="fas fa-calendar-check input-icon"></i>
                      <input className="form-input has-icon" type="date" value={form.joiningDate || ''} onChange={e => set('joiningDate', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {subTab === 'salary' && (
                <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                  {[
                    ['Basic Monthly Salary', 'basicSalary', 'fa-money-bill-wave', true],
                    ['Medical Allowance', 'medicalAllowanace', 'fa-notes-medical', true],
                    ['Rent Allowance', 'rentAllowance', 'fa-home', true],
                    ['Transport Allowance', 'transportAllowance', 'fa-bus', true],
                  ].map(([label, key, icon, req]) => (
                    <div className="form-group" key={key}>
                      <label className="form-label">{label} {req && <span className="req-star">*</span>}</label>
                      <div className="input-wrapper">
                        <i className={`fas ${icon} input-icon`}></i>
                        <input className="form-input has-icon" type="number" value={form[key] || ''} onChange={e => set(key, Number(e.target.value))} placeholder="0" />
                      </div>
                      <Good show={Number(form[key]) > 0} text={`PKR ${Number(form[key] || 0).toLocaleString()}`} />
                    </div>
                  ))}
                  <div style={{ gridColumn: 'span 2', padding: '12px 14px', background: 'linear-gradient(135deg,rgba(30,58,138,.06),rgba(30,64,175,.04))', border: '1px solid rgba(30,58,138,.15)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Total basicSalary Package</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-primary)' }}>
                      PKR {((Number(form.basicSalary) || 0) + (Number(form.medicalAllowanace) || 0) + (Number(form.rentAllowance) || 0) + (Number(form.transportAllowance) || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="modal-footer">
            <button className="btn btn-secondary btn-md" onClick={onClose}>Close</button>
            {footerBtn()}
          </div>
        </div>
      </div>

      {/* ── Duplicate-number popup: number pehle se ho to email maango, email ke through add ── */}
      {dupPopup && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10050, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,.55)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setDupPopup(false); }}>
          <div style={{ background: '#fff', borderRadius: 14, width: 'min(430px,92vw)', padding: '22px 22px 18px', boxShadow: '0 24px 70px rgba(2,6,23,.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <i className="fas fa-triangle-exclamation" style={{ color: '#dc2626', fontSize: 18 }}></i>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Number already exists</div>
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 1.55 }}>
              This phone number is already registered. You can continue with email.
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              autoFocus
              type="email"
              value={dupEmail}
              placeholder="name@example.com"
              onChange={e => setDupEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); confirmDupEmail(); }
                else if (e.key === 'Escape') { setDupPopup(false); }
              }}
              style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #cbd5e1', borderRadius: 9, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button className="btn btn-secondary btn-md" onClick={() => setDupPopup(false)}>Cancel</button>
              <button className="btn btn-primary btn-md" onClick={confirmDupEmail}>Enter</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskAssignModal({ open, staff, classesData, setClassesData, onClose, onSave, showToast }) {
  const [expandedClass, setExpandedClass] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null);
  const [tasks, setTasks] = useState({});
  const [subjectsMap, setSubjectsMap] = useState({});   // { "gradeId::sectionId": [{subjectID, subjectName}] }
  const [loadingSubjects, setLoadingSubjects] = useState({}); // { "gradeId::sectionId": true }

  const getClassesData = useCallback(async () => {
    try {
      const branchID = sessionStorage.getItem('branchID');
      const res      = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
      const json     = await res.json();
      setClassesData(json.data ?? []);
    } catch { showToast?.('Could not load classes', 'error'); }
  }, [setClassesData, showToast]);

  React.useEffect(() => {
    if (open && staff) {
      // build checked-state from the employee's existing assignments
      const initTasks = {};
      (staff.assignments || []).forEach(a => {
        const k = `${a.gradeId}::${a.sectionId}`;
        if (!initTasks[k]) initTasks[k] = [];
        initTasks[k].push(a.subjectId);
      });
      setTasks(initTasks);
      setExpandedClass(null);
      setExpandedSection(null);
      setSubjectsMap({});
      getClassesData();
    }
  }, [open, staff, getClassesData]);

  if (!open || !staff) return null;

  // ── Adjust these accessors to match your data field names ──
  const getSections = (cls) => cls.sections || [];   // array of { sectionID, sectionName }
  const getSectionName = (sec) => sec.sectionName;   // section label
  // ───────────────────────────────────────────────────────────

  const subjKey = (gradeId, sectionId) => `${gradeId}::${sectionId}`;

  const getSubjectsApi = async (gradeId, sectionId) => {
    const key = subjKey(gradeId, sectionId);
    if (subjectsMap[key] || loadingSubjects[key]) return;   // already loaded / loading
    setLoadingSubjects(prev => ({ ...prev, [key]: true }));
    try {
      const res  = await fetch(buildUrl(`/api/LaunchSetup/get-subjects/${gradeId}/${sectionId}`), { headers: { Accept: '*/*' } });
      const json = await res.json();
      setSubjectsMap(prev => ({ ...prev, [key]: json.data ?? [] }));
    } catch {
      showToast?.('Could not load subjects', 'error');
      setSubjectsMap(prev => ({ ...prev, [key]: [] }));
    } finally {
      setLoadingSubjects(prev => ({ ...prev, [key]: false }));
    }
  };

  const isChecked = (gradeId, sectionId, subjectId) =>
    !!tasks[subjKey(gradeId, sectionId)]?.includes(subjectId);

  const applyToggle = (k, subjectId, checked) => {
    setTasks(prev => {
      const list = new Set(prev[k] || []);
      checked ? list.add(subjectId) : list.delete(subjectId);
      return { ...prev, [k]: [...list] };
    });
  };

  const toggle = async (gradeId, sectionId, subj) => {
    const subjectId = subj.subjectID;
    const k = subjKey(gradeId, sectionId);
    const newChecked = !tasks[k]?.includes(subjectId);
    applyToggle(k, subjectId, newChecked);   // optimistic update
    const now = new Date().toISOString();
    const userID = Number(sessionStorage.getItem('UserID')) || 0;
    const branchId = Number(sessionStorage.getItem('branchID')) || 0;
    const payload = {
      id: 0,
      employeId: staff.id,
      gradeId,
      sectionId,
      subjectId,
      branchId,
      createdBy: userID,
      createdAt: now,
      modifiedBy: userID,
      modifiedAt: now,
      isChecked: newChecked,
      subjectName: subj.subjectName || '',
    };
    try {
      const res = await fetch(buildUrl('/api/LaunchSetup/toggle-Employees_Subjects_Assignments'), {
        method: 'POST',
        headers: { Accept: '*/*', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        applyToggle(k, subjectId, !newChecked);   // revert on failure
        showToast?.('Could not update assignment', 'error');
      }
    } catch {
      applyToggle(k, subjectId, !newChecked);   // revert on error
      showToast?.('Network error. Please try again.', 'error');
    }
  };

  const sectionKey = (cid, sid) => `${cid}::${sid}`;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              Task Assignment of <span style={{ color: 'var(--brand-primary)' }}>{staff.firstName} {staff.lastName || ''}</span>
            </div>
            <div className="modal-subtitle">Assign subjects per class and section</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {/* Name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, marginBottom: 18, borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ width: 48, height: 48, borderRadius: '20%', background: 'rgba(30,58,138,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2.5px solid' , borderColor: '#1e3a8a'}}>
              <i className="fas fa-user-tie" style={{ fontSize: 20, color: 'var(--brand-primary)' }}></i>
            </div>
            <div style={{ fontSize: 15 }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Name: </span>
              <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{staff.firstName} {staff.lastName || ''}</span>
            </div>
          </div>

          {/* Assign Subjects tab heading */}
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-primary)', borderBottom: '2px solid var(--brand-primary)', display: 'inline-block', paddingBottom: 8, marginBottom: 18 }}>
            Assign Subjects
          </div>

          {/* Class accordions */}
          {!classesData?.length ? (
            <div className="empty-mini"><i className="fas fa-chalkboard"></i>No classes available</div>
          ) : classesData.map((cls, ci) => {
            const clsOpen = expandedClass === cls.id;
            return (
              <div key={cls.id} style={{ border: `1.5px solid ${clsOpen ? 'var(--brand-light)' : 'var(--border-light)'}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden', background: '#fff', transition: 'border-color .15s' }}>
                {/* Class header */}
                <div
                  onClick={() => setExpandedClass(clsOpen ? null : cls.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer', background: clsOpen ? '#eff6ff' : '#eff6ff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <span style={{ fontSize: 14, color: clsOpen ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: 600, minWidth: 14, textAlign: 'center' }}>{ci + 1}</span>
                    <span style={{ width: 1, height: 22, background: 'var(--border-light)' }}></span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: clsOpen ? 'var(--text-primary)' : 'var(--text-primary)' }}>{cls.name}</span>
                  </div>
                  <i className={`fas fa-chevron-${clsOpen ? 'up' : 'down'}`} style={{ fontSize: 14, color: clsOpen ? 'var(--brand-primary)' : 'var(--text-secondary)' }}></i>
                </div>

                {/* Sections */}
                {clsOpen && (
                  <div style={{ padding: '12px' }}>
                    {!getSections(cls).length ? (
                      <div className="empty-mini"><i className="fas fa-layer-group"></i>No sections</div>
                    ) : getSections(cls).map((sec, si) => {
                      const sname = getSectionName(sec);
                      const secOpen = expandedSection === sectionKey(cls.id, si);
                      const sKey = subjKey(cls.id, sec.sectionID);
                      const subjects = subjectsMap[sKey] || [];
                      const isLoading = loadingSubjects[sKey];
                      return (
                        <div key={si} style={{ marginBottom: 8, paddingLeft: 14, borderLeft: '3px solid #1E3A8A' }}>
                          {/* Section header */}
                          <div
                            onClick={() => {
                              const next = secOpen ? null : sectionKey(cls.id, si);
                              setExpandedSection(next);
                              if (next) getSubjectsApi(cls.id, sec.sectionID);
                            }}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1.5px solid ${secOpen ? 'var(--brand-light)' : 'var(--border-light)'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', background: secOpen ? '#fff' : '#fff' }}
                          >
                            <span style={{ fontSize: 14, fontWeight: 700, color: secOpen ? 'var(--text-primary)' : 'var(--text-primary)' }}>{sname}</span>
                            <i className={`fas fa-chevron-${secOpen ? 'up' : 'down'}`} style={{ fontSize: 13, color: secOpen ? 'var(--brand-primary)' : 'var(--text-secondary)' }}></i>
                          </div>

                          {/* Subjects checklist */}
                          {secOpen && (
                            <div style={{ border: '1.5px solid rgba(30,58,138,.18)', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 52px', padding: '11px 14px', background: '#eff6ff', fontSize: 11.5, fontWeight: 700, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                                <span style={{ borderRight: '1px solid rgba(30,58,138,.15)' }}>SN</span>
                                <span style={{ paddingLeft: 12, borderRight: '1px solid rgba(30,58,138,.15)' }}>Subject</span>
                                <span style={{ textAlign: 'center' }}><i className="fas fa-check"></i></span>
                              </div>
                              {isLoading ? (
                                <div className="empty-mini" style={{ padding: 12 }}><i className="fas fa-spinner fa-spin"></i>Loading subjects...</div>
                              ) : !subjects.length ? (
                                <div className="empty-mini" style={{ padding: 12 }}><i className="fas fa-book"></i>No subjects</div>
                              ) : subjects.map((subj, sj) => (
                                <div key={subj.subjectID ?? sj} style={{ display: 'grid', background: '#eff6ff', gridTemplateColumns: '52px 1fr 52px', alignItems: 'center', padding: '11px 14px', fontSize: 13.5, color: 'var(--text-primary)', borderTop: '1px solid rgba(30,58,138,.1)' }}>
                                  <span style={{ color: 'var(--text-muted)', borderRight: '1px solid rgba(30,58,138,.1)', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>{sj + 1}</span>
                                  <span style={{ paddingLeft: 12, borderRight: '1px solid rgba(30,58,138,.1)', alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>{subj.subjectName}</span>
                                  <span style={{ textAlign: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked(cls.id, sec.sectionID, subj.subjectID)}
                                      onChange={() => toggle(cls.id, sec.sectionID, subj)}
                                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand-primary)' }}
                                    />
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary btn-md" onClick={onClose}>Close</button>
          <button className="btn btn-primary btn-md" onClick={() => onSave({ ...staff, tasks })}>
            <i className="fas fa-save"></i> Save Assignment
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StaffTab({ staffData, setStaffData, deptsData, setDeptsData, schoolInfo, showToast, showSuccess, classesData, setClassesData, onContinue }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [staffModalTarget, setStaffModalTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
const [taskTarget, setTaskTarget] = useState(null);

  /* ── BULK IMPORT WIZARD ── StudentTab jaisa hi 3-step flow:
     Download Template → Upload File → Preview & Import. Staff ka sirf ek hi
     format hai, is liye Students wala "Choose Format" step yahan nahi. */
  const [showImport, setShowImport]       = useState(false);
  const [importStep, setImportStep]       = useState(1);
  const [importFile, setImportFile]       = useState(null);   // selected .xlsx File
  const [importPreview, setImportPreview] = useState(null);   // { headers, rows }
  const [importing, setImporting]         = useState(false);
  const importInputRef = useRef(null);

  const closeImport = () => { setShowImport(false); setImportStep(1); setImportFile(null); setImportPreview(null); };

  const downloadStaffTemplate = () => {
    const a = document.createElement('a');
    a.href = staffTemplate;
    a.download = 'BulkStaff_Quick.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Template downloaded', 'success');
  };

  /* Step 2: ek .xlsx lo aur uski pehli sheet preview ke liye parse karo. */
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';   // wahi file dobara chunne ke liye
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { showToast('Please select an .xlsx file', 'error'); return; }
    setImportFile(file);
    try {
      const XLSX = await import('xlsx');
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const matrix  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const headers = (matrix[0] || []).map(h => String(h));
      const rows    = matrix.slice(1).filter(r => r.some(c => String(c).trim() !== ''));
      setImportPreview({ headers, rows });
    } catch (err) {
      console.error('Error parsing file:', err);
      showToast('Could not read the file', 'error');
      setImportPreview(null);
    }
  };

  /* Step 3: file ko bulk-import endpoint par bhejo. */
  const confirmImport = async () => {
    if (!importFile) return;
    const fd = new FormData();
    fd.append('branchId',  Number(sessionStorage.getItem('branchID')) || 0);
    fd.append('createdBy', Number(sessionStorage.getItem('UserID')) || 0);
    fd.append('file',      importFile);
    setImporting(true);
    try {
      /* Content-Type khud mat lagao — browser multipart boundary add karta hai. */
      const res  = await fetch(buildUrl('/api/LaunchSetup/bulk-import-employees'), {
        method: 'POST', headers: { Accept: '*/*' }, body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showSuccess('Import Complete!', data?.message || 'Staff data imported successfully.');
        closeImport();
        getStaffdata();
      } else {
        showToast(data?.message || 'Import failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error. Please try again.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const filtered = search
    ? staffData.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase())
        || s.dept?.toLowerCase().includes(search.toLowerCase())
        || s.designation?.toLowerCase().includes(search.toLowerCase()))
    : staffData;

  const pages = Math.ceil(filtered.length / STAFF_PER_PAGE) || 1;
  const currentPage = Math.min(page, pages);
  const paged = filtered.slice((currentPage - 1) * STAFF_PER_PAGE, currentPage * STAFF_PER_PAGE);

  const handleSave = (form) => {
    if (form.id && staffData.find(s => s.id === form.id)) {
      showToast('Employee updated', 'success');
      getStaffdata();
    } else {
      showSuccess('Employee Added!', `${form.firstName} has been added.`);
      getStaffdata();
    }
  };

  const handleDelete = async(id) => {
    const s = staffData.find(s => s.id === id);
    console.log(id)
         try {
              const res = await fetch(
              buildUrl(`/api/LaunchSetup/delete-employee/${id}`),
              {
                method: 'DELETE',
                headers: {
                  Accept: '*/*'
                }
              }
            );
              const json     = await res.json();
        
            if (!res.ok) {
          if (
            json?.message?.includes('REFERENCE constraint') ||
            json?.message?.includes('FK_AHM_HR_Employees')
          ) {
            showToast(
              'Cannot delete staff because it contains data.',
              'error'
            );
                      setDeleteTarget(null);
    
          }
          else if (
            json?.message?.includes('Teacher role Removed') ||
            json?.message?.includes('Owner cannot be deleted')
          ) {
            showToast(
              json?.message,
              'success'
            );
                      setDeleteTarget(null);
    
          } else {
            showToast(json?.message || 'Delete failed', 'error');
                      setDeleteTarget(null);
    
          }
    
          return;
        }
        if(res.ok){
           if (
            json?.message?.includes("Owner employee cannot be deleted.") ||
            json?.message?.includes('Owner cannot be deleted')
          ) {
            showToast(
              json.message,
              'error'
            );
                      setDeleteTarget(null);
    
          }
          else{
          showToast(`"${s?.firstName}" deleted`, 'info');
              setDeleteTarget(null);
        }
        }
              getStaffdata()
                      
          } catch (err) {
            console.error(err);
                      setDeleteTarget(null);
            showToast('Could not delete staff', 'error');
          }
  };

  const newStaffTemplate = { firstName: '', lastName: '', fatherName: '', cnic: '', dateOfBirth: '', gender: 'Male', maritalStatus: '', address: '', phone: '', bloodGroup: '', dept: '', designation: '', country: '', province: '', city: '', qualification: '', experience: '', joiningDate: '', basicSalary: 0, medical: 0, rent: 0, transport: 0, tasks: {}, verified: false, locked: false };

   useEffect(() => {
      getStaffdata();
      getClassesData();
    }, []);

    const getStaffdata = useCallback(async () => {
              const branchID = sessionStorage.getItem('branchID');
        try {
          const res      = await fetch(buildUrl(`/api/LaunchSetup/get-employees-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
          const json     = await res.json();
          const d        = json.data ?? {};
          setStaffData(d);
        } catch { showToast('Could not load Staff data', 'error'); }
    }, [setStaffData]);

    const getClassesData = useCallback(async () => {
      const branchID = sessionStorage.getItem('branchID');
      try {
        const res  = await fetch(buildUrl(`/api/LaunchSetup/get-grades-by-branch/${branchID}`), { headers: { Accept: '*/*' } });
        const json = await res.json();
        setClassesData(json.data ?? []);
      } catch { showToast('Could not load classes', 'error'); }
    }, [setClassesData]);


    const handleDeleteStaff = async(id) => {
        
      };

  return (
    <div className="tab-panel active">
      <div className="classes-toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <i className="fas fa-search"></i>
            <input placeholder="Search staff..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>
        <div className="toolbar-right">
          <button className="btn btn-md" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff' }}
            onClick={() => { setShowImport(true); setImportStep(1); }}>
            <i className="fas fa-file-import"></i> Bulk Upload
          </button>
          <button className="btn btn-pdf btn-md" onClick={() => downloadStaffReport(staffData, schoolInfo || {}, showToast)}>
            <i className="fas fa-file-pdf"></i> Download Report
          </button>
          <button className="btn btn-primary btn-md" onClick={() => setStaffModalTarget({ ...newStaffTemplate, id: null })}>
            <i className="fas fa-user-plus"></i> Add New Employee
          </button>
        </div>
      </div>

      <div className="classes-table-card" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div className="staff-table-head">
          <div className="th">#</div>
          <div className="th">Name</div>
          <div className="th">Department</div>
          <div className="th">Designation</div>
          <div className="th">Action</div>
          <div className="th" style={{ textAlign: 'center' }}>Details</div>
        </div>
        <div>
          {!paged.length ? (
            <div className="empty-state">
              <div className="empty-icon"><i className="fas fa-users"></i></div>
              <div className="empty-title">No Staff Found</div>
              <div className="empty-sub">Add your first employee to get started.</div>
            </div>
          ) : paged.map((s, i) => {
            const globalIdx = (currentPage - 1) * STAFF_PER_PAGE + i + 1;
            const exp = expandedId === s.id;
            const col = COLORS[i % COLORS.length];
            return (
              <div key={s.id} className="staff-row-wrap">
                <div className={`staff-row${exp ? ' expanded-row' : ''}`} onClick={() => setExpandedId(exp ? null : s.id)}>
                  <div className="td" onClick={e => e.stopPropagation()}>
                    <input className="seq-input" type="number" value={globalIdx} readOnly />
                  </div>
                  <div className="td">
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', marginRight: 9, flexShrink: 0 }}>
                      {(s.firstName || '?').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{s.firstName}{s.lastName ? ' ' + s.lastName : ''}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.phone || ''}</div>
                    </div>
                  </div>
                  <div className="td">{s.departmentName ? <span className="staff-dept-pill">{s.departmentName}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</div>
                  <div className="td">{s.designationName ? <span className="staff-desig-pill">{s.designationName}</span> : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}</div>
                  <div className="td staff-action-col">
                    <button className="btn-details-staff" onClick={e => { e.stopPropagation(); setStaffModalTarget(s); }}>
                      <i className="fas fa-edit"></i> Details
                    </button>
                    <button className="btn-task-staff" onClick={e => { e.stopPropagation(); setTaskTarget(s); }}>Tasks</button>
                    <button className="btn btn-icon btn-danger btn-sm" onClick={e => { e.stopPropagation(); setDeleteTarget(s); }}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                  <div className="td staff-chevron-col">
                    <button className={`expand-btn${exp ? ' open' : ''}`} onClick={e => { e.stopPropagation(); setExpandedId(exp ? null : s.id); }}>
                      <i className="fas fa-chevron-down"></i>
                    </button>
                  </div>
                </div>
                {exp && (() => {
                  const assignments = Array.isArray(s.assignments) ? s.assignments : [];
                  const totalPackage = (Number(s.basicSalary) || 0) + (Number(s.medicalAllowanace) || 0) + (Number(s.rentAllowance) || 0) + (Number(s.transportAllowance) || 0);
                  const pkr = v => `PKR ${(Number(v) || 0).toLocaleString()}`;
                  const dateOnly = v => (v ? String(v).split('T')[0] : '');
                  // group assignments: className -> sectionName -> [subjects]
                  const grouped = {};
                  assignments.forEach(a => {
                    const cn = a.className || `Grade ${a.gradeId}`;
                    const sn = a.sectionName || '—';
                    grouped[cn] = grouped[cn] || {};
                    grouped[cn][sn] = grouped[cn][sn] || [];
                    grouped[cn][sn].push(a);
                  });
                  return (
                  <div style={{ padding: '16px 18px', background: 'var(--bg-base)', borderTop: '1px solid var(--border-light)' }}>
                    <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Employee Details</div>

                    <div className="emp-details-section">
                      <div className="emp-section-hdr"><i className="fas fa-user" style={{ marginRight: 8 }}></i>Personal Information</div>
                      <div className="emp-section-body">
                        <div className="emp-field-grid">
                          {[['First Name', s.firstName], ['Last Name', s.lastName], ['Father Name', s.fatherName], ['CNIC', s.cnic], ['Date of Birth', dateOnly(s.dateOfBirth)], ['Gender', s.gender], ['Marital Status', s.maritalStatus], ['Address', s.address], ['Phone/Email', s.phone], ['Blood Group', s.bloodGroup]].map(([lbl, val]) => (
                            <div key={lbl} className="emp-field">
                              <div className="emp-field-label">{lbl}</div>
                              <div className="emp-field-val">{val || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="emp-details-section">
                      <div className="emp-section-hdr"><i className="fas fa-briefcase" style={{ marginRight: 8 }}></i>Official Details</div>
                      <div className="emp-section-body">
                        <div className="emp-field-grid">
                          {[['Department', s.departmentName], ['Designation', s.designationName], ['Country', s.countryName], ['Province', s.provinceName], ['City', s.cityName], ['Qualification', s.qualificationName], ['experience', s.experience], ['Date of Joining', dateOnly(s.dateOfJoining)]].map(([lbl, val]) => (
                            <div key={lbl} className="emp-field">
                              <div className="emp-field-label">{lbl}</div>
                              <div className="emp-field-val">{val || '—'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="emp-details-section">
                      <div className="emp-section-hdr"><i className="fas fa-money-bill-wave" style={{ marginRight: 8 }}></i>Financial Details</div>
                      <div className="emp-section-body">
                        <div className="emp-field-grid">
                          {[['Basic Salary', pkr(s.basicSalary)], ['Medical Allowance', pkr(s.medicalAllowanace)], ['Rent Allowance', pkr(s.rentAllowance)], ['Transport Allowance', pkr(s.transportAllowance)], ['Total Package', pkr(totalPackage)]].map(([lbl, val]) => (
                            <div key={lbl} className="emp-field">
                              <div className="emp-field-label">{lbl}</div>
                              <div className="emp-field-val" style={lbl === 'Total Package' ? { color: 'var(--brand-primary)', fontWeight: 700 } : undefined}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="emp-details-section">
                      <div className="emp-section-hdr"><i className="fas fa-tasks" style={{ marginRight: 8 }}></i>Task Assigned</div>
                      <div className="emp-section-body">
                        {assignments.length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No tasks assigned yet.</div>
                        ) : (
                          Object.keys(grouped).map(cn => (
                            <div key={cn} style={{ marginBottom: 12 }}>
                              {/* Class */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--brand-primary)', marginBottom: 6 }}>
                                <i className="fas fa-chalkboard"></i> {cn}
                              </div>
                              {/* Sections under the class */}
                              {Object.keys(grouped[cn]).map(sn => (
                                <div key={sn} style={{ paddingLeft: 16, marginBottom: 8, borderLeft: '2px solid rgba(30,58,138,.15)' }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    <i className="fas fa-layer-group" style={{ marginRight: 6, color: 'var(--text-muted)' }}></i>
                                    Section {sn}
                                  </div>
                                  {/* Subjects under the section */}
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 20 }}>
                                    {grouped[cn][sn].map((a, ai) => (
                                      <span key={ai} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(30,58,138,.06)', border: '1px solid rgba(30,58,138,.15)', color: 'var(--brand-primary)', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99 }}>
                                        <i className="fas fa-book" style={{ fontSize: 10 }}></i> {a.subjectName}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        <div className="pagination">
          <div className="pagination-info">Showing <strong>{paged.length}</strong> of <strong>{filtered.length}</strong> staff</div>
          <div className="pagination-pages">
            <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <i className="fas fa-chevron-left"></i>
            </button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn${currentPage === p ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={currentPage === pages}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <StaffModal open={!!staffModalTarget} staff={staffModalTarget} deptsData={deptsData}
        onClose={() => [getStaffdata(), setStaffModalTarget(null)]} onSave={handleSave} setDeptsData={setDeptsData} showToast={showToast} />
        <TaskAssignModal
  open={!!taskTarget}
  staff={taskTarget}
  classesData={classesData}
  setClassesData={setClassesData}
  showToast={showToast}
  onClose={() => [getStaffdata(), setTaskTarget(null)]}
  onSave={(updated) => {
    setStaffData(prev => prev.map(s => s.id === updated.id ? updated : s));
    showToast('Task assignment saved', 'success');
    setTaskTarget(null);
    getStaffdata();
  }}
/>

      {deleteTarget && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title" style={{ color: 'var(--error)' }}><i className="fas fa-exclamation-triangle" style={{ marginRight: 7 }}></i>Delete Employee</div>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                Delete <strong>"{deleteTarget.firstName}"</strong>? This action cannot be undone.
              </p>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-md" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button className="btn btn-danger btn-md" onClick={() => handleDelete(deleteTarget.id)}><i className="fas fa-trash"></i> Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BULK IMPORT WIZARD ── StudentTab wale modal jaisa hi, magar 3 steps
          (staff ka ek hi format hai, is liye "Choose Format" step nahi). */}
      {showImport && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget && !importing) closeImport(); }}>
          <div className="modal modal-xl">
            <div style={{ background: 'linear-gradient(135deg,#4C1D95,#7C3AED)', padding: '18px 24px', borderRadius: '20px 20px 0 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Bulk Import Staff</div>
                  <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 12, marginTop: 4 }}>Add multiple employees from one Excel file</div>
                </div>
                <button className="modal-close" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }} onClick={closeImport}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
            <div className="modal-body">
              {/* Step indicators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
                {['Download Template', 'Upload File', 'Preview & Import'].map((label, i) => {
                  const stepNum = i + 1;
                  const state = importStep === stepNum ? 'active' : importStep > stepNum ? 'done' : 'idle';
                  return (
                    <React.Fragment key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, border: '1.5px solid', borderColor: state === 'active' ? '#7C3AED' : state === 'done' ? '#16A34A' : 'var(--border-light)', background: state === 'active' ? '#EDE9FE' : state === 'done' ? '#DCFCE7' : 'var(--bg-card)', color: state === 'active' ? '#6D28D9' : state === 'done' ? '#15803D' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {state === 'done' ? <i className="fas fa-check"></i> : stepNum}
                        {(state === 'active') && <span style={{ marginLeft: 3 }}>{label}</span>}
                      </div>
                      {i < 2 && <div style={{ flex: 1, height: 2, background: state === 'done' ? '#16A34A' : 'var(--border-light)', minWidth: 10 }}></div>}
                    </React.Fragment>
                  );
                })}
              </div>

              {importStep === 1 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Download Template</div>
                  <div style={{ background: 'linear-gradient(135deg,#15803D,#166534)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <i className="fas fa-file-excel" style={{ color: '#fff', fontSize: 28 }}></i>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 700 }}>Staff Import Template.xlsx</div>
                      <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 11 }}>Excel format · Ready to fill</div>
                    </div>
                    <button className="btn btn-md" style={{ background: '#fff', color: '#15803D', fontWeight: 700 }} onClick={downloadStaffTemplate}>
                      <i className="fas fa-download"></i> Download
                    </button>
                  </div>
                  <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <i className="fas fa-exclamation-triangle" style={{ color: 'var(--warning)', marginRight: 6 }}></i>
                    <strong>Note:</strong> Do not change column headers. Date format: DD/MM/YYYY. Gender: Male/Female/Other. Columns marked * are required.
                  </div>
                </div>
              )}

              {importStep === 2 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>Upload Filled Template</div>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                  />
                  <div onClick={() => importInputRef.current?.click()}
                    style={{ border: `2px dashed ${importFile ? '#16A34A' : 'var(--border-med)'}`, borderRadius: 'var(--radius-lg)', padding: 40, textAlign: 'center', cursor: 'pointer', background: importFile ? 'rgba(22,163,74,.05)' : 'var(--bg-muted)' }}>
                    <i className={`fas ${importFile ? 'fa-file-excel' : 'fa-cloud-upload-alt'}`} style={{ fontSize: 40, color: importFile ? '#16A34A' : 'var(--brand-primary)', opacity: importFile ? 1 : .4, display: 'block', marginBottom: 12 }}></i>
                    {importFile ? (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>{importFile.name}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                          {(importFile.size / 1024).toFixed(1)} KB{importPreview ? ` · ${importPreview.rows.length} row${importPreview.rows.length !== 1 ? 's' : ''} detected` : ''} · click to change
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Click to browse</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>Select your filled template</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Supported: .xlsx only</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {importStep === 3 && (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14 }}>
                    Preview Import Data{importPreview ? ` · ${importPreview.rows.length} row${importPreview.rows.length !== 1 ? 's' : ''}` : ''}
                  </div>
                  {!importPreview || importPreview.rows.length === 0 ? (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <i className="fas fa-table" style={{ fontSize: 32, opacity: .3, display: 'block', marginBottom: 12 }}></i>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>No data to preview</div>
                      <div style={{ fontSize: 12.5, marginTop: 4 }}>Upload a file in step 2 first</div>
                    </div>
                  ) : (
                    <div style={{ overflow: 'auto', maxHeight: 360, border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                        <thead>
                          <tr style={{ background: '#4C1D95' }}>
                            <th style={{ padding: '9px 10px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left', whiteSpace: 'nowrap' }}>#</th>
                            {importPreview.headers.map((h, hi) => (
                              <th key={hi} style={{ padding: '9px 10px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.rows.slice(0, 50).map((r, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-muted)' }}>
                              <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{ri + 1}</td>
                              {importPreview.headers.map((_, ci) => (
                                <td key={ci} style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light)', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{String(r[ci] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {importPreview.rows.length > 50 && (
                        <div style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--text-muted)', background: 'var(--bg-muted)' }}>
                          Showing first 50 of {importPreview.rows.length} rows. All rows will be imported.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-light)', flexWrap: 'wrap', gap: 10 }}>
                <div>{importStep > 1 && <button className="btn btn-secondary btn-md" onClick={() => setImportStep(s => s - 1)} disabled={importing}><i className="fas fa-arrow-left"></i> Back</button>}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost btn-md" onClick={closeImport} disabled={importing}>Cancel</button>
                  {importStep < 3
                    ? <button
                        className="btn btn-md"
                        style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)', color: '#fff', opacity: (importStep === 2 && !importFile) ? .5 : 1 }}
                        disabled={importStep === 2 && !importFile}
                        onClick={() => setImportStep(s => s + 1)}>
                        Next <i className="fas fa-arrow-right"></i>
                      </button>
                    : <button
                        className="btn btn-md"
                        style={{ background: 'linear-gradient(135deg,#15803D,#166534)', color: '#fff', opacity: (!importFile || importing) ? .6 : 1 }}
                        disabled={!importFile || importing}
                        onClick={confirmImport}>
                        <i className={`fas ${importing ? 'fa-spinner fa-spin' : 'fa-check'}`}></i> {importing ? 'Importing…' : 'Confirm Import'}
                      </button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* spacer so the fixed save bar doesn't cover the pagination */}
      <div style={{ height: 84 }} aria-hidden="true" />
      {/* Save & Continue — move to the next setup step */}
      <div className="save-bar">
        <div className="save-bar-left">
          <div className="autosave-dot"></div>
          <span>Draft auto-saved</span>
        </div>
        <div className="save-bar-right">
          <button className="btn btn-primary btn-md" onClick={() => onContinue?.()}>
            Save &amp; Continue <i className="fas fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
