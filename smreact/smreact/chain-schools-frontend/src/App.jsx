import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ViewProvider } from './config/viewContext'
import AppRoutes from './routes/AppRoutes'
import GlobalTooltip from './components/GlobalTooltip'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/globals.css'

/* App shell: router + auth + view-switcher context wrap every route.
   Individual modules are mounted inside <AppRoutes />. The top-level
   ErrorBoundary is the last-resort net; each routed page also has its own
   boundary (in AdminLayout) so one broken screen never takes down the app. */
export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <ViewProvider>
            <AppRoutes />
            <GlobalTooltip />
          </ViewProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
