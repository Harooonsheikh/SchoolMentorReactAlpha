/* E-Tube service — HO videos, categories, school-submitted videos and the
   review queue. Video creation is a multipart upload. */
import { resolve, request, upload } from '../client';
import EP from '../endpoints';
import { INITIAL_VIDS, INITIAL_CATS, INITIAL_REVS, INITIAL_SCHOOL_VIDS } from '../../etubeData';

export const listVideos = () =>
  resolve(() => INITIAL_VIDS, () => request(EP.etube.videos()));

export const createVideo = (meta, file) => {
  const fd = new FormData();
  Object.entries(meta || {}).forEach(([k, v]) => fd.append(k, v ?? ''));
  if (file) fd.append('file', file, file.name || 'video');
  return resolve(() => ({ id: Date.now(), ...meta }), () => upload(EP.etube.videos(), fd));
};

export const updateVideo = (id, patch) =>
  resolve(() => ({ id, ...patch }), () => request(EP.etube.video(id), { method: 'PUT', body: patch }));

export const deleteVideo = (id) =>
  resolve(() => ({ id }), () => request(EP.etube.video(id), { method: 'DELETE' }));

export const listCategories = () =>
  resolve(() => INITIAL_CATS, () => request(EP.etube.categories()));

export const saveCategory = (cat) =>
  resolve(() => ({ id: cat.id || Date.now(), ...cat }),
    () => (cat.id
      ? request(EP.etube.category(cat.id), { method: 'PUT', body: cat })
      : request(EP.etube.categories(), { method: 'POST', body: cat })));

export const deleteCategory = (id) =>
  resolve(() => ({ id }), () => request(EP.etube.category(id), { method: 'DELETE' }));

export const listReviews = () =>
  resolve(() => INITIAL_REVS, () => request(EP.etube.reviews()));

/** status: 'Approved' | 'Rejected' */
export const setReviewStatus = (id, status, note) =>
  resolve(() => ({ id, status }), () => request(EP.etube.review(id), { method: 'PUT', body: { status, note } }));

export const listSchoolVideos = () =>
  resolve(() => INITIAL_SCHOOL_VIDS, () => request(EP.etube.schoolVideos()));

export const setSchoolVideoStatus = (id, status) =>
  resolve(() => ({ id, status }), () => request(EP.etube.schoolVideo(id), { method: 'PUT', body: { status } }));

export const deleteSchoolVideo = (id) =>
  resolve(() => ({ id }), () => request(EP.etube.schoolVideo(id), { method: 'DELETE' }));
