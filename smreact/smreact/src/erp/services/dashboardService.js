import { mockDashboardStats, mockDashboardAnnouncements } from '../mock/dashboard';
import { delay, clone } from './_http';

export async function getDashboardStats() {
  await delay();
  return clone(mockDashboardStats);
}

export async function getAnnouncements() {
  await delay();
  return clone(mockDashboardAnnouncements);
}
