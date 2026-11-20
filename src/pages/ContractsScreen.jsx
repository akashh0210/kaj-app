import { useState, useEffect, useRef } from 'react'
import { fetchContracts, extractContractText, extractContractFile, confirmContract, editContractField } from '../api.js'
import { ArrowLeft, Check, ClipboardPaste, Paperclip, Pencil, Plus, TriangleAlert, Upload } from 'lucide-react'
import LoadError from '../components/LoadError.jsx'
import useEscape from '../components/useEscape.js'

// Turn the edit box's text into the type the field stores; empty means null.
function coerceFieldValue(key, raw) {
  const v = String(raw ?? '').trim()
  if (v === '') return null
  if (key === 'contract_value') {
    const n = Number(v.replace(/[,\s]|rs\.?|₹/gi, ''))
    if (!Number.isFinite(n) || n < 0) throw new Error('Enter the contract value as a number, e.g. 38500')
    return n
  }
  if (key === 'gst_extra' || key === 'extras_chargeable') {
    if (/^(yes|true|y)$/i.test(v)) return true
    if (/^(no|false|n)$/i.test(v)) return false
    throw new Error('Enter Yes or No')
  }
  if (/_date$/.test(key)) {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v)
    if (!ok) throw new Error('Enter the date as YYYY-MM-DD, e.g. 2026-04-01')
    return v
  }
  return v
}

function formatRs(n) {
  if (!n && n !== 0) return '—'
  return 'Rs ' + Number(n).toLocaleString('en-IN')
}

