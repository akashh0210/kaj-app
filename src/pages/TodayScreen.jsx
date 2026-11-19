import { useState, useEffect } from 'react'
import { fetchDashboard, fetchVisits, fetchContracts } from '../api.js'

function formatRs(n) {
  if (!n && n !== 0) return '—'
  return 'Rs ' + Number(n).toLocaleString('en-IN')
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function TodayScreen({ showToast }) {
  const [stats, setStats] = useState(null)
  const [visits, setVisits] = useState([])
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeList, setActiveList] = useState(null) // 'visits'|'payments'|'renewals'

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dash, vis, conts] = await Promise.all([
          fetchDashboard(),
          fetchVisits(today()),
          fetchContracts(),
        ])
        setStats(dash)
        setVisits(vis)
        setContracts(conts)
      } catch (e) {
        showToast('Error loading dashboard: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading dashboard…</p>
    </div>
  )

  // Needs-review items
  const needsReview = contracts.filter(c => c.needs_review?.length > 0 && c.status === 'pending_review')
  const todayStr = today()
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)
  const in30Str = in30.toISOString().split('T')[0]
  const renewalContracts = contracts.filter(c => c.renewal_reminder_date && c.renewal_reminder_date >= todayStr && c.renewal_reminder_date <= in30Str)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 4 }}>Good {greeting()}</h2>
        <p style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>{formatDate(new Date())}</p>
      </div>

      {/* Needs review strip */}
      {needsReview.length > 0 && (
        <div className="review-strip">
          <h3>⚠️ Needs your review ({needsReview.length})</h3>
          <ul>
            {needsReview.flatMap(c =>
              (c.needs_review || []).map((note, i) => (
                <li key={c.id + i}><strong>{c.client_name}:</strong> {note}</li>
              ))
            )}
          </ul>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card primary" onClick={() => setActiveList(activeList === 'visits' ? null : 'visits')}>
          <div className="stat-value">{stats?.visits_today ?? 0}</div>
          <div className="stat-label">Visits today</div>
        </div>
        <div className="stat-card warning" onClick={() => setActiveList(activeList === 'extras' ? null : 'extras')}>
          <div className="stat-value">{stats?.unbilled_extras ?? 0}</div>
          <div className="stat-label">Unbilled extras</div>
        </div>
        <div className="stat-card danger" onClick={() => setActiveList(activeList === 'payments' ? null : 'payments')}>
          <div className="stat-value">{formatRs(stats?.overdue_total)}</div>
          <div className="stat-label">Overdue payments</div>
        </div>
        <div className="stat-card success" onClick={() => setActiveList(activeList === 'renewals' ? null : 'renewals')}>
          <div className="stat-value">{stats?.renewals_next_30 ?? 0}</div>
          <div className="stat-label">Renewals in 30 days</div>
        </div>
      </div>

      {/* Expandable lists */}
      {activeList === 'visits' && (
        <div>
          <div className="section-header"><h2>Today's Visits</h2></div>
          {visits.length === 0 ? (
            <div className="empty-state"><p>No visits scheduled for today.</p></div>
          ) : visits.map(v => (
            <div key={v.id} className={`visit-card ${v.status}`}>
              <div className="card-row">
                <div>
                  <div className="card-title">{v.client_name}</div>
                  <div className="card-sub">{v.site_address?.split(',')[0]}</div>
                  <div className="card-sub" style={{ marginTop: 2 }}>
                    {v.units?.map(u => `${u.quantity}× ${u.type}`).join(', ')}
                  </div>
                </div>
                <StatusChip status={v.status} />
              </div>
              <div className="source-tag">Tech: {v.technician}</div>
            </div>
          ))}
        </div>
      )}

      {activeList === 'renewals' && (
        <div>
          <div className="section-header"><h2>Renewals in 30 Days</h2></div>
          {renewalContracts.length === 0 ? (
            <div className="empty-state"><p>No renewals due soon.</p></div>
          ) : renewalContracts.map(c => (
            <div key={c.id} className="card">
              <div className="card-title">{c.client_name}</div>
              <div className="card-sub">{c.contract_no}</div>
              <div style={{ marginTop: 6 }}>
                <span className="badge badge-warning">Renew by {c.renewal_reminder_date}</span>
              </div>
              <div className="source-tag">Contract value: {formatRs(c.contract_value)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick visit list always shown if no expanded list */}
      {!activeList && visits.length > 0 && (
        <div>
          <div className="section-header">
            <h2>Today's Visits</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveList('visits')}>See all</button>
          </div>
          {visits.slice(0, 3).map(v => (
            <div key={v.id} className={`visit-card ${v.status}`}>
              <div className="card-row">
                <div>
                  <div className="card-title">{v.client_name}</div>
                  <div className="card-sub">{v.units?.map(u => `${u.quantity}× ${u.type}`).join(', ')}</div>
                </div>
                <StatusChip status={v.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    done: ['chip chip-green', '✓ Done'],
    scheduled: ['chip chip-blue', '⏳ Scheduled'],
    missed: ['chip chip-red', '✗ Missed'],
    pending_review: ['chip chip-amber', '⚠ Review'],
    confirmed: ['chip chip-green', '✓ Confirmed'],
    overdue: ['chip chip-red', '⚠ Overdue'],
    pending: ['chip chip-blue', '⏳ Pending'],
    paid: ['chip chip-green', '✓ Paid'],
  }
  const [cls, label] = map[status] || ['chip chip-gray', status]
  return <span className={cls}>{label}</span>
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function formatDate(d) {
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
