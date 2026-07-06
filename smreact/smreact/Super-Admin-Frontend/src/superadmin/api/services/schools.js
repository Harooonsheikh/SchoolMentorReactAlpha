/* Schools Progress service — launch/ERP/inactive schools, onboarding,
   per-school enquiries (bugs) and follow-up notes/calls/messages. */
import { resolve, request } from '../client';
import EP from '../endpoints';
import { INITIAL_LAUNCH, INITIAL_ERP, INITIAL_INACTIVE, INITIAL_ENQUIRIES } from '../../statusData';

/** group: 'launch' | 'erp' | 'inactive' | undefined (all groups). */
export const listSchools = (group) =>
  resolve(
    () => (group === 'erp' ? INITIAL_ERP
      : group === 'inactive' ? INITIAL_INACTIVE
        : group === 'launch' ? INITIAL_LAUNCH
          : { launch: INITIAL_LAUNCH, erp: INITIAL_ERP, inactive: INITIAL_INACTIVE }),
    () => request(EP.schools.list(), { query: { group } }),
  );

export const getSchoolEnquiries = (schoolId) =>
  resolve(() => INITIAL_ENQUIRIES[schoolId] || [], () => request(EP.schools.enquiries(schoolId)));

export const createEnquiry = (schoolId, enquiry) =>
  resolve(() => ({ id: Date.now(), ...enquiry }), () => request(EP.schools.enquiries(schoolId), { method: 'POST', body: enquiry }));

export const updateEnquiry = (enquiryId, patch) =>
  resolve(() => ({ id: enquiryId, ...patch }), () => request(EP.schools.updateEnquiry(enquiryId), { method: 'PUT', body: patch }));

/** followup: { kind: 'note'|'call'|'message', text } */
export const addFollowup = (schoolId, followup) =>
  resolve(() => ({ id: Date.now(), ...followup }), () => request(EP.schools.followups(schoolId), { method: 'POST', body: followup }));

export const setSchoolStatus = (schoolId, active) =>
  resolve(() => ({ id: schoolId, active }), () => request(EP.schools.setStatus(schoolId), { method: 'PUT', body: { active } }));
