import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import ProtectedRoute from '../auth/ProtectedRoute'
import { saveLastPath, readLastPath } from './lastPath'
import AdminLayout from '../layouts/AdminLayout'
import { ERP_LOGIN_URL } from '../config/env'
import Dashboard from '../pages/Dashboard/Dashboard'
import Settings from '../pages/Settings/Settings'
import SchoolPermissions from '../pages/SchoolPermissions/SchoolPermissions'
import SchoolStatus from '../pages/SchoolStatus/SchoolStatus'
import Payments from '../pages/Payments/Payments'
import SOPs from '../pages/SOPs/SOPs'
import TeacherTrainings from '../pages/TeacherTrainings/TeacherTrainings'
import Notifications from '../pages/Notifications/Notifications'
import UserPermissions from '../pages/UserPermissions/UserPermissions'
import Accounts from '../pages/Accounts/Accounts'
import Inventory from '../pages/Inventory/Inventory'
import HumanResource from '../pages/HumanResource/HumanResource'
import Attendance from '../pages/Attendance/Attendance'
import Academics from '../pages/Academics/Academics'
import ComingSoon from '../pages/modules/ComingSoon'
import NotFound from '../pages/NotFound'
import { COMING_SOON_MODULES } from '../config/nav'

/* ═══════════════════════════════════════════════════════════════════
   Routes. /login is public. Everything else is wrapped in the protected
   AdminLayout (sidebar + topbar). Add real module screens by swapping a
   ComingSoon route for the built component.
   ═══════════════════════════════════════════════════════════════════ */
/* Har navigation par mojooda path sessionStorage me likh deta hai, taake
   reload ya ERP se wapsi par wahi screen khule. Router ke andar hona zaroori
   hai — useLocation isi ke baghair kaam nahi karta. */
function LastPathTracker() {
  const { pathname } = useLocation()
  useEffect(() => { saveLastPath(pathname) }, [pathname])
  return null
}

/* /login ab is app me nahi khulta — ERP par bhej deta hai. */
function RedirectToErp() {
  useEffect(() => { window.location.replace(ERP_LOGIN_URL) }, [])
  return <div className="app-loading">Redirecting…</div>
}

export default function AppRoutes() {
  return (
    <>
    <LastPathTracker />
    <Routes>
      {/* Is portal ka apna login form use nahi hota — session ERP ke Network
          Head Office login se aata hai. /login par aane wale ko (bookmark,
          purana link) seedha ERP par bhej dete hain. Login component abhi
          codebase me hai taake baad me chahiye to wapas laga sakein. */}
      <Route path="/login" element={<RedirectToErp />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        {/* Root par aane wale ko wahin bhejo jahan wo aakhri baar tha. */}
        <Route index element={<Navigate to={readLastPath() || '/dashboard'} replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/school-permissions" element={<SchoolPermissions />} />
        <Route path="/school-progress" element={<SchoolStatus />} />
        <Route path="/school-payments" element={<Payments />} />
        <Route path="/sops" element={<SOPs />} />
        <Route path="/trainings" element={<TeacherTrainings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/user-permissions" element={<UserPermissions />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/hr" element={<HumanResource />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/academics" element={<Academics />} />

        {/* Placeholder modules (built in later steps) */}
        {COMING_SOON_MODULES.filter((m) => !['/school-permissions', '/school-progress', '/school-payments', '/sops', '/trainings', '/notifications', '/user-permissions', '/accounts', '/inventory', '/hr', '/attendance', '/academics'].includes(m.path)).map((m) => (
          <Route key={m.path} path={m.path} element={<ComingSoon {...m} />} />
        ))}
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  )
}
