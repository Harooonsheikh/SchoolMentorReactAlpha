import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles/responsive.css' // loaded last so the mobile layer refines every module

/* Apply the persisted theme before first paint so dark mode covers the whole
   app (including the Login screen, which renders outside the admin layout). */
document.documentElement.setAttribute('data-theme', localStorage.getItem('chain-theme') === 'dark' ? 'dark' : 'light')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
