import { useState, useEffect, useRef } from 'react'
import { fetchContracts, extractContractText, extractContractFile, confirmContract, editContractField } from '../api.js'

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

  async function loadContracts() {
    setLoading(true)
    try {
      setContracts(await fetchContracts())
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContracts() }, [])

  async function handleFile(file) {
    if (!file) return
    setExtracting(true)
    setView('extract')
    try {
      const { extracted: data } = await extractContractFile(file)
      setExtracted({ ...data, source_ref: file.name })
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
    setView('extract')
    try {
      const { extracted: data } = await extractContractText(pasteText)
      setExtracted({ ...data, source_ref: 'pasted-text' })
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
      showToast('Contract saved ✓')
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
    setSaving(true)
    try {
      await editContractField(selectedContract.id, {
        [editField.key]: editField.value,
        edited_by: 'owner',
      })
      showToast('Field updated ✓')
      setEditField(null)
      await loadContracts()
      const refreshed = contracts.find(c => c.id === selectedContract.id)
      if (refreshed) setSelectedContract(refreshed)
    } catch (e) {
      showToast('Edit failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div>
      <div className="section-header">
        <h2>Contracts</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setView('add')}>+ Add</button>
      </div>

      {loading ? <div className="spinner" /> : (
        contracts.length === 0
          ? <div className="empty-state"><p>No contracts yet. Add one above.</p></div>
          : contracts.map(c => (
            <div key={c.id} className="card" onClick={() => { setSelectedContract(c); setView('detail') }}
              style={{ cursor: 'pointer' }}>
              <div className="card-row">
                <div style={{ flex: 1 }}>
                  <div className="card-title">{c.client_name}</div>
                  <div className="card-sub">{c.contract_no} · {c.visit_frequency}</div>
                  <div style={{ marginTop: 4 }}>
                    {c.needs_review?.length > 0 && <span className="badge badge-warning">⚠ {c.needs_review.length} flag(s)</span>}
                    {' '}{c.renewal_reminder_date && <span className="badge badge-primary">Renew {c.renewal_reminder_date}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="card-amount">{formatRs(c.contract_value)}</div>
                  <div className="card-sub">{c.gst_extra ? '+GST' : 'incl. GST'}</div>
                </div>
              </div>
              <div className="source-tag">📎 {c.source_ref}</div>
            </div>
          ))
      )}
    </div>
  )

  // ── Add contract ───────────────────────────────────────────────────────────
  if (view === 'add') return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>← Back</button>
        <h2>Add Contract</h2>
      </div>

      <div className="tabs">
        <button className={`tab${addMode === 'upload' ? ' active' : ''}`} onClick={() => setAddMode('upload')}>📷 Upload</button>
        <button className={`tab${addMode === 'paste' ? ' active' : ''}`} onClick={() => setAddMode('paste')}>📋 Paste text</button>
      </div>

      {addMode === 'upload' && (
        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p><strong>Tap to upload</strong> or drag and drop</p>
          <p style={{ fontSize: '.8rem', marginTop: 4 }}>Photo, PDF, or scan of contract</p>
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
        </div>
      )}

      {addMode === 'paste' && (
        <div>
          <label className="label">Contract text</label>
          <textarea
            className="input"
            rows={8}
            placeholder="Paste the contract text here…"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <button className="btn btn-primary btn-full" style={{ marginTop: 10 }} onClick={handlePaste}>
            Extract with AI →
          </button>
        </div>
      )}
    </div>
  )

  // ── Extracting ─────────────────────────────────────────────────────────────
  if (view === 'extract') return (
    <div className="loading-screen">
      <div className="spinner" />
      <p>Extracting contract details with AI…</p>
      <p style={{ fontSize: '.8rem', color: 'var(--gray-400)' }}>This may take a few seconds</p>
    </div>
  )

  // ── Confirm extracted data ─────────────────────────────────────────────────
  if (view === 'confirm' && extracted) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={() => setView('add')}>← Back</button>
        <h2>Review Extracted Data</h2>
      </div>

      <ExtractionBadge method={extracted.extraction_method} />

      {extracted.needs_review?.length > 0 && (
        <div className="review-strip">
          <h3>⚠️ Needs review</h3>
          <ul>
            {extracted.needs_review.map((note, i) => <li key={i}>{note}</li>)}
          </ul>
        </div>
      )}

      <div className="card">
        <ExtractedFields data={extracted} />
      </div>

      {extracted.visit_schedule?.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Visit Schedule ({extracted.visit_schedule.length} visits)</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {extracted.visit_schedule.map((d, i) => (
              <span key={i} className="chip chip-blue">{d}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setView('add')}>
          Re-extract
        </button>
        <button className="btn btn-success" style={{ flex: 2 }} disabled={saving || extracted.extraction_failed} onClick={handleConfirm}>
          {extracted.extraction_failed ? 'Extraction failed' : saving ? 'Saving…' : '✓ Confirm & Save'}
        </button>
      </div>
    </div>
  )

  // ── Contract detail ────────────────────────────────────────────────────────
  if (view === 'detail' && selectedContract) {
    const c = selectedContract
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setView('list')}>← Back</button>
          <h2 style={{ flex: 1 }}>{c.client_name}</h2>
        </div>

        <ExtractionBadge method={c.extraction_method} />

        {c.needs_review?.length > 0 && (
          <div className="review-strip">
            <h3>⚠️ Needs review</h3>
            <ul>
              {c.needs_review.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        )}

        <div className="card">
          <ExtractedFields data={c} onEdit={setEditField} />
        </div>

        {c.visit_schedule?.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Visit Schedule</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {c.visit_schedule.map((d, i) => (
                <span key={i} className="chip chip-blue">{d}</span>
              ))}
            </div>
          </div>
        )}

        <div className="source-tag" style={{ padding: '0 4px' }}>📎 Source: {c.source_ref}</div>

        {/* Edit field modal */}
        {editField && (
          <div className="modal-overlay" onClick={() => setEditField(null)}>
            <div className="modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="modal-handle" />
              <h3 style={{ marginBottom: 12 }}>Edit: {editField.key}</h3>
              <input
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

// "gemini:gemini-4-hydrogen" -> "Read by Gemini 4 Hydrogen"
function extractionLabel(method) {
  if (!method) return null
  if (method === 'fallback_parser') return 'Read by backup parser (AI failed)'
  if (method.startsWith('gemini:')) {
    const name = method.slice('gemini:'.length)
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    return `Read by ${name}`
  }
  return `Read by ${method}`
}

function ExtractionBadge({ method }) {
  const label = extractionLabel(method)
  if (!label) return null
  const cls = method === 'fallback_parser' ? 'badge badge-warning' : 'badge badge-gray'
  return <div style={{ marginBottom: 10 }}><span className={cls} title={method}>{label}</span></div>
}

const EDITABLE_FIELDS = {
  provider_name: 'Provider',
  contract_no: 'Contract No.',
  client_name: 'Client',
  site_address: 'Site',
  start_date: 'Start Date',
  end_date: 'End Date',
  visit_frequency: 'Frequency',
  contract_value: 'Contract Value',
  gst_extra: 'GST Extra',
  payment_terms: 'Payment Terms',
  renewal_reminder_date: 'Renewal Reminder',
  extras_chargeable: 'Extras Chargeable',
}

function ExtractedFields({ data, onEdit }) {
  return (
    <div className="field-list">
      {Object.entries(EDITABLE_FIELDS).map(([key, label]) => {
        const val = data[key]
        const isNull = val === null || val === undefined || val === ''
        const isFlag = data.needs_review?.some(n => n.toLowerCase().includes(key.toLowerCase()))

        return (
          <div
            key={key}
            className={`field-row${isFlag ? ' flagged' : ''}`}
            onClick={onEdit ? () => onEdit({ key, value: val === null ? '' : String(val) }) : undefined}
            style={onEdit ? { cursor: 'pointer' } : {}}
          >
            <span className="field-key">
              {label}
              {isFlag && <span style={{ marginLeft: 4, color: 'var(--accent)' }}>⚠</span>}
            </span>
            <span className="field-val" style={isNull ? { color: 'var(--gray-400)', fontStyle: 'italic' } : {}}>
              {isNull ? 'null' : key === 'gst_extra' || key === 'extras_chargeable' ? (val ? 'Yes' : 'No') :
                key === 'contract_value' ? `Rs ${Number(val).toLocaleString('en-IN')}` : String(val)}
              {onEdit && <span style={{ marginLeft: 6, color: 'var(--primary)', fontSize: '.75rem' }}>✏</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
