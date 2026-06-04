import {
  mockCrmOfficers,
  mockCrmSources,
  mockCrmStatuses,
  mockCrmLeads,
  mockCrmConverted,
  mockCrmNotInterested,
  mockCrmReasons,
  mockCrmSchool,
  mockCrmCurrentUser,
  mockCrmNextLeadId,
} from '../mock/admissionCrm';
import { delay, clone } from './_http';

/* Read APIs — return clones so callers can mutate locally without
   corrupting the mock for the next caller. */
export async function getCrmOfficers()       { await delay(); return clone(mockCrmOfficers); }
export async function getCrmSources()        { await delay(); return clone(mockCrmSources); }
export async function getCrmStatuses()       { await delay(); return clone(mockCrmStatuses); }
export async function getCrmLeads()          { await delay(); return clone(mockCrmLeads); }
export async function getCrmConverted()      { await delay(); return clone(mockCrmConverted); }
export async function getCrmNotInterested()  { await delay(); return clone(mockCrmNotInterested); }
export async function getCrmReasons()        { await delay(); return clone(mockCrmReasons); }
export async function getCrmSchool()         { await delay(); return clone(mockCrmSchool); }
export async function getCrmCurrentUser()    { await delay(); return mockCrmCurrentUser; }
export async function getCrmNextLeadId()     { await delay(); return mockCrmNextLeadId; }

/* Write APIs — in-memory only until backend wires real endpoints. */
export async function saveCrmLead(payload)              { await delay(); return clone({ ...payload, ok: true }); }
export async function deleteCrmLead({ id })             { await delay(); return { id, deleted: true }; }
export async function saveCrmFollowup({ id, ...rest })  { await delay(); return clone({ id, ...rest, ok: true }); }
export async function convertCrmLead({ id })            { await delay(); return { id, converted: true }; }
export async function markCrmNotInterested({ id })      { await delay(); return { id, archived: true }; }
export async function reactivateCrmLead({ id })         { await delay(); return { id, reactivated: true }; }
