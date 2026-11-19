import { useState, useEffect, useRef } from 'react'
import { fetchVisits, submitVoiceUpdate, submitVisitUpdate } from '../api.js'

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function TechnicianScreen({ showToast }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeVisit, setActiveVisit] = useState(null)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [audioChunks, setAudioChunks] = useState([])
  const [extracted, setExtracted] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const chunksRef = useRef([])

  async function load() {
    setLoading(true)
    try { setVisits(await fetchVisits(today())) } catch (e) { showToast('Error: ' + e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await processAudio(blob)
      }
      mr.start()
      setMediaRecorder(mr)
      setRecording(true)
    } catch (e) {
      showToast('Microphone access denied: ' + e.message)
    }
  }

  function stopRecording() {
    if (mediaRecorder && recording) {
      mediaRecorder.stop()
      setRecording(false)
      setProcessing(true)
    }
  }

  async function processAudio(blob) {
    try {
      const { extracted: data } = await submitVoiceUpdate(activeVisit.id, blob)
      setExtracted(data)
    } catch (e) {
      showToast('Processing failed: ' + e.message)
    } finally {
      setProcessing(false)
    }
  }

  function handleReRecord() {
    setExtracted(null)
    setProcessing(false)
  }

  async function handleConfirm() {
    if (!extracted || !activeVisit) return
    setConfirming(true)
    try {
      await submitVisitUpdate(activeVisit.id, {
        summary_english: extracted.summary_english,
        units_serviced: extracted.units_serviced,
        units_pending: extracted.units_pending,
        extra_work: extracted.extra_work,
        source_ref: extracted.source_ref,
        submitted_by: 'technician',
      })
      showToast('Update submitted for owner review ✓')
      setActiveVisit(null)
      setExtracted(null)
      await load()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setConfirming(false)
    }
  }

  // ── Visit list ─────────────────────────────────────────────────────────────
  if (!activeVisit) return (
    <div>
      <h2 style={{ marginBottom: 4 }}>Today's Visits</h2>
      <p style={{ color: 'var(--gray-500)', fontSize: '.85rem', marginBottom: 16 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {loading ? <div className="spinner" /> : (
        visits.length === 0
          ? <div className="empty-state"><p>No visits today.</p></div>
          : visits.map(v => (
            <div
              key={v.id}
              className={`visit-card ${v.status}`}
              style={{ cursor: v.status === 'scheduled' ? 'pointer' : 'default' }}
              onClick={() => v.status === 'scheduled' && setActiveVisit(v)}
            >
              <div className="card-row">
                <div>
                  <div className="card-title">{v.client_name}</div>
                  <div className="card-sub">{v.site_address?.split(',')[0]}</div>
                  <div className="card-sub" style={{ marginTop: 2 }}>
                    {v.units?.map(u => `${u.quantity}× ${u.type}`).join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <StatusChip status={v.status} />
                  {v.status === 'scheduled' && (
                    <span style={{ fontSize: '.75rem', color: 'var(--primary)', fontWeight: 600 }}>Tap →</span>
                  )}
                </div>
              </div>
              {v.job_summary && (
                <div style={{ marginTop: 8, fontSize: '.8rem', color: 'var(--gray-600)', background: 'var(--gray-50)', borderRadius: 6, padding: '6px 8px' }}>
                  {v.job_summary}
                </div>
              )}
            </div>
          ))
      )}
    </div>
  )

  // ── Active visit – recording ───────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={() => { setActiveVisit(null); setExtracted(null) }}>← Back</button>
        <div>
          <div className="card-title">{activeVisit.client_name}</div>
          <div className="card-sub">{activeVisit.site_address?.split(',')[0]}</div>
        </div>
      </div>

      {!processing && !extracted && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, gap: 24 }}>
          <p style={{ color: 'var(--gray-500)', fontSize: '.9rem', textAlign: 'center' }}>
            {recording ? 'Recording… tap again to stop' : 'Tap the mic button to record your update'}
          </p>

          <button
            className={`mic-btn${recording ? ' recording' : ''}`}
            onClick={recording ? stopRecording : startRecording}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>

          {recording && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--danger)', fontSize: '.85rem', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse 1s infinite' }} />
              Recording…
            </div>
          )}

          <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => document.getElementById('photoInput')?.click()}>
            📷 Add Photo
          </button>
          <input id="photoInput" type="file" accept="image/*" capture="environment" style={{ display: 'none' }} />
        </div>
      )}

      {processing && (
        <div className="loading-screen">
          <div className="spinner" />
          <p>Processing voice note with AI…</p>
        </div>
      )}

      {extracted && !processing && (
        <div>
          {extracted.needs_review?.length > 0 && (
            <div className="review-strip">
              <h3>⚠️ Needs review</h3>
              <ul>
                {extracted.needs_review.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Job Summary</h3>
            <p style={{ fontSize: '.9rem', color: 'var(--gray-700)', lineHeight: 1.6 }}>
              {extracted.summary_english || '(No summary extracted)'}
            </p>
            {extracted.units_serviced?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <label className="label">Units serviced</label>
                {extracted.units_serviced.map((u, i) => (
                  <span key={i} className="chip chip-green" style={{ marginRight: 4 }}>{u.quantity} {u.type}</span>
                ))}
              </div>
            )}
            {extracted.units_pending?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <label className="label">Units pending</label>
                {extracted.units_pending.map((u, i) => (
                  <span key={i} className="chip chip-amber" style={{ marginRight: 4 }}>{u.quantity} {u.type}</span>
                ))}
              </div>
            )}
            {extracted.extra_work?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <label className="label">Extra work (draft bill)</label>
                {extracted.extra_work.map((e, i) => (
                  <span key={i} className="chip chip-blue" style={{ marginRight: 4 }}>{e.quantity} × {e.item}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleReRecord}>
              🔁 Re-record
            </button>
            <button className="btn btn-success" style={{ flex: 2 }} disabled={confirming} onClick={handleConfirm}>
              {confirming ? 'Confirming…' : '✓ Confirm'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  )
}

function StatusChip({ status }) {
  const map = {
    done: ['chip chip-green', '✓ Done'],
    scheduled: ['chip chip-blue', '⏳ Scheduled'],
    pending_confirmation: ['chip chip-amber', '⏳ Pending Review'],
    missed: ['chip chip-red', '✗ Missed'],
  }
  const [cls, label] = map[status] || ['chip chip-gray', status]
  return <span className={cls}>{label}</span>
}
