import { useState, useEffect } from 'react'
import { fetchDigest } from '../api.js'
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
      <h2 style={{ marginBottom: 4 }}>Daily Digest</h2>
      <p style={{ color: 'var(--gray-500)', fontSize: '.85rem', marginBottom: 16 }}>{today}</p>

      {digest && (
        <>
          <div className="stat-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card success">
              <div className="stat-value">{digest.visits_done ?? 0}</div>
              <div className="stat-label">Visits done</div>
            </div>
            <div className="stat-card danger">
              <div className="stat-value">{digest.visits_missed ?? 0}</div>
              <div className="stat-label">Visits pending</div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="card-sub">Overdue payments</span>
              <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                Rs {Number(digest.overdue_amount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            {digest.renewals?.length > 0 && (
              <div>
                <span className="card-sub">Renewals due soon:</span>
                <div style={{ marginTop: 4 }}>
                  {digest.renewals.map((r, i) => <span key={i} className="badge badge-warning" style={{ marginRight: 4 }}>{r}</span>)}
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ background: 'var(--gray-50)' }}>
            <label className="label" style={{ marginBottom: 8 }}>Message preview</label>
            <pre style={{ fontFamily: 'inherit', fontSize: '.85rem', whiteSpace: 'pre-wrap', color: 'var(--gray-700)', lineHeight: 1.6 }}>
              {digest.digest}
            </pre>
          </div>

          <button className="btn btn-success btn-full" style={{ marginTop: 8 }} disabled={!digest.digest} onClick={handleWhatsApp}>
            📱 Share Digest on WhatsApp
          </button>
          <p style={{ fontSize: '.72rem', color: 'var(--gray-400)', textAlign: 'center', marginTop: 6 }}>
            Opens in your own WhatsApp to send to yourself
          </p>
        </>
      )}
    </div>
  )
}
