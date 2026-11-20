import { useState, useEffect } from 'react'
import { fetchDashboard, fetchVisits, fetchContracts, confirmVisit } from '../api.js'
import LoadError from '../components/LoadError.jsx'

function formatRs(n) {
  if (!n && n !== 0) return '—'
  return 'Rs ' + Number(n).toLocaleString('en-IN')
}

function today() {
  return new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD (UTC would be yesterday before 05:30 IST)
}

export default function TodayScreen({ showToast, onNavigate }) {
  const [stats, setStats] = useState(null)
  const [visits, setVisits] = useState([])
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [activeList, setActiveList] = useState(null) // 'visits'|'renewals'

  async function loadData() {
    setLoading(true)
    setLoadError(null)
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
      setLoadError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleConfirmVisit(visitId) {
    if (confirmingId) return
    setConfirmingId(visitId)
    try {
      await confirmVisit(visitId, { confirmed_by: 'owner' })
      showToast('Visit confirmed ✓')
      await loadData()
    } catch (e) {
      showToast('Error confirming visit: ' + e.message)
    } finally {
      setConfirmingId(null)
    }
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Loading dashboard…</p>
    </div>
  )

  if (loadError) return <LoadError message={loadError} onRetry={loadData} />

  // Needs-review items: flagged contracts + visits pending confirmation
  const needsReview = contracts.filter(c => c.needs_review?.length > 0 && c.status === 'pending_review')
  const pendingVisits = visits.filter(v => v.status === 'pending_confirmation')
  const totalReviewItems = needsReview.length + pendingVisits.length

  const todayStr = today()
  const in30 = new Date(); in30.setDate(in30.getDate() + 30)
  const in30Str = in30.toLocaleDateString('en-CA')
  const renewalContracts = contracts.filter(c => c.renewal_reminder_date && c.renewal_reminder_date >= todayStr && c.renewal_reminder_date <= in30Str)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ marginBottom: 4 }}>Good {greeting()}</h2>
        <p style={{ color: 'var(--gray-500)', fontSize: '.85rem' }}>{formatDate(new Date())}</p>
      </div>

      {/* Needs review strip */}
      {totalReviewItems > 0 && (
        <div className="review-strip">
          <h3>⚠️ Needs your review ({totalReviewItems})</h3>
          <ul>
            {needsReview.flatMap(c =>
              (c.needs_review || []).map((note, i) => (
                <li key={c.id + i}><strong>{c.client_name}:</strong> {note}</li>
              ))
            )}
            {pendingVisits.map(v => (
              <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' }}>
                <span><strong>{v.client_name}:</strong> Visit update awaiting confirmation</span>
                <button
                  className="btn btn-success btn-sm"
                  style={{ padding: '2px 8px', fontSize: '.75rem' }}
                  disabled={confirmingId === v.id} onClick={() => handleConfirmVisit(v.id)}
                >
                  ✓ Confirm
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard
          tone="primary"
          value={stats?.visits_today ?? 0}
          label="Visits today"
          detail={pendingVisits.length ? `${pendingVisits.length} awaiting confirmation` : null}
          pressed={activeList === 'visits'}
          onClick={() => setActiveList(activeList === 'visits' ? null : 'visits')}
        />
        <StatCard
          tone="warning"
          money
          value={formatRs(stats?.unbilled_extras_total ?? 0)}
          label="Unbilled extras"
          detail={[
            plural(stats?.unbilled_extras ?? 0, 'bill line'),
            stats?.unbilled_extras_unpriced ? `${stats.unbilled_extras_unpriced} need a price` : null,
          ].filter(Boolean).join(' · ')}
          onClick={() => onNavigate?.('bills')}
        />
        <StatCard
          tone="danger"
          money
          value={formatRs(stats?.overdue_total ?? 0)}
          label="Overdue payments"
          detail={plural(stats?.overdue_count ?? 0, 'invoice')}
          onClick={() => onNavigate?.('bills')}
        />
        <StatCard
          tone="success"
          money
          value={formatRs(stats?.renewals_value_total ?? 0)}
          label="Renewals in 30 days"
          detail={[
            plural(stats?.renewals_next_30 ?? 0, 'contract'),
            stats?.renewals_unvalued ? `${stats.renewals_unvalued} without value` : null,
          ].filter(Boolean).join(' · ')}
          pressed={activeList === 'renewals'}
          onClick={() => setActiveList(activeList === 'renewals' ? null : 'renewals')}
        />
      </div>
      <p className="stat-footnote">Amounts are before GST.</p>

      {/* Expandable lists */}
      {activeList === 'visits' && (
        <div>
          <div className="section-header"><h2>Today's Visits</h2></div>
          {visits.length === 0 ? (
            <div className="empty-state"><p>No visits scheduled for today.</p></div>
          ) : visits.map(v => (
            <div key={v.id} className={`visit-card ${v.status}`}>
              <div className="card-row">
                <div style={{ flex: 1 }}>
                  <div className="card-title">{v.client_name}</div>
                  <div className="card-sub">{v.site_address?.split(',')[0]}</div>
                  <div className="card-sub" style={{ marginTop: 2 }}>
                    {v.units?.map(u => `${u.quantity}× ${u.type}`).join(', ')}
                  </div>
                </div>
                <StatusChip status={v.status} />
              </div>
              {v.status === 'pending_confirmation' && v.pending_update && (
                <div style={{ marginTop: 8, background: 'var(--accent-light)', padding: 8, borderRadius: 6 }}>
                  <p style={{ fontSize: '.8rem', color: '#92400e', marginBottom: 6 }}>
                    <strong>Tech update:</strong> {v.pending_update.summary_english || 'No summary'}
                  </p>
                  <button className="btn btn-success btn-sm" disabled={confirmingId === v.id} onClick={() => handleConfirmVisit(v.id)}>
                    ✓ Confirm Visit as Done
                  </button>
                </div>
              )}
              {v.job_summary && v.status === 'done' && (
                <div style={{ marginTop: 6, fontSize: '.8rem', color: 'var(--gray-600)' }}>
                  ✓ {v.job_summary}
                </div>
              )}
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
                <div style={{ flex: 1 }}>
                  <div className="card-title">{v.client_name}</div>
                  <div className="card-sub">{v.units?.map(u => `${u.quantity}× ${u.type}`).join(', ')}</div>
                </div>
                <StatusChip status={v.status} />
              </div>
              {v.status === 'pending_confirmation' && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '.75rem', color: '#92400e' }}>Update awaiting confirmation</span>
                  <button className="btn btn-success btn-sm" style={{ padding: '2px 8px', fontSize: '.75rem' }} disabled={confirmingId === v.id} onClick={() => handleConfirmVisit(v.id)}>
                    ✓ Confirm
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// A dashboard card is a real button: reachable by keyboard and announced by screen readers.
function StatCard({ tone, value, label, detail, money, pressed, onClick }) {
  return (
    <button
      type="button"
      className={`stat-card ${tone}`}
      onClick={onClick}
      aria-pressed={pressed === undefined ? undefined : pressed}
      aria-label={`${label}: ${value}${detail ? ', ' + detail : ''}`}
    >
      <div className={`stat-value${money ? ' money' : ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </button>
  )
}

function StatusChip({ status }) {
  const map = {
    done: ['chip chip-green', '✓ Done'],
    scheduled: ['chip chip-blue', '⏳ Scheduled'],
    pending_confirmation: ['chip chip-amber', '⏳ Pending Review'],
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
