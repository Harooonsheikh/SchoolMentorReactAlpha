import { mockProfile } from '../mock/profile';
import { delay, clone } from './_http';

export async function getProfile() {
  await delay();
  return clone(mockProfile);
}

export async function updateProfile(payload) {
  await delay();
  return clone({ ...mockProfile, ...payload });
}

export async function sendPasswordOtp(phone) {
  await delay();
  return { sent: true, to: phone };
}

export async function verifyPasswordOtp(phone, code) {
  await delay();
  return { verified: code === '0000' };
}

export async function changePassword(newPassword) {
  await delay();
  return { changed: true };
}
