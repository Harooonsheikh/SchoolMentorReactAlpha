import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/* ═══════════════════════════════════════════════════════════════════
   Head Office / School view switcher.

   The app runs in Head Office (Chain Admin) mode by default with full
   access. The user can switch into any connected school in VIEW ONLY
   mode — every module/screen stays browsable, but all add/edit/delete/
   save/update actions are locked until they switch back.

     currentView    'headOffice' | 'school'
     selectedSchool  null | school object
     isViewOnly      true while a school is selected

   Static demo data for now — ready for backend/API integration later.
   ═══════════════════════════════════════════════════════════════════ */
export const CONNECTED_SCHOOLS = [
  { id: 1, name: 'Allied Grammar School', city: 'Lahore', status: 'Connected' },
  { id: 2, name: 'City Scholars School', city: 'Karachi', status: 'Connected' },
  { id: 3, name: 'Green Valley School', city: 'Islamabad', status: 'Connected' },
  { id: 4, name: 'The Knowledge Campus', city: 'Faisalabad', status: 'Connected' },
  { id: 5, name: 'Future Stars School', city: 'Rawalpindi', status: 'Connected' },
  { id: 6, name: 'Bright Learners Academy', city: 'Multan', status: 'Connected' },
  { id: 7, name: 'Iqra Model School', city: 'Peshawar', status: 'Connected' },
  { id: 8, name: 'Smart Kids School', city: 'Sialkot', status: 'Connected' },
  { id: 9, name: 'National Grammar School', city: 'Gujranwala', status: 'Connected' },
  { id: 10, name: 'Rising Star School', city: 'Hyderabad', status: 'Connected' },
]

const KEY = 'chain-active-view'
const ViewContext = createContext(null)

export function ViewProvider({ children }) {
  const [selectedSchool, setSelectedSchool] = useState(() => {
    try { const d = JSON.parse(localStorage.getItem(KEY)); return d?.id ? d : null } catch { return null }
  })

  useEffect(() => {
    if (selectedSchool) localStorage.setItem(KEY, JSON.stringify(selectedSchool))
    else localStorage.removeItem(KEY)
  }, [selectedSchool])

  const value = useMemo(() => ({
    schools: CONNECTED_SCHOOLS,
    selectedSchool,
    currentView: selectedSchool ? 'school' : 'headOffice',
    isViewOnly: !!selectedSchool,
    switchToSchool: (school) => setSelectedSchool(school),
    backToHeadOffice: () => setSelectedSchool(null),
  }), [selectedSchool])

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useView() {
  const ctx = useContext(ViewContext)
  if (!ctx) throw new Error('useView must be used within ViewProvider')
  return ctx
}