export default function ContractsScreen({ showToast }) {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'add' | 'extract' | 'confirm' | 'detail'
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [addMode, setAddMode] = useState('upload') // 'upload' | 'paste'
  const [selectedContract, setSelectedContract] = useState(null)
  const [editField, setEditField] = useState(null) // { key, value }
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()
  useEscape(() => setEditField(null), Boolean(editField) && !saving)

  const [loadError, setLoadError] = useState(null)

  async function loadContracts() {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await fetchContracts()
      setContracts(list)
      return list
    } catch (e) {
      setLoadError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContracts() }, [])

  // Step text while extracting. Step 1 lasts as long as the Gemini call; steps 2 and 3
  // (date checks, schedule) run on the server in the same request, so they are ticked
  // off briefly once the answer arrives.
  const [extractStep, setExtractStep] = useState(0)
  async function finishSteps() {
    for (const step of [2, 3]) {
      setExtractStep(step)
      await new Promise(r => setTimeout(r, 350))
    }
  }

  async function handleFile(file) {
    if (!file) return
    setExtracting(true)
    setExtractStep(1)
    setView('extract')
    try {
      const { extracted: data } = await extractContractFile(file)
      await finishSteps()
      setExtracted(data) // keep the server's unique source_ref
      setView('confirm')
    } catch (e) {
      showToast('Extraction failed: ' + e.message)
      setView('add')
    } finally {
      setExtracting(false)
    }
  }

  async function handlePaste() {
    if (!pasteText.trim()) return showToast('Please enter contract text.')
    setExtracting(true)
    setExtractStep(1)
    setView('extract')
    try {
      const { extracted: data } = await extractContractText(pasteText)
      await finishSteps()
      setExtracted(data)
      setView('confirm')
    } catch (e) {
      showToast('Extraction failed: ' + e.message)
      setView('add')
    } finally {
      setExtracting(false)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      await confirmContract({ ...extracted, confirmed_by: 'owner' })
      showToast('Contract saved')
      setView('list')
      setExtracted(null)
      setPasteText('')
      await loadContracts()
    } catch (e) {
      showToast('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEditSave() {
    if (!editField) return
    let value
    try {
      value = coerceFieldValue(editField.key, editField.value)
    } catch (e) {
      return showToast(e.message)
    }
    setSaving(true)
    try {
      await editContractField(selectedContract.id, {
        [editField.key]: value,
        edited_by: 'owner',
      })
      showToast('Field updated')
      setEditField(null)
      const list = await loadContracts() // use the fresh list, not stale state
      const refreshed = list?.find(c => c.id === selectedContract.id)
      setSelectedContract(refreshed || { ...selectedContract, [editField.key]: value })
    } catch (e) {
      showToast('Edit failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div>
      <div className="section-header" style={{ marginTop: 0 }}>
        <h2>Contracts</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setView('add')}><Plus size={16} aria-hidden="true" />Add</button>
      </div>

      {loading ? <div className="spinner" /> : loadError ? <LoadError message={loadError} onRetry={loadContracts} /> : (
        contracts.length === 0
          ? <div className="empty-state"><p>No contracts yet. Add one above.</p></div>
          : contracts.map(c => (
            <button type="button" key={c.id} className="card card-btn" onClick={() => { setSelectedContract(c); setView('detail') }}
              aria-label={`Open contract ${c.contract_no || ''} for ${c.client_name || 'unknown client'}${c.needs_review?.length ? `, ${c.needs_review.length} flags` : ''}`}>
              <div className="card-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="card-title">{c.client_name}</div>
                  <div className="card-sub tabular">{c.contract_no} · {c.visit_frequency}</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {c.needs_review?.length > 0 && <span className="pill pill-amber">{c.needs_review.length} flag{c.needs_review.length === 1 ? '' : 's'}</span>}
                    {c.renewal_reminder_date && <span className="pill pill-quiet tabular">Renew {c.renewal_reminder_date}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="card-amount">{formatRs(c.contract_value)}</div>
                  <div className="card-sub">{c.gst_extra ? '+GST' : 'incl. GST'}</div>
                </div>
              </div>
              <div className="source-tag"><Paperclip size={14} aria-hidden="true" />{c.original_filename || c.source_ref}</div>
            </button>
          ))
      )}
    </div>
  )

  // ── Add contract ───────────────────────────────────────────────────────────
  if (view === 'add') return (
    <div>
      <div className="back-row">
        <button className="btn btn-outline btn-sm" onClick={() => setView('list')}><ArrowLeft size={16} aria-hidden="true" />Back</button>
        <h2>Add contract</h2>
      </div>

      <div className="tabs" role="tablist" aria-label="How to add the contract">
        <button type="button" role="tab" aria-selected={addMode === 'upload'} className={`tab${addMode === 'upload' ? ' active' : ''}`} onClick={() => setAddMode('upload')}><Upload size={16} aria-hidden="true" />Upload</button>
        <button type="button" role="tab" aria-selected={addMode === 'paste'} className={`tab${addMode === 'paste' ? ' active' : ''}`} onClick={() => setAddMode('paste')}><ClipboardPaste size={16} aria-hidden="true" />Paste text</button>
      </div>

      {addMode === 'upload' && (
        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Upload a contract photo or PDF"
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click() } }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <Upload size={32} aria-hidden="true" />
          <p><strong style={{ color: 'var(--text)' }}>Tap to upload</strong> or drag and drop</p>
          <p style={{ fontSize: '.85rem' }}>Photo, PDF or scan of the contract</p>
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true"
            onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}

      {addMode === 'paste' && (
        <div>
          <label className="label" htmlFor="contract-text">Contract text</label>
          <textarea
            id="contract-text"
            className="input"
            rows={8}
            placeholder="Paste the contract text here…"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <button className="btn btn-primary btn-full" style={{ marginTop: 10 }} onClick={handlePaste}>
            Extract with AI
          </button>
        </div>
      )}
    </div>
  )

  // ── Extracting ─────────────────────────────────────────────────────────────
  if (view === 'extract') return (
    <div className="loading-screen" role="status" aria-live="polite">
      <ol className="extract-steps">
        {EXTRACT_STEPS.map((label, i) => {
          const n = i + 1
          const state = extractStep > n ? 'done' : extractStep === n ? 'active' : 'todo'
          return (
            <li key={label} className={`extract-step ${state}`} aria-current={state === 'active' ? 'step' : undefined}>
              <span className="extract-step-mark" aria-hidden="true">{state === 'done' ? <Check size={14} /> : null}</span>
              {label}
            </li>
          )
        })}
      </ol>
    </div>
  )

  // ── Confirm extracted data ─────────────────────────────────────────────────
  if (view === 'confirm' && extracted) return (
    <div>
      <div className="back-row">
        <button className="btn btn-outline btn-sm" onClick={() => setView('add')}><ArrowLeft size={16} aria-hidden="true" />Back</button>
        <h2>Review extracted data</h2>
      </div>

      <ExtractionBadge method={extracted.extraction_method} log={extracted.extraction_log} />
      <ReviewSlip notes={extracted.needs_review} />

      <div className="card" style={{ padding: '4px 16px 4px 4px' }}>
        <ExtractedFields data={extracted} />
      </div>

      <VisitSchedule dates={extracted.visit_schedule} />

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setView('add')}>
          Re-extract
        </button>
        <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving || extracted.extraction_failed} onClick={handleConfirm}>
          {extracted.extraction_failed ? 'Extraction failed' : saving ? 'Saving…' : <><Check size={18} aria-hidden="true" />Confirm and save</>}
        </button>
      </div>
    </div>
  )

  // ── Contract detail ────────────────────────────────────────────────────────
  if (view === 'detail' && selectedContract) {
    const c = selectedContract
    return (
      <div>
        <div className="back-row">
          <button className="btn btn-outline btn-sm" onClick={() => setView('list')}><ArrowLeft size={16} aria-hidden="true" />Back</button>
          <h2 style={{ flex: 1 }}>{c.client_name}</h2>
        </div>

        <ExtractionBadge method={c.extraction_method} log={c.extraction_log} />
        <ReviewSlip notes={c.needs_review} />

        <div className="card" style={{ padding: '4px 16px 4px 4px' }}>
          <ExtractedFields data={c} onEdit={setEditField} />
        </div>

        <VisitSchedule dates={c.visit_schedule} />

        <div className="source-tag"><Paperclip size={14} aria-hidden="true" />Source: {c.source_ref}</div>

        {/* Edit field modal */}
        {editField && (
          <div className="modal-overlay" onClick={() => !saving && setEditField(null)}>
            <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-field-title" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h3 id="edit-field-title" style={{ marginBottom: 12 }}>Edit {(EDITABLE_FIELDS[editField.key] || editField.key).toLowerCase()}</h3>
              <input
                autoFocus
                aria-labelledby="edit-field-title"
                onKeyDown={e => { if (e.key === 'Enter') handleEditSave() }}
                className="input"
                value={editField.value ?? ''}
                onChange={e => setEditField(f => ({ ...f, value: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setEditField(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={saving} onClick={handleEditSave}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}

const EXTRACT_STEPS = ['Reading contract with Gemini…', 'Checking dates…', 'Building schedule…']

function ReviewSlip({ notes }) {
  if (!notes?.length) return null
  return (
    <section className="review-strip" aria-label="Needs review">
      <h3><TriangleAlert size={16} aria-hidden="true" />Needs review</h3>
      <ul>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul>
    </section>
  )
}

function VisitSchedule({ dates }) {
  if (!dates?.length) return null
  return (
    <div className="card">
      <h3 style={{ marginBottom: 10 }}>Visit schedule <span className="muted" style={{ fontStretch: '100%', fontWeight: 400 }}>({dates.length} visits)</span></h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {dates.map((d, i) => <span key={i} className="pill pill-blue tabular">{d}</span>)}
      </div>
    </div>
  )
}

// "gemini:gemini-4-hydrogen" -> "Read by Gemini 4 Hydrogen"
function extractionLabel(method) {
  if (!method) return null
  if (method === 'fallback_parser') return 'Read by backup parser (AI failed)'
  if (method.startsWith('saved:')) return 'Read by Gemini (saved result)'
  if (method.startsWith('gemini:')) {
    const name = method.slice('gemini:'.length)
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `Read by ${name}`
  }
  return `Read by ${method}`
}

function ExtractionBadge({ method, log }) {
  const label = extractionLabel(method)
  if (!label) return null
  const cls = method === 'fallback_parser' ? 'pill pill-amber' : 'pill pill-quiet'
  // Explain a second-model retry: why it happened and which answer was kept
  const name = m => extractionLabel('gemini:' + m).replace('Read by ', '')
  const n = log?.disagreements?.length
  const why = log?.saved_result
    ? 'Same file as an earlier upload, so the saved result was reused with no new AI call.'
    : log?.retry_reason
    ? `Second opinion from ${name(log.retry_model)} because ${log.retry_reason}. ` +
      (n === undefined ? (log.kept ? `Kept ${name(log.kept)}'s answer.` : '')
        : n === 0 ? 'Both models agreed on every field.'
        : `They disagreed on ${n} field${n === 1 ? '' : 's'} (flagged below); ${name(log.primary_model)}'s values are shown.`)
    : null
  return (
    <div style={{ marginBottom: 14 }}>
      <span className={cls} title={method}>{label}</span>
      {why && <p style={{ fontSize: '.8rem', color: 'var(--text-2)', marginTop: 6 }}>{why}</p>}
    </div>
  )
}

const EDITABLE_FIELDS = {
  provider_name: 'Provider',
  contract_no: 'Contract no.',
  client_name: 'Client',
  site_address: 'Site',
  start_date: 'Start date',
  end_date: 'End date',
  visit_frequency: 'Frequency',
  contract_value: 'Contract value',
  gst_extra: 'GST extra',
  payment_terms: 'Payment terms',
  renewal_reminder_date: 'Renewal reminder',
  extras_chargeable: 'Extras chargeable',
}

// Worked out by code from the dates and frequency; shown but not editable.
const COMPUTED_FIELDS = new Set(['renewal_reminder_date'])

// Notes that mention a field, written either "end_date" or "end date"
function notesFor(notes, key) {
  const spaced = key.replace(/_/g, ' ')
  return (notes || []).filter(n => { const t = n.toLowerCase(); return t.includes(key) || t.includes(spaced) })
}

function ExtractedFields({ data, onEdit }) {
  return (
    <div className="field-list">
      {Object.entries(EDITABLE_FIELDS).map(([key, label]) => {
        const val = data[key]
        const isNull = val === null || val === undefined || val === ''
        const reasons = notesFor(data.needs_review, key)
        const isFlag = reasons.length > 0
        const isBool = key === 'gst_extra' || key === 'extras_chargeable'
        const shown = isNull ? 'Not found' : isBool ? (val ? 'Yes' : 'No') :
          key === 'contract_value' ? `Rs ${Number(val).toLocaleString('en-IN')}` : String(val)
        const editable = onEdit && !COMPUTED_FIELDS.has(key)
        const content = (
          <>
            <span className="field-key">
              {label}
              {COMPUTED_FIELDS.has(key) && <span className="auto">(auto)</span>}
            </span>
            <span className={`field-val${isNull ? ' empty' : ''}`}>
              {shown}
              {editable && <Pencil size={14} className="field-edit" aria-hidden="true" />}
            </span>
            {reasons.map((r, i) => (
              <span key={i} className="field-reason"><TriangleAlert size={14} aria-hidden="true" style={{ marginTop: 2 }} />{r}</span>
            ))}
          </>
        )

        return editable ? (
          <button
            type="button"
            key={key}
            className={`field-row field-row-btn${isFlag ? ' flagged' : ''}`}
            aria-label={`Edit ${label}: ${shown}${isFlag ? ' (needs review)' : ''}`}
            onClick={() => onEdit({ key, value: isNull ? '' : isBool ? (val ? 'Yes' : 'No') : String(val) })}
          >
            {content}
          </button>
        ) : (
          <div key={key} className={`field-row${isFlag ? ' flagged' : ''}`}>{content}</div>
        )
      })}
    </div>
  )
}
