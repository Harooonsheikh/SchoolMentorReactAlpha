/*
  Service layer contract — read this first.

  Every service file in this folder exposes async functions that today read
  from src/mock/ but will be swapped to real HTTP calls (axios, fetch, …)
  by the backend team. UI components MUST NOT import from src/mock/ directly,
  and MUST NOT inline mock data. They go through services only.

  When wiring real APIs later:
    1. Replace `delay(...)` + `clone(mock...)` inside each service function
       with the real HTTP call.
    2. Keep each function's signature and return shape stable.
    3. Throw on error (or return null/[] per the contract documented on each
       function) so the existing useAsync hook surfaces it as `error`.

  Do NOT introduce caching, retries, or auth here unless told to — those are
  cross-cutting concerns the backend team owns.
*/

export const NETWORK_DELAY_MS = 120;

export function delay(ms = NETWORK_DELAY_MS) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function clone(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
