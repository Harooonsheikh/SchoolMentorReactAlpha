/* Parents App Settings — mock data.

   School-level (not per-user, unlike User Permissions' mobile app
   access): one settings record for the whole school. The Parent app
   itself has no master on/off switch — it is always available; this
   record only controls which individual features are visible.
   Ported from School-Mentor-Front-end. Swap for a real backend when
   one lands; keep the return shape identical. */

export const PARENT_APP_FEATURES = {
  ATTENDANCE:   'attendance',
  HOMEWORK:     'homework',
  ACADEMICS:    'academics',
  RESULTS:      'results',
  FEE:          'fee',
  TIMETABLE:    'timetable',
  SUGGESTIONS:  'suggestions',
  NOTICE_BOARD: 'notice_board',
  NOTEBOOK:     'notebook',
  LEAVES:       'leaves',
};

export const PARENT_APP_FEATURE_META = {
  attendance:   { label: 'Attendance',    icon: 'fa-clipboard-check' },
  homework:     { label: 'Homework',      icon: 'fa-book-open' },
  academics:    { label: 'Academics',     icon: 'fa-book-open-reader' },
  results:      { label: 'Results',       icon: 'fa-chart-simple' },
  fee:          { label: 'Fee',           icon: 'fa-money-bill-wave' },
  timetable:    { label: 'Timetable',     icon: 'fa-calendar-days' },
  suggestions:  { label: 'Suggestions',   icon: 'fa-lightbulb' },
  notice_board: { label: 'Notice Board',  icon: 'fa-bullhorn' },
  notebook:     { label: 'Notebook',      icon: 'fa-note-sticky' },
  leaves:       { label: 'Leaves',        icon: 'fa-umbrella-beach' },
};

export const mockParentAppSettings = {
  featureEnabled: {
    attendance: true,
    homework: true,
    academics: true,
    results: true,
    fee: true,
    timetable: true,
    suggestions: true,
    notice_board: true,
    notebook: true,
    leaves: true,
  },
};
