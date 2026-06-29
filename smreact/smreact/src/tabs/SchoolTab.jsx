import React, { useState, useEffect, useRef } from 'react';
import { buildUrl } from '../utils/apiConfig';

// ─── Validation rules ──────────────────────────────────────────────────────
const fieldRules = {
  name:            v => String(v ?? '').trim().length > 1,
  branchEmail1:    v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v ?? '').trim()),
  branchPhone:     v => String(v ?? '').trim().length >= 7,
  countryID:       v => Number(v) > 0,
  provinceID:      v => Number(v) > 0,
  cityID:          v => Number(v) > 0,
  address:         v => String(v ?? '').trim().length > 5,
  academicSession: v => String(v ?? '').trim().length > 2,
  bankAccountno:   v => String(v ?? '').trim().length > 3,
  iban:            v => String(v ?? '').trim().length > 5,
  bankName:            v => String(v ?? '').trim().length > 5,
  accountTitle:            v => String(v ?? '').trim().length > 5,
  bankBranchName:            v => String(v ?? '').trim().length > 5,
};

const errorMsgs = {
  name:            'School name is required',
  branchEmail1:    'Enter a valid email address',
  branchPhone:     'Enter a valid phone number',
  countryID:       'Please select a country',
  provinceID:      'Please select a province',
  cityID:          'Please select a city',
  address:         'Please enter a complete address',
  academicSession: 'Please enter the academic session',
  bankAccountno:   'Account number is required',
  iban:            'IBAN is required',
  bankName:            'Bank Name is required',
  accountTitle:            'Account Title is required',
  bankBranchName:            'Bank Branch Name is required',
};

// ─── Sub-components (defined at module level — never recreated on render) ───
function FormInput({ icon, id, type = 'text', placeholder, value, onChange, onBlur, fieldErrors }) {
  const status = fieldErrors[id];
  return (
    <div className="input-wrapper">
      {icon && <i className={`fas ${icon} input-icon`}></i>}
      <input
        className={`form-input${icon ? ' has-icon' : ''}${status === 'error' ? ' error-field' : status === 'ok' ? ' success-field' : ''}`}
        id={id} type={type} placeholder={placeholder}
        value={value ?? ''}
        onChange={e => onChange(id, e.target.value)}
        onBlur={e => onBlur && onBlur(id, e.target.value)}
      />
    </div>
  );
}

function FieldMsg({ id, fieldErrors }) {
  const status = fieldErrors[id];
  if (!status) return <span className="field-msg" />;
  if (status === 'ok')    return <span className="field-msg success"><i className="fas fa-check-circle"></i> Looks good</span>;
  if (status === 'error') return <span className="field-msg error"><i className="fas fa-times-circle"></i> {errorMsgs[id]}</span>;
  return <span className="field-msg" />;
}

