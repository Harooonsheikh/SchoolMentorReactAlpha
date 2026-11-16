/* Tech Notifications service — internal Release→Support handoff.
   Mirrors the shape a real .NET backend would return; see EP.techNotifications. */
import { request } from '../client';
import { SA_ADMIN_API_BASE } from '../config';
import EP from '../endpoints';
import { getNotificationsForAudience, pushNotification as pushNotificationLocal, acknowledgeNotification as acknowledgeNotificationLocal } from '../../techNotificationsData';

/* Live only — same as the other super-admin modules; base URL from config. */
const resolve = (_mock, live) => live();
const call = (path, opts = {}) => request(path, { ...opts, base: SA_ADMIN_API_BASE });

/** GET /api/TechNotifications?audience=support → Notification[]. */
export const getNotifications = (audience = 'support') =>
  resolve(
    () => getNotificationsForAudience(audience),
    () => call(EP.techNotifications.list(), { query: { audience } }),
  );

/** POST /api/TechNotifications → Notification. */
export const pushNotification = (payload) =>
  resolve(
    () => pushNotificationLocal(payload),
    () => call(EP.techNotifications.create(), { method: 'POST', body: payload }),
  );

export const acknowledgeNotification = (id) =>
  resolve(
    () => acknowledgeNotificationLocal(id),
    () => call(`${EP.techNotifications.list()}/${id}/ack`, { method: 'PUT' }),
  );
