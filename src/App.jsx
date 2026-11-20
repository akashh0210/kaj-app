import { useState, useRef } from 'react'
import TodayScreen from './pages/TodayScreen.jsx'
import ContractsScreen from './pages/ContractsScreen.jsx'
import BillsScreen from './pages/BillsScreen.jsx'
import DigestScreen from './pages/DigestScreen.jsx'
import TechnicianScreen from './pages/TechnicianScreen.jsx'

const NAV_OWNER = [
  { id: 'today', label: 'Today', icon: HomeIcon },
  { id: 'contracts', label: 'Contracts', icon: FileIcon },
  { id: 'bills', label: 'Bills', icon: BillIcon },
  { id: 'digest', label: 'Digest', icon: DigestIcon },
]

function HomeIcon() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function FileIcon() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function BillIcon() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
}
function DigestIcon() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function WrenchIcon() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
}

export default function App() {
  const [role, setRole] = useState('owner') // 'owner' | 'technician'
  const [activeTab, setActiveTab] = useState('today')
  const [toast, setToast] = useState(null)

  const toastTimer = useRef(null)
  function showToast(msg, duration = 2500) {
    setToast(msg)
    clearTimeout(toastTimer.current) // a newer toast must not be cleared by an older timer
    toastTimer.current = setTimeout(() => setToast(null), duration)
  }

  function toggleRole() {
    setRole(r => r === 'owner' ? 'technician' : 'owner')
    setActiveTab('today')
  }

  const sharedProps = { showToast, onNavigate: setActiveTab }

  return (
    <div className="page">
      {/* App Bar */}
      <header className="app-bar">
        <h1><span aria-hidden="true">⚙️ </span>KAJ</h1>
        <button type="button" className="role-toggle" onClick={toggleRole}
          aria-label={role === 'owner' ? 'Viewing as owner. Switch to technician view' : 'Viewing as technician. Switch to owner view'}>
          <span aria-hidden="true">{role === 'owner' ? '👤 ' : '🔧 '}</span>{role === 'owner' ? 'Owner' : 'Technician'}
          <span style={{ fontSize: '.7rem', opacity: .8 }} aria-hidden="true">↕</span>
        </button>
      </header>

      {/* Main content */}
      <main className="content">
        {role === 'owner' ? (
          <>
            {activeTab === 'today' && <TodayScreen {...sharedProps} />}
            {activeTab === 'contracts' && <ContractsScreen {...sharedProps} />}
            {activeTab === 'bills' && <BillsScreen {...sharedProps} />}
            {activeTab === 'digest' && <DigestScreen {...sharedProps} />}
          </>
        ) : (
          <TechnicianScreen {...sharedProps} />
        )}
      </main>

      {/* Bottom nav (owner only) */}
      {role === 'owner' && (
        <nav className="bottom-nav" aria-label="Main">
          {NAV_OWNER.map(item => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${activeTab === item.id ? ' active' : ''}`}
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
