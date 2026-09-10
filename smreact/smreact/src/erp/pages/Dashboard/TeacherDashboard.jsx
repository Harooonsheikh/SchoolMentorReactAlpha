import React from 'react';
import AdminDashboard from './AdminDashboard';

/* Teacher dashboard = same live get-dashboard as Command Center.
   API ke saare sections (KPI, snapshot, fee, app adoption, attendance,
   lesson plans, paper generator, finance, birthdays, activities,
   announcements) yahan bhi dikhte hain — kuch missing nahi. */
export default function TeacherDashboard(props) {
  return <AdminDashboard {...props} showAllModules />;
}
