import { mockParentAppSettings } from '../mock/parentAppSettings';
import { delay, clone } from './_http';

/* Parents App Settings — read/write the school-level record.
   Same delay()/clone() + mutate-in-place contract as the other mock
   services here. Swap the body for real HTTP calls when a backend
   lands; keep the return shape identical. Ported from
   School-Mentor-Front-end. */

export async function getParentAppSettings() {
  await delay();
  return clone(mockParentAppSettings);
}

export async function saveParentAppSettings(payload) {
  await delay();
  const { featureEnabled, ...rest } = payload || {};
  Object.assign(mockParentAppSettings, rest);
  if (featureEnabled) {
    Object.assign(mockParentAppSettings.featureEnabled, featureEnabled);
  }
  return clone(mockParentAppSettings);
}
