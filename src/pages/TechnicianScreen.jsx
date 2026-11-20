import { useState, useEffect, useRef } from 'react'
import { fetchVisits, submitVoiceUpdate, submitVisitUpdate } from '../api.js'
import { ArrowLeft, Camera, Check, ChevronRight, Mic, RotateCcw, Square, TriangleAlert } from 'lucide-react'
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
  const [stamped, setStamped] = useState(false) // shows the Confirmed stamp after a successful confirm
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
      // Visual only: let the "Confirmed" stamp land on the slip before leaving the visit
      setStamped(true)
      await new Promise(r => setTimeout(r, 1200))
      setStamped(false)
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
          <h2 className="page-title">{t.todaysVisits}</h2>
          <p className="page-sub">
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
                  <div style={{ minWidth: 0 }}>
                    <div className="card-title">{v.client_name}</div>
                    <div className="card-sub">{v.site_address?.split(',')[0]}</div>
                    <div className="card-sub tabular" style={{ marginTop: 2 }}>
                      {v.units?.map(u => `${u.quantity}× ${u.type}`).join(', ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <StatusChip status={v.status} t={t} />
                    {openable && (
                      <span className="visit-open" aria-hidden="true">{t.open}<ChevronRight size={16} /></span>
                    )}
                  </div>
                </div>
                {v.job_summary && (
                  <div lang="en" className="tech-note">{v.job_summary}</div>
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
      <div className="back-row">
        <button type="button" className="btn btn-outline btn-sm" onClick={leaveVisit}>
          <ArrowLeft size={16} aria-hidden="true" />{t.back}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="card-title" style={{ fontSize: '1.05rem' }}>{activeVisit.client_name}</h2>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 28, gap: 22 }}>
          <p id="mic-hint" style={{ color: 'var(--text-2)', fontSize: '.95rem', textAlign: 'center' }}>
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
            {recording ? <Square aria-hidden="true" fill="currentColor" /> : <Mic aria-hidden="true" />}
          </button>

          <div role="status" aria-live="polite" style={{ minHeight: 22 }}>
            {recording && (
              <div className="rec-status">
                <span className="rec-dot" aria-hidden="true" />
                {t.recording}
              </div>
            )}
          </div>

          {photo ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '.85rem' }}>
              <span className="pill pill-blue"><Camera size={14} aria-hidden="true" />{t.photoAttached(photo.name)}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)} aria-label={t.removePhoto}>{t.remove}</button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline btn-sm" disabled={recording} onClick={() => photoInputRef.current?.click()}>
              <Camera size={16} aria-hidden="true" />{t.addPhoto}
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
          {/* Job slip: off-white paper that slides up once */}
          <article className="job-slip" aria-labelledby="slip-title">
            {stamped && <div className="stamp" role="img" aria-label={t.confirmedStamp}>{t.confirmedStamp}</div>}
            <div className="slip-meta">
              <span>{t.jobSlip}</span>
              <span className="tabular">{new Date().toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <h3 id="slip-title">{activeVisit.client_name}</h3>
            <p className="card-sub" style={{ color: 'var(--ink-2)', marginBottom: 10 }}>{t.jobSummary}</p>
            <p lang="en" className="slip-summary">{extracted.summary_english || t.noSummary}</p>
            {lang === 'bn' && extracted.summary_english && (
              <p style={{ fontSize: '.8rem', color: 'var(--ink-2)', marginTop: -6, marginBottom: 12 }}>{t.summaryEnglishNote}</p>
            )}

            <ul className="slip-lines">
              {(extracted.units_serviced || []).map((u, i) => (
                <li key={`s${i}`}><span><span className="k">{t.unitsServiced}</span>{u.type ? ` · ${u.type}` : ''}</span><span className="qty">{u.quantity ?? '?'}</span></li>
              ))}
              {(extracted.units_pending || []).map((u, i) => (
                <li key={`p${i}`}><span><span className="k">{t.unitsPending}</span>{u.type ? ` · ${u.type}` : ''}</span><span className="qty">{u.quantity ?? '?'}</span></li>
              ))}
              {(extracted.extra_work || []).map((e, i) => (
                <li key={`e${i}`}><span><span className="k">{t.extraWork}</span>{e.item ? ` · ${e.item}` : ''}</span><span className="qty">× {e.quantity ?? '?'}</span></li>
              ))}
            </ul>

            {extracted.needs_review?.length > 0 && (
              <>
                <p className="slip-flags-title"><TriangleAlert size={14} aria-hidden="true" />{t.needsReview}</p>
                <ul className="slip-flags" lang="en">
                  {extracted.needs_review.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </>
            )}
          </article>

          {!stamped && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={handleReRecord} disabled={confirming}>
                <RotateCcw size={18} aria-hidden="true" />{t.reRecord}
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} disabled={confirming} onClick={handleConfirm}>
                {confirming ? t.confirming : <><Check size={18} aria-hidden="true" />{t.confirm}</>}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusChip({ status, t }) {
  const map = {
    done: 'pill pill-quiet',
    scheduled: 'pill pill-blue',
    pending_confirmation: 'pill pill-amber',
    missed: 'pill pill-amber',
  }
  return <span className={map[status] || 'pill pill-quiet'}>{t.status[status] || status}</span>
}
