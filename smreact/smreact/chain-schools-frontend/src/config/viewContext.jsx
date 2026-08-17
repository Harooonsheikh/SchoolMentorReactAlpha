import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchConnectedSchools } from '../api/networkSchoolsApi'

/* ═══════════════════════════════════════════════════════════════════
   Head Office / School view switcher.

   The app runs in Head Office (Chain Admin) mode by default with full
   access. The user can switch into any connected school in VIEW ONLY
   mode — every module/screen stays browsable, but all add/edit/delete/
   save/update actions are locked until they switch back.

     currentView    'headOffice' | 'school'
     selectedSchool  null | school object
     isViewOnly      true while a school is selected

   Connected schools ab Chain-Management API se aate hain (accepted rows) —
   pehle yahan 10 static demo schools ki list thi.
   ═══════════════════════════════════════════════════════════════════ */

const KEY = 'chain-active-view'
const ViewContext = createContext(null)

export function ViewProvider({ children }) {
  const [selectedSchool, setSelectedSchool] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); return d?.id ? d : null } catch { return null }
  })

  /* Network me shamil ho chuke schools. */
  const [schools, setSchools] = useState([])
  const [schoolsLoading, setSchoolsLoading] = useState(true)
  const [schoolsError, setSchoolsError] = useState('')

  const reloadSchools = useCallback(async () => {
    setSchoolsLoading(true)
    setSchoolsError('')
    try {
      /* `id` branchID rakhte hain — school ka data isi id se aata hai. */
      const rows = await fetchConnectedSchools()
      setSchools(rows.map((s) => ({ ...s, rowId: s.id, id: s.branchId })))
    } catch (err) {
      console.error('Connected schools load failed:', err)
      setSchools([])
      setSchoolsError(err?.message || 'Could not load connected schools')
    } finally {
      setSchoolsLoading(false)
    }
  }, [])

  useEffect(() => { reloadSchools() }, [reloadSchools])

  useEffect(() => {
    if (selectedSchool) localStorage.setItem(KEY, JSON.stringify(selectedSchool))
    else localStorage.removeItem(KEY)
  }, [selectedSchool])

  const value = useMemo(() => ({
    schools,
    schoolsLoading,
    schoolsError,
    reloadSchools,
    selectedSchool,
    currentView: selectedSchool ? 'school' : 'headOffice',
    isViewOnly: !!selectedSchool,
    switchToSchool: (school) => setSelectedSchool(school),
    backToHeadOffice: () => setSelectedSchool(null),
  }), [schools, schoolsLoading, schoolsError, reloadSchools, selectedSchool])

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useView() {
  const ctx = useContext(ViewContext)
  if (!ctx) throw new Error('useView must be used within ViewProvider')
  return ctx
}
