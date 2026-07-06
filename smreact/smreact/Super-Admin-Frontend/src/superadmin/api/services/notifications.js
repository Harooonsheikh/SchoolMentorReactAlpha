/* Notifications service — targeted mobile-app push notifications and the
   sent-history table. */
import { resolve, request } from '../client';
import EP from '../endpoints';
import { INITIAL_NOTIFS, estimateRecipients } from '../../notificationsData';

export const listNotifications = ({ audience, type, page, pageSize } = {}) =>
  resolve(() => INITIAL_NOTIFS, () => request(EP.notifications.list(), { query: { audience, type, page, pageSize } }));

export const sendNotification = (notification) =>
  resolve(() => ({ id: Date.now(), ...notification }), () => request(EP.notifications.send(), { method: 'POST', body: notification }));

export const updateNotification = (id, patch) =>
  resolve(() => ({ id, ...patch }), () => request(EP.notifications.update(id), { method: 'PUT', body: patch }));

export const deleteNotification = (id) =>
  resolve(() => ({ id }), () => request(EP.notifications.remove(id), { method: 'DELETE' }));

/** Estimate how many recipients a target selection will reach. */
export const estimateNotificationRecipients = ({ audience, sub, cls, section } = {}) =>
  resolve(
    () => ({ count: estimateRecipients(audience, sub) }),
    () => request(EP.notifications.recipients(), { query: { audience, sub, cls, section } }),
  );
