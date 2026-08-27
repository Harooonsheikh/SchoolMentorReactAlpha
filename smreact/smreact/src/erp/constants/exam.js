/* EXAM_TERMS yahan se hata di gayi: terms API se aate hain
   (POST /api/termscrud), kisi bani banai list se nahi. */

export const EXAM_STATUS = {
  UPCOMING: 'upcoming',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
};

export const RS_GRADE_LIST = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'E', 'F'];

export const RS_COND_MAP = {
  gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=', between: '~',
};
