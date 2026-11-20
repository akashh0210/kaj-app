import { useState, useEffect } from 'react'
import { fetchDigest } from '../api.js'
import { Share2 } from 'lucide-react'
import LoadError from '../components/LoadError.jsx'

export default function DigestScreen({ showToast }) {
  const [digest, setDigest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try { setDigest(await fetchDigest()) } catch (e) { setLoadError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function handleWhatsApp() {
    if (!digest?.digest) return
    const encoded = encodeURIComponent(digest.digest)
    window.open(`https://wa.me/?text=${encoded}`, '_blank')
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><p>Loading digest…</p></div>
  if (loadError) return <LoadError message={loadError} onRetry={load} />

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <h2 className="page-title">Daily digest</h2>
      <p className="page-sub">{today}</p>

      {digest && (
        <>
          <ul className="ledger" aria-label="Today's digest">
            <li className="ledger-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="ledger-label">Visits done</span>
              <span className="ledger-amount money">{digest.visits_done ?? 0}</span>
            </li>
            <li className="ledger-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="ledger-label">Visits pending</span>
              <span className="ledger-amount money">{digest.visits_missed ?? 0}</span>
            </li>
            <li className="ledger-row" style={{ gridTemplateColumns: '1fr auto' }}>
              <span className="ledger-label">Overdue payments</span>
              <span className="ledger-amount money overdue">Rs {Number(digest.overdue_amount || 0).toLocaleString('en-IN')}</span>
            </li>
            {digest.renewals?.length > 0 && (
              <li className="ledger-row" style={{ gridTemplateColumns: '1fr', minHeight: 0 }}>
                <span>
                  <span className="ledger-label">Renewals due soon</span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {digest.renewals.map((r, i) => <span key={i} className="pill pill-quiet">{r}</span>)}
                  </span>
                </span>
              </li>
            )}
          </ul>

          <div className="card" style={{ marginTop: 16 }}>
            <p className="label">Message preview</p>
            <pre style={{ fontFamily: 'inherit', fontSize: '.9rem', whiteSpace: 'pre-wrap', color: 'var(--text)', lineHeight: 1.6 }}>
              {digest.digest}
            </pre>
          </div>

          <button className="btn btn-primary btn-full" disabled={!digest.digest} onClick={handleWhatsApp}>
            <Share2 size={18} aria-hidden="true" />Share digest on WhatsApp
          </button>
          <p style={{ fontSize: '.8rem', color: 'var(--text-2)', textAlign: 'center', marginTop: 8 }}>
            Opens in your own WhatsApp to send to yourself
          </p>
        </>
      )}
    </div>
  )
}