function FG({ label, id, required: req, children, helper, fieldErrors }) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}{req && <span className="req-star"> *</span>}
      </label>
      {children}
      <FieldMsg id={id} fieldErrors={fieldErrors} />
      {helper && <span className="form-helper info"><i className="fas fa-info-circle"></i> {helper}</span>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function SchoolTab({ schoolInfo, setSchoolInfo, onSave, onSaveDraft, markUnsaved, showToast }) {
  const [fieldErrors, setFieldErrors]   = useState({});
  const [saving, setSaving]             = useState(false);
  const [countryList, setCountryList]   = useState([]);
  const [sessionList, setSessionList]   = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList]         = useState([]);
  const [branchSession, setBranchSession]         = useState([]);
  const [logoPreview, setLogoPreview]   = useState('');
  const [logoFile, setLogoFile]         = useState(null);

  // Refs to track PREVIOUS values so province/city effects
  // only fire when those specific IDs actually change — not on every keystroke
  const prevCountryID  = useRef(null);
  const prevProvinceID = useRef(null);
  const dataLoaded     = useRef(false);   // prevent getBranchdata running twice

  const s = field => schoolInfo?.[field] ?? '';

  // ── Field handlers ────────────────────────────────────────────────────────
  const handleChange = (id, val) => {
    setSchoolInfo(prev => ({ ...prev, [id]: val }));
    markUnsaved?.();
    if (fieldRules[id]) {
      setFieldErrors(prev => ({ ...prev, [id]: fieldRules[id](val) ? 'ok' : 'error' }));
    }
  };

  const handleBlur = (id, val) => {
    if (fieldRules[id]) {
      setFieldErrors(prev => ({
        ...prev,
        [id]: fieldRules[id](val) ? 'ok' : (val ? 'error' : ''),
      }));
    }
  };

  const validateAll = () => {
    const required = ['name','branchEmail1','branchPhone','countryID','provinceID','cityID','address','academicSession','bankAccountno','iban'];
    const errors = {};
    const missing = [];
    required.forEach(id => {
      const val = schoolInfo?.[id] ?? '';
      const ok  = fieldRules[id] ? fieldRules[id](val) : String(val).trim().length > 0;
      errors[id] = ok ? 'ok' : 'error';
      if (!ok) missing.push(errorMsgs[id] || id);
    });
    setFieldErrors(prev => ({ ...prev, ...errors }));
    return missing;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const missing = validateAll();
    if (missing.length) {
      showToast?.(`Please fill required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`, 'error');
      onSave?.('error', missing);
      return;
    }
    setSaving(true);
    try {
      const UserID = sessionStorage.getItem('UserID') || 0;
      const BranchID = sessionStorage.getItem('branchID') || 0;
      const fd = new FormData();
      fd.append('ID',                     schoolInfo.id              ?? schoolInfo.ID ?? 0);
      fd.append('Name',                   schoolInfo.name            ?? '');
      fd.append('BranchCode',             schoolInfo.branchCode      ?? '');
      fd.append('Description',            schoolInfo.description     ?? '');
      fd.append('Address',                schoolInfo.address         ?? '');
      fd.append('CountryID',              schoolInfo.countryID       ?? 0);
      fd.append('ProvinceID',             schoolInfo.provinceID      ?? 0);
      fd.append('CityID',                 schoolInfo.cityID          ?? 0);
      fd.append('CreatedAt',              schoolInfo.createdAt       ?? new Date().toISOString());
      fd.append('CreatedBy',              schoolInfo.createdBy       ?? 0);
      fd.append('ModifiedAt',             new Date().toISOString());
      fd.append('ModifiedBy',             UserID);
      fd.append('IsActive',               schoolInfo.isActive        ?? true);
      fd.append('FineFee',                schoolInfo.fineFee         ?? 0);
      fd.append('FineEnabled',            schoolInfo.fineEnabled     ?? 0);
      fd.append('AcademicSession',        schoolInfo.academicSession ?? '');
      fd.append('BranchOwner',            schoolInfo.branchOwner     ?? '');
      fd.append('BranchEmail1',           schoolInfo.branchEmail1    ?? '');
      fd.append('BranchPhone',            schoolInfo.branchPhone     ?? '');
      fd.append('BankAccountno',          schoolInfo.bankAccountno   ?? '');
      fd.append('AccountDesc',            schoolInfo.accountDesc     ?? 0);
      fd.append('BranchLogo',             schoolInfo.branchLogo      ?? '');
      fd.append('LaunchSetup',            schoolInfo.launchSetup            ?? 0);
      fd.append('IsManualRegNo',          schoolInfo.isManualRegNo          ?? true);
      fd.append('IsOperationalSOPs',      schoolInfo.isOperationalSOPs      ?? true);
      fd.append('IsFeeReceivingHeadWise', schoolInfo.isFeeReceivingHeadWise ?? true);
      fd.append('IsDiscChallan',          schoolInfo.isDiscChallan          ?? true);
      fd.append('IsTransportFee',         schoolInfo.isTransportFee         ?? true);
      fd.append('IsPLNeeded',             schoolInfo.isPLNeeded             ?? true);
      fd.append('BankName',             schoolInfo.bankName             ?? true);
      fd.append('AccountTitle',             schoolInfo.accountTitle             ?? true);
      fd.append('IBAN',             schoolInfo.iban             ?? true);
      fd.append('BankBranchName',             schoolInfo.bankBranchName             ?? true);
      if (logoFile) fd.append('BranchLogoFile', logoFile, logoFile.name);

      const res  = await fetch(buildUrl('/api/Registration/update-branch'), { method: 'PUT', body: fd });
      const data = await res.json();
    // const res2 = await fetch(buildUrl('/api/Setting/save-branch-session'), {
    //   method: 'POST',
    //   headers: {
    //     'Accept': '*/*',
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     id: 0,
    //     branchID: BranchID,
    //     isActive: true,
    //     sessionID: branchSession,
    //     sessionName: schoolInfo.academicSession
    //   }),
    // });

      setSaving(false);
      if (res.ok) {
        showToast('Branch updated successfully', 'success');
        onSave('success');
      } else {
        showToast(data.message || 'Update failed', 'error');
      }
    } catch (err) {
      setSaving(false);
      showToast('Network error. Please try again.', 'error');
      console.error(err);
    }
  };


  // ── API calls ─────────────────────────────────────────────────────────────
  async function getCountryList() {
    try {
      const res  = await fetch(buildUrl('/api/Setting/get-countries'), { headers: { Accept: '*/*' } });
      const json = await res.json();
      setCountryList(json.data ?? []);
    } catch { showToast('Could not load countries', 'error'); }
  }

  async function getSessionList() {
    try {
      const res  = await fetch(buildUrl('/api/Setting/get-sessions'), { headers: { Accept: '*/*' } });
      const json = await res.json();
      setSessionList(json.data ?? []);
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

  async function getBranchdata() {
    try {
      const branchID = sessionStorage.getItem('branchID');
      const res      = await fetch(buildUrl(`/api/Registration/get-branch/${branchID}`), { headers: { Accept: '*/*' } });
      const json     = await res.json();
      const d        = json.data ?? {};
      setSchoolInfo(d);
      setLogoPreview(d.branchLogo || d.logo || '');
      // seed the refs so the province/city effects don't re-fire on first render
      prevCountryID.current  = d.countryID  ?? null;
      prevProvinceID.current = d.provinceID ?? null;
      // load dropdowns for the returned IDs
      if (d.countryID)  getProvinceList(d.countryID);
      if (d.provinceID) getCityList(d.provinceID);
    } catch { showToast('Could not load branch data', 'error'); }
  }

  async function getSesssiondata() {
    try {
      const branchID = sessionStorage.getItem('branchID');
      const res      = await fetch(buildUrl(`/api/Setting/get-branch-session/${branchID}`), { headers: { Accept: '*/*' } });
      const json     = await res.json();
      const d        = json.data[0] ?? {};
      if (d) {
      // setBranchSession(d);
              setBranchSession(String(d.SessionID));
      handleChange('academicSession', d.SessionName);
    }
    } catch { console.log('Could not load branch data'); }
  }

  // ── Effects ───────────────────────────────────────────────────────────────
  // Run ONCE on mount only
  useEffect(() => {
    getCountryList();
    getSessionList();
    if (!dataLoaded.current) {
      dataLoaded.current = true;
      getBranchdata();
      getSesssiondata();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch provinces ONLY when countryID genuinely changes (user picked a new country)
  useEffect(() => {
    const id = schoolInfo?.countryID;
    if (!id) return;
    if (id === prevCountryID.current) return;  // same value → skip (typing in other fields won't trigger this)
    prevCountryID.current = id;
    getProvinceList(id);
  }, [schoolInfo?.countryID]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch cities ONLY when provinceID genuinely changes
  useEffect(() => {
    const id = schoolInfo?.provinceID;
    if (!id) return;
    if (id === prevProvinceID.current) return;
    prevProvinceID.current = id;
    getCityList(id);
  }, [schoolInfo?.provinceID]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────────────────────────
  const fe = fieldErrors; // shorthand

  return (
    <div className="tab-panel active" id="panelSchool">

      {/* ══ Basic Information ══════════════════════════════════════════════ */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon blue"><i className="fas fa-info-circle"></i></div>
          <div>
            <div className="section-title">Basic School Information</div>
            <div className="section-desc">Core identity details for your school</div>
          </div>
        </div>

        <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
          <FG fieldErrors={fe} label="School Name" id="name" required>
            <FormInput icon="fa-school" id="name" placeholder="e.g. Milford Sounds Academy"
              value={s('name')} onChange={handleChange} onBlur={handleBlur} fieldErrors={fe} />
          </FG>

          <FG fieldErrors={fe} label="Branch Code" id="branchCode">
            <div className="input-wrapper">
              <i className="fas fa-id-card input-icon"></i>
              <input className="form-input has-icon" placeholder="e.g. 5790"
                value={s('branchCode')}
                onChange={e => handleChange('branchCode', e.target.value)} />
            </div>
          </FG>

          <FG fieldErrors={fe} label="School Email" id="branchEmail1" required>
            <FormInput icon="fa-envelope" id="branchEmail1" type="email" placeholder="school@example.com"
              value={s('branchEmail1')} onChange={handleChange} onBlur={handleBlur} fieldErrors={fe} />
          </FG>

          <FG fieldErrors={fe} label="Contact Number" id="branchPhone" required>
            <FormInput icon="fa-phone" id="branchPhone" type="tel" placeholder="+92 300 0000000"
              value={s('branchPhone')} onChange={handleChange} onBlur={handleBlur} fieldErrors={fe} />
          </FG>

          <FG fieldErrors={fe} label="School Owner / Principal" id="branchOwner">
            <div className="input-wrapper">
              <i className="fas fa-user-tie input-icon"></i>
              <input className="form-input has-icon" placeholder="Full name"
                value={s('branchOwner')}
                onChange={e => handleChange('branchOwner', e.target.value)} />
            </div>
          </FG>

          <FG fieldErrors={fe} label="Description" id="description">
            <div className="input-wrapper">
              <i className="fas fa-align-left input-icon"></i>
              <input className="form-input has-icon" placeholder="Short school description"
                value={s('description')}
                onChange={e => handleChange('description', e.target.value)} />
            </div>
          </FG>
        </div>

        {/* Logo */}
        <div className="form-group">
          <label className="form-label">School Logo</label>
          <div className="upload-zone" onClick={() => document.getElementById('logoInput').click()}>
            {logoPreview ? (
              <img src={logoPreview} alt="School Logo"
                style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 10 }} />
            ) : (
              <>
                <div className="upload-icon"><i className="fas fa-image"></i></div>
                <div className="upload-title">Upload School Logo</div>
                <div className="upload-sub">Drag &amp; drop or <span>click to browse</span> — JPG, PNG (max 2 MB)</div>
              </>
            )}
          </div>
          <input id="logoInput" type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files[0];
              e.target.value = ''; // allow re-selecting the same file
              if (!file) return;
              setLogoFile(file);
              markUnsaved?.();
              const reader = new FileReader();
              reader.onload = () => setLogoPreview(reader.result);
              reader.readAsDataURL(file);
            }} />
        </div>
      </div>

      {/* ══ Location ═══════════════════════════════════════════════════════ */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon green"><i className="fas fa-map-marked-alt"></i></div>
          <div>
            <div className="section-title">Location Information</div>
            <div className="section-desc">Where your school is located</div>
          </div>
        </div>

        <div className="form-grid form-grid-3" style={{ marginBottom: 16 }}>
          <FG fieldErrors={fe} label="Country" id="countryID" required>
            <select
              className={`form-select${fe.countryID === 'error' ? ' error-field' : fe.countryID === 'ok' ? ' success-field' : ''}`}
              value={s('countryID')}
              onChange={e => {
                const val = e.target.value;
                handleChange('countryID',  val);
                handleChange('provinceID', '');
                handleChange('cityID',     '');
                setProvinceList([]);
                setCityList([]);
              }}
            >
              <option value="">Select Country</option>
              {countryList.map(c => <option key={c.ID} value={c.ID}>{c.Name}</option>)}
            </select>
          </FG>

          <FG fieldErrors={fe} label="Province / State" id="provinceID" required>
            <select
              className={`form-select${fe.provinceID === 'error' ? ' error-field' : fe.provinceID === 'ok' ? ' success-field' : ''}`}
              value={s('provinceID')}
              onChange={e => {
                const val = e.target.value;
                handleChange('provinceID', val);
                handleChange('cityID',     '');
                setCityList([]);
              }}
            >
              <option value="">Select Province</option>
              {provinceList.map(p => <option key={p.ID} value={p.ID}>{p.Name}</option>)}
            </select>
          </FG>

          <FG fieldErrors={fe} label="City" id="cityID" required>
            <select
              className={`form-select${fe.cityID === 'error' ? ' error-field' : fe.cityID === 'ok' ? ' success-field' : ''}`}
              value={s('cityID')}
              onChange={e => handleChange('cityID', e.target.value)}
            >
              <option value="">Select City</option>
              {cityList.map(c => <option key={c.ID} value={c.ID}>{c.Name}</option>)}
            </select>
          </FG>
        </div>

        <FG fieldErrors={fe} label="Complete Address" id="address" required>
          <textarea
            className={`form-input${fe.address === 'error' ? ' error-field' : fe.address === 'ok' ? ' success-field' : ''}`}
            rows={2} placeholder="Street address, area, city..."
            value={s('address')}
            onChange={e => handleChange('address', e.target.value)}
            onBlur={e => handleBlur('address', e.target.value)}
            style={{ resize: 'vertical', marginBottom: 0 }}
          />
        </FG>

     {/*   <div style={{ marginTop: 12 }}>
          <div className="form-grid form-grid-2">

            <FG fieldErrors={fe} label="Academic Session" id="academicSession" required>
               <select
                className={`form-select${fe.academicSession === 'error' ? ' error-field' : fe.academicSession === 'ok' ? ' success-field' : ''}`}
                value={branchSession}
                onChange={e => {
                  const pickedID = e.target.value;
                  const pickedSession = sessionList.find(x => String(x.SessionID) === pickedID);
                  setBranchSession(pickedID);
                  handleChange('academicSession', pickedSession?.SessionName ?? '');
                }}
              >
                <option value="">Select Session</option>
                {sessionList.map(c => (
                  <option key={c.SessionID} value={String(c.SessionID)}>
                    {c.SessionName}
                  </option>
                ))}
              </select>
            </FG>
          </div>
        </div>*/}
      </div>

      {/* ══ Banking ════════════════════════════════════════════════════════ */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-icon rose"><i className="fas fa-university"></i></div>
          <div>
            <div className="section-title">Banking &amp; Fee Information</div>
            <div className="section-desc">Used on fee challans for parent payments</div>
          </div>
        </div>

        <div className="helper-banner">
          <i className="fas fa-info-circle"></i>
          <span>These banking details will be displayed to parents on fee challans and payment receipts. Please ensure all information is accurate.</span>
        </div>

        <div className="form-grid form-grid-2">
          <FG fieldErrors={fe} label="Bank Name" id="bankName">
            <div className="input-wrapper">
              <i className="fas fa-university input-icon"></i>
              <input className="form-input has-icon" placeholder="e.g. Bank Islami Pakistan"
                value={s('bankName')}
                onChange={e => handleChange('bankName', e.target.value)} />
            </div>
          </FG>

          <FG fieldErrors={fe} label="Account Title" id="accountTitle">
            <div className="input-wrapper">
              <i className="fas fa-user input-icon"></i>
              <input className="form-input has-icon" placeholder="Account holder name"
                value={s('accountTitle')}
                onChange={e => handleChange('accountTitle', e.target.value)} />
            </div>
          </FG>

          <FG fieldErrors={fe} label="Account Number" id="bankAccountno" required>
            <div className="input-wrapper">
              <i className="fas fa-hashtag input-icon"></i>
              <input
                className={`form-input has-icon${fe.bankAccountno === 'error' ? ' error-field' : fe.bankAccountno === 'ok' ? ' success-field' : ''}`}
                placeholder="Bank account number"
                value={s('bankAccountno')}
                onChange={e => handleChange('bankAccountno', e.target.value)}
                onBlur={e => handleBlur('bankAccountno', e.target.value)}
              />
            </div>
          </FG>

          <FG fieldErrors={fe} label="IBAN" id="iban" required>
            <div className="input-wrapper">
              <i className="fas fa-credit-card input-icon"></i>
              <input
                className={`form-input has-icon${fe.iban === 'error' ? ' error-field' : fe.iban === 'ok' ? ' success-field' : ''}`}
                placeholder="PKXX BANK 0000 0000 0000"
                value={s('iban')}
                onChange={e => handleChange('iban', e.target.value)}
                onBlur={e => handleBlur('iban', e.target.value)}
              />
            </div>
          </FG>

          <FG fieldErrors={fe} label="Bank Branch Name" id="branchName">
            <div className="input-wrapper">
              <i className="fas fa-map-marker-alt input-icon"></i>
              <input className="form-input has-icon" placeholder="e.g. Blue Area Branch"
                value={s('bankBranchName')}
                onChange={e => handleChange('bankBranchName', e.target.value)} />
            </div>
          </FG>
        </div>
      </div>

      {/* ══ Save Bar ═══════════════════════════════════════════════════════ */}
      <div className="save-bar">
        <div className="save-bar-left">
          <div className="autosave-dot"></div>
          <span>Draft auto-saved</span>
        </div>
        <div className="save-bar-right">
          {/* <button className="btn btn-secondary btn-md" onClick={handleDraft} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <><i className="fas fa-save"></i> Save Draft</>}
          </button> */}
          <button className="btn btn-primary btn-md" onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin"></i> Saving...</> : <>Save &amp; Continue <i className="fas fa-arrow-right"></i></>}
          </button>
        </div>
      </div>

    </div>
  );
}