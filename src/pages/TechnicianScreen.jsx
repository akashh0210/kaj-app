import { useState, useEffect, useRef } from 'react'
import { fetchVisits, submitVoiceUpdate, submitVisitUpdate } from '../api.js'
import LoadError from '../components/LoadError.jsx'
import { STRINGS, loadLang, saveLang } from '../i18n/technician.js'

function today() {
  return new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD (UTC would be yesterday before 05:30 IST)
}

// Safari/iOS cannot record webm; pick the first format this browser supports.
function pickAudioMime() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
    .find(t => MediaRecorder.isTypeSupported(t)) || ''
}

export default function TechnicianScreen({ showToast }) {
  const [visits, setVisits] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [activeVisit, setActiveVisit] = useState(null)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [extracted, setExtracted] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [failedBlob, setFailedBlob] = useState(null) // recording kept after a failed upload
  const chunksRef = useRef([])
  const discardRef = useRef(false) // set when leaving a visit mid-recording
  const photoInputRef = useRef()
  const [lang, setLang] = useState(loadLang)
  const t = STRINGS[lang]

  function toggleLang() {
    const next = lang === 'en' ? 'bn' : 'en'
    setLang(next)
    saveLang(next)
  }

  async function load() {
    setLoading(true)
    setLoadError(null)
    try { setVisits(await fetchVisits(today())) } catch (e) { setLoadError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return showToast(t.noRecorder)
    }
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      return showToast(e.name === 'NotAllowedError'
        ? t.micDenied
        : t.micError + e.message)
    }
    try {
      const mime = pickAudioMime()
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      discardRef.current = false
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (discardRef.current) return
        const blob = new Blob(chunksRef.current, { type: (mr.mimeType || 'audio/webm').split(';')[0] })
        if (blob.size === 0) {
          setProcessing(false)
          return showToast(t.nothingRecorded)
        }
        await processAudio(blob)
      }
      mr.start()
      setMediaRecorder(mr)
      setRecording(true)
    } catch (e) {
      stream.getTracks().forEach(t => t.stop())
      showToast(t.recorderError + e.message)
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
    setProcessing(true)
    setFailedBlob(null)
    try {
      const { extracted: data } = await submitVoiceUpdate(activeVisit.id, blob, photo)
      setExtracted(data)
    } catch (e) {
      showToast(t.processingFailed + e.message, 4000)
      setFailedBlob(blob) // keep the recording so the technician can retry without re-recording
    } finally {
      setProcessing(false)
    }
  }

  function handleReRecord() {
    setExtracted(null)
    setFailedBlob(null)
    setProcessing(false)
  }

  function leaveVisit() {
    if (recording && mediaRecorder) {
      discardRef.current = true
      mediaRecorder.stop()
      setRecording(false)
    }
    setActiveVisit(null)
    setExtracted(null)
    setFailedBlob(null)
    setPhoto(null)
  }

  function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    if (!file.type.startsWith('image/')) return showToast(t.choosePhoto)
    setPhoto(file)
    showToast(t.photoAdded)
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
        needs_review: extracted.needs_review,
        source_ref: extracted.source_ref,
        photo_ref: extracted.photo_ref,
        submitted_by: 'technician',
      })
      showToast(t.submitted)
      leaveVisit()
      await load()
    } catch (e) {
      showToast(t.error + e.message)
    } finally {
      setConfirming(false)
    }
  }

  const langToggle = (
    <button type="button" className="btn btn-outline btn-sm lang-toggle" onClick={toggleLang}
      aria-label={t.switchLabel} lang={lang === 'en' ? 'bn' : 'en'}>
      {t.switchTo}
    </button>
  )

  // ── Visit list ─────────────────────────────────────────────────────────────
  if (!activeVisit) return (
    <div lang={lang}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>{t.todaysVisits}</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '.85rem', marginBottom: 16 }}>
            {new Date().toLocaleDateString(t.dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {langToggle}
      </div>

      {loading ? <div className="spinner" role="status" aria-label="Loading" /> : loadError ? <LoadError message={loadError} onRetry={load} /> : (
        visits.length === 0
          ? <div className="empty-state"><p>{t.noVisits}</p></div>
          : <ul className="plain-list">{visits.map(v => {
            const openable = v.status === 'scheduled'
            const body = (
              <>
                <div className="card-row">
                  <div>
                    <div className="card-title">{v.client_name}</div>
                    <div className="card-sub">{v.site_address?.split(',')[0]}</div>
                    <div className="card-sub" style={{ marginTop: 2 }}>
                      {v.units?.map(u => `${u.quantity}× ${u.type}`).join(', ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <StatusChip status={v.status} t={t} />
                    {openable && (
                      <span style={{ fontSize: '.75rem', color: 'var(--primary)', fontWeight: 600 }} aria-hidden="true">{t.open} →</span>
                    )}
                  </div>
                </div>
                {v.job_summary && (
                  <div lang="en" style={{ marginTop: 8, fontSize: '.8rem', color: 'var(--gray-600)', background: 'var(--gray-50)', borderRadius: 6, padding: '6px 8px' }}>
                    {v.job_summary}
                  </div>
                )}
              </>
            )
            return (
              <li key={v.id}>
                {openable ? (
                  <button type="button" className={`visit-card visit-card-btn ${v.status}`}
                    aria-label={`${t.openVisit(v.client_name)}, ${t.status[v.status] || v.status}`}
                    onClick={() => setActiveVisit(v)}>
                    {body}
                  </button>
                ) : (
                  <div className={`visit-card ${v.status}`}>{body}</div>
                )}
              </li>
            )
          })}</ul>
      )}
    </div>
  )

  // ── Active visit – recording ───────────────────────────────────────────────
  return (
    <div lang={lang}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={leaveVisit}>
          <span aria-hidden="true">← </span>{t.back}
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="card-title" style={{ fontSize: '1rem' }}>{activeVisit.client_name}</h2>
          <div className="card-sub">{activeVisit.site_address?.split(',')[0]}</div>
        </div>
        {langToggle}
      </div>

      {failedBlob && !processing && !extracted && (
        <div className="error-state" role="alert">
          <p>{t.failedSaved}</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => processAudio(failedBlob)}>{t.tryAgain}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleReRecord}>{t.reRecord}</button>
          </div>
        </div>
      )}

      {!processing && !extracted && !failedBlob && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 32, gap: 24 }}>
          <p id="mic-hint" style={{ color: 'var(--gray-600)', fontSize: '.9rem', textAlign: 'center' }}>
            {recording ? t.tapToStop : t.tapToRecord}
          </p>

          <button
            type="button"
            className={`mic-btn${recording ? ' recording' : ''}`}
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? t.stopRecording : t.startRecording}
            aria-pressed={recording}
            aria-describedby="mic-hint"
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>

          <div role="status" aria-live="polite" style={{ minHeight: 20 }}>
            {recording && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--danger)', fontSize: '.85rem', fontWeight: 600 }}>
                <span className="rec-dot" aria-hidden="true" />
                {t.recording}
              </div>
            )}
          </div>

          {photo ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.85rem' }}>
              <span className="chip chip-green"><span aria-hidden="true">📷 </span>{t.photoAttached(photo.name)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)} aria-label={t.removePhoto}>{t.remove}</button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} disabled={recording} onClick={() => photoInputRef.current?.click()}>
              <span aria-hidden="true">📷 </span>{t.addPhoto}
            </button>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handlePhoto} aria-label={t.addPhoto} />
        </div>
      )}

      {processing && (
        <div className="loading-screen" role="status" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <p>{t.processing}</p>
        </div>
      )}

      {extracted && !processing && (
        <div>
          {extracted.needs_review?.length > 0 && (
            <div className="review-strip" role="region" aria-label={t.needsReview}>
              <h3><span aria-hidden="true">⚠️ </span>{t.needsReview}</h3>
              <ul lang="en">
                {extracted.needs_review.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          <div className="card">
            <h3 style={{ marginBottom: 10 }}>{t.jobSummary}</h3>
            <p lang="en" style={{ fontSize: '.9rem', color: 'var(--gray-700)', lineHeight: 1.6 }}>
              {extracted.summary_english || t.noSummary}
            </p>
            {lang === 'bn' && extracted.summary_english && (
              <p style={{ fontSize: '.75rem', color: 'var(--gray-500)', marginTop: 4 }}>{t.summaryEnglishNote}</p>
            )}
            {extracted.units_serviced?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <h4 className="label">{t.unitsServiced}</h4>
                {extracted.units_serviced.map((u, i) => (
                  <span key={i} className="chip chip-green" style={{ marginRight: 4 }}>{u.quantity ?? '?'} {u.type}</span>
                ))}
              </div>
            )}
            {extracted.units_pending?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <h4 className="label">{t.unitsPending}</h4>
                {extracted.units_pending.map((u, i) => (
                  <span key={i} className="chip chip-amber" style={{ marginRight: 4 }}>{u.quantity ?? '?'} {u.type}</span>
                ))}
              </div>
            )}
            {extracted.extra_work?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <h4 className="label">{t.extraWork}</h4>
                {extracted.extra_work.map((e, i) => (
                  <span key={i} className="chip chip-blue" style={{ marginRight: 4 }}>{e.quantity ?? '?'} × {e.item}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={handleReRecord}>
              <span aria-hidden="true">🔁 </span>{t.reRecord}
            </button>
            <button type="button" className="btn btn-success" style={{ flex: 2 }} disabled={confirming} onClick={handleConfirm}>
              {confirming ? t.confirming : <><span aria-hidden="true">✓ </span>{t.confirm}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  )
}

function StatusChip({ status, t }) {
  const map = {
    done: ['chip chip-green', '✓'],
    scheduled: ['chip chip-blue', '⏳'],
    pending_confirmation: ['chip chip-amber', '⏳'],
    missed: ['chip chip-red', '✗'],
  }
  const [cls, icon] = map[status] || ['chip chip-gray', '']
  return <span className={cls}>{icon && <span aria-hidden="true">{icon} </span>}{t.status[status] || status}</span>
}
