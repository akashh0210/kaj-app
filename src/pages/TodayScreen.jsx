import { useState, useEffect } from 'react'
import { fetchDashboard, fetchVisits, fetchContracts, confirmVisit } from '../api.js'
import { Check, ChevronRight, TriangleAlert } from 'lucide-react'
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
      showToast('Visit confirmed')
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
      <h2 className="page-title">Good {greeting()}</h2>
      <p className="page-sub">{formatDate(new Date())}</p>

      {/* Needs review slip */}
      {totalReviewItems > 0 && (
        <section className="review-strip" aria-label={`Needs your review, ${totalReviewItems}`}>
          <h3><TriangleAlert size={16} aria-hidden="true" />Needs your review ({totalReviewItems})</h3>
          <ul>
            {needsReview.flatMap(c =>
              (c.needs_review || []).map((note, i) => (
                <li key={c.id + i}><span><strong>{c.client_name}:</strong> {note}</span></li>
              ))
            )}
            {pendingVisits.map(v => (
              <li key={v.id} style={{ justifyContent: 'space-between' }}>
                <span><strong>{v.client_name}:</strong> visit update awaiting confirmation</span>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={confirmingId === v.id} onClick={() => handleConfirmVisit(v.id)}
                >
                  <Check size={16} aria-hidden="true" />Confirm
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ledger: label left, amount right */}
      <ul className="ledger" aria-label="Today's numbers">
        <LedgerRow
          value={stats?.visits_today ?? 0}
          label="Visits today"
          detail={pendingVisits.length ? `${pendingVisits.length} awaiting confirmation` : null}
          pressed={activeList === 'visits'}
          onClick={() => setActiveList(activeList === 'visits' ? null : 'visits')}
        />
        <LedgerRow
          value={formatRs(stats?.unbilled_extras_total ?? 0)}
          label="Unbilled extras"
          detail={[
            plural(stats?.unbilled_extras ?? 0, 'bill line'),
            stats?.unbilled_extras_unpriced ? `${stats.unbilled_extras_unpriced} need a price` : null,
          ].filter(Boolean).join(' · ')}
          onClick={() => onNavigate?.('bills')}
        />
        <LedgerRow
          overdue
          value={formatRs(stats?.overdue_total ?? 0)}
          label="Overdue payments"
          detail={plural(stats?.overdue_count ?? 0, 'invoice')}
          onClick={() => onNavigate?.('bills')}
        />
        <LedgerRow
          value={formatRs(stats?.renewals_value_total ?? 0)}
          label="Renewals in 30 days"
          detail={[
            plural(stats?.renewals_next_30 ?? 0, 'contract'),
            stats?.renewals_unvalued ? `${stats.renewals_unvalued} without value` : null,
          ].filter(Boolean).join(' · ')}
          pressed={activeList === 'renewals'}
          onClick={() => setActiveList(activeList === 'renewals' ? null : 'renewals')}
        />
      </ul>
      <p className="footnote">Amounts are before GST.</p>

      {/* Expandable lists */}
      {activeList === 'visits' && (
        <div>
          <div className="section-header"><h2>Today's visits</h2></div>
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
                <div className="tech-note">
                  <p style={{ marginBottom: 8, color: 'var(--text)' }}>
                    <strong>Technician update:</strong> {v.pending_update.summary_english || 'No summary'}
                  </p>
                  <button className="btn btn-primary btn-sm" disabled={confirmingId === v.id} onClick={() => handleConfirmVisit(v.id)}>
                    <Check size={16} aria-hidden="true" />Confirm visit as done
                  </button>
                </div>
              )}
              {v.job_summary && v.status === 'done' && (
                <div className="tech-note">{v.job_summary}</div>
              )}
              <div className="source-tag">Technician: {v.technician}</div>
            </div>
          ))}
        </div>
      )}

      {activeList === 'renewals' && (
        <div>
          <div className="section-header"><h2>Renewals in 30 days</h2></div>
          {renewalContracts.length === 0 ? (
            <div className="empty-state"><p>No renewals due soon.</p></div>
          ) : renewalContracts.map(c => (
            <div key={c.id} className="card">
              <div className="card-row">
                <div>
                  <div className="card-title">{c.client_name}</div>
                  <div className="card-sub">{c.contract_no}</div>
                </div>
                <div className="card-amount">{formatRs(c.contract_value)}</div>
              </div>
              <div style={{ marginTop: 8 }}>
                <span className="pill pill-quiet">Renew by {c.renewal_reminder_date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick visit list always shown if no expanded list */}
      {!activeList && visits.length > 0 && (
        <div>
          <div className="section-header">
            <h2>Today's visits</h2>
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
                <div className="tech-note" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span>Update awaiting confirmation</span>
                  <button className="btn btn-primary btn-sm" disabled={confirmingId === v.id} onClick={() => handleConfirmVisit(v.id)}>
                    <Check size={16} aria-hidden="true" />Confirm
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

// A ledger row is a real button: reachable by keyboard and announced by screen readers.
function LedgerRow({ value, label, detail, overdue, pressed, onClick }) {
  return (
    <li>
      <button
        type="button"
        className="ledger-row"
        onClick={onClick}
        aria-pressed={pressed === undefined ? undefined : pressed}
        aria-label={`${label}: ${value}${detail ? ', ' + detail : ''}`}
      >
        <span>
          <span className="ledger-label">{label}</span>
          {detail && <span className="ledger-detail">{detail}</span>}
        </span>
        <span className={`ledger-amount money${overdue ? ' overdue' : ''}`}>{value}</span>
        <ChevronRight size={18} className="chev" aria-hidden="true" />
      </button>
    </li>
  )
}

function StatusChip({ status }) {
  const map = {
    done: ['pill pill-quiet', 'Done'],
    scheduled: ['pill pill-blue', 'Scheduled'],
    pending_confirmation: ['pill pill-amber', 'Pending review'],
    missed: ['pill pill-amber', 'Missed'],
    pending_review: ['pill pill-amber', 'Review'],
    confirmed: ['pill pill-blue', 'Confirmed'],
    overdue: ['pill pill-red', 'Overdue'],
    pending: ['pill pill-blue', 'Pending'],
    paid: ['pill pill-blue', 'Paid'],
  }
  const [cls, label] = map[status] || ['pill pill-quiet', status]
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
