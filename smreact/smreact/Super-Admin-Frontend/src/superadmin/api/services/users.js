/* User Management service — admin users, their menu permissions and school
   assignments. Mock mode serves ./userMgmtData; live mode hits the .NET API. */
import { resolve, request, upload } from '../client';
import EP from '../endpoints';
import { INITIAL_USERS, INITIAL_PERMS } from '../../userMgmtData';

export const listUsers = ({ search, page, pageSize } = {}) =>
  resolve(() => INITIAL_USERS, () => request(EP.users.list(), { query: { search, page, pageSize } }));

export const createUser = (user) =>
  resolve(() => ({ ...user, id: Date.now() }), () => request(EP.users.create(), { method: 'POST', body: user }));

export const updateUser = (id, patch) =>
  resolve(() => ({ id, ...patch }), () => request(EP.users.update(id), { method: 'PUT', body: patch }));

export const deleteUser = (id) =>
  resolve(() => ({ id }), () => request(EP.users.remove(id), { method: 'DELETE' }));

export const getUserPermissions = (id) =>
  resolve(() => INITIAL_PERMS[id] || [], () => request(EP.users.permissions(id)));

export const setUserPermissions = (id, menus) =>
  resolve(() => menus, () => request(EP.users.permissions(id), { method: 'PUT', body: { menus } }));

export const getUserAssignments = (id) =>
  resolve(() => [], () => request(EP.users.assignments(id)));

export const setUserAssignments = (id, schoolIds) =>
  resolve(() => schoolIds, () => request(EP.users.assignments(id), { method: 'PUT', body: { schoolIds } }));

export const uploadUserPicture = (id, file) => {
  const fd = new FormData();
  fd.append('file', file, file.name || 'picture');
  return resolve(() => ({ id }), () => upload(EP.users.picture(id), fd));
};
