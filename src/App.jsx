import { useState, useRef } from 'react'
import { Home, FileText, Receipt, Newspaper, UserRound, Wrench, ArrowLeftRight } from 'lucide-react'
import TodayScreen from './pages/TodayScreen.jsx'
import ContractsScreen from './pages/ContractsScreen.jsx'
import BillsScreen from './pages/BillsScreen.jsx'
import DigestScreen from './pages/DigestScreen.jsx'
import TechnicianScreen from './pages/TechnicianScreen.jsx'

const NAV_OWNER = [
  { id: 'today', label: 'Today', icon: Home },
  { id: 'contracts', label: 'Contracts', icon: FileText },
  { id: 'bills', label: 'Bills', icon: Receipt },
  { id: 'digest', label: 'Digest', icon: Newspaper },
]

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
  const RoleIcon = role === 'owner' ? UserRound : Wrench

  return (
    <div className="page">
      {/* App Bar */}
      <header className="app-bar">
        <h1><span className="brand-mark" aria-hidden="true" />KAJ</h1>
        <button type="button" className="role-toggle" onClick={toggleRole}
          aria-label={role === 'owner' ? 'Viewing as owner. Switch to technician view' : 'Viewing as technician. Switch to owner view'}>
          <RoleIcon size={16} aria-hidden="true" />
          {role === 'owner' ? 'Owner' : 'Technician'}
          <ArrowLeftRight size={14} aria-hidden="true" style={{ color: 'var(--text-2)' }} />
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
              <item.icon aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </nav>
      )}

      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
