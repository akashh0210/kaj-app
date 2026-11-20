import { useState, useEffect } from 'react'
import {
  fetchInvoices,
  markInvoicePaid,
  draftReminder,
  updateReminder,
  approveReminder,
  markReminderSent,
  setExtraPrice
} from '../api.js'
import LoadError from '../components/LoadError.jsx'
import useEscape from '../components/useEscape.js'

function formatRs(n) {
  if (!n && n !== 0) return '—'
  return 'Rs ' + Number(n).toLocaleString('en-IN')
}

export default function BillsScreen({ showToast }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [reminderModal, setReminderModal] = useState(null) // invoice obj
  const [draftData, setDraftData] = useState(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [waLink, setWaLink] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [busyId, setBusyId] = useState(null) // invoice currently being marked paid / priced
  const [sending, setSending] = useState(false)
  useEscape(() => closeReminder(), Boolean(reminderModal) && !approving && !sending)

  async function load() {
    setLoading(true)
    setLoadError(null)
    try { setInvoices(await fetchInvoices()) } catch (e) { setLoadError(e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleMarkPaid(inv) {
    if (busyId) return
    setBusyId(inv.id)
    try {
      await markInvoicePaid(inv.id)
      showToast('Marked as paid ✓')
      await load()
    } catch (e) { showToast('Error: ' + e.message) } finally { setBusyId(null) }
  }

  function closeReminder() {
    setReminderModal(null)
    setDraftData(null)
    setWaLink(null)
    setApproved(false)
    setIsEditingReminder(false)
  }

  const [isEditingReminder, setIsEditingReminder] = useState(false)
  const [editEnglish, setEditEnglish] = useState('')
  const [editBengali, setEditBengali] = useState('')

  async function handleDraftReminder(inv) {
    setReminderModal(inv)
    setDraftLoading(true)
    setDraftData(null)
    setWaLink(null)
    setApproved(false)
    setIsEditingReminder(false)
    try {
      const draft = await draftReminder({
        invoice_id: inv.id,
        client_name: inv.client_name,
        invoice_no: inv.invoice_no,
        amount: inv.amount,
        due_date: inv.due_date,
        client_phone: inv.client_phone,
      })
      setDraftData(draft)
      setEditEnglish(draft.message_english || '')
      setEditBengali(draft.message_bengali || '')
    } catch (e) {
      showToast('Draft failed: ' + e.message)
      setReminderModal(null)
    } finally {
      setDraftLoading(false)
    }
  }

  async function handleSaveReminderEdit() {
    if (!draftData?.id) return
    try {
      await updateReminder(draftData.id, {
        message_english: editEnglish,
        message_bengali: editBengali,
      })
      setDraftData(d => ({ ...d, message_english: editEnglish, message_bengali: editBengali }))
      setIsEditingReminder(false)
      showToast('Reminder edited ✓')
    } catch (e) {
      showToast('Edit failed: ' + e.message)
    }
  }

  async function handleCopyMessage(text) {
    const textToCopy = text ?? (editEnglish || draftData?.message_english || '')
    try {
      await navigator.clipboard.writeText(textToCopy)
      showToast('Message copied ✓')
    } catch {
      showToast('Could not copy automatically. Press and hold the message to copy it.', 4000)
    }
  }

  async function handleApprove() {
    if (!draftData?.id) return
    setApproving(true)
    try {
      const res = await approveReminder(draftData.id, 'owner', {
        message_english: editEnglish || draftData.message_english,
      })
      setWaLink(res.waLink)
      setApproved(true)
      if (res.waLink) {
        showToast('Approved! Opening WhatsApp…')
        window.open(res.waLink, '_blank')
      } else {
        showToast('Approved! No phone number — use Copy to send.')
      }
    } catch (e) {
      showToast('Approve failed: ' + e.message)
    } finally {
      setApproving(false)
    }
  }

  async function handleMarkSent() {
    if (!draftData?.id || sending) return
    setSending(true)
    try {
      await markReminderSent(draftData.id)
      showToast('Marked as sent ✓')
      closeReminder()
      await load()
    } catch (e) {
      showToast('Could not mark as sent: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  const [pricingId, setPricingId] = useState(null)
  const [customPrice, setCustomPrice] = useState('')

  async function handleSavePrice(invId) {
    if (!customPrice || isNaN(customPrice) || Number(customPrice) <= 0) return showToast('Enter a valid price')
    if (busyId) return
    setBusyId(invId)
    try {
      await setExtraPrice(invId, { unit_price: Number(customPrice), quantity: 1 })
      showToast('Price set ✓')
      setPricingId(null)
      setCustomPrice('')
      await load()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setBusyId(null)
    }
  }

  const unbilledExtras = invoices.filter(i => i.is_extra && i.status === 'draft')
  const regularInvoices = invoices.filter(i => !i.is_extra || i.status !== 'draft')
  const overdue = regularInvoices.filter(i => i.status !== 'paid' && i.days_overdue > 0)
  const upcoming = regularInvoices.filter(i => i.status !== 'paid' && i.days_overdue === 0)
  const paid = regularInvoices.filter(i => i.status === 'paid')

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Bills &amp; Payments</h2>

      {loading ? <div className="spinner" /> : loadError ? <LoadError message={loadError} onRetry={load} /> : (
        <>
          {/* Unbilled Extras (Bill lines from voice notes) */}
          {unbilledExtras.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="section-header">
                <h2 style={{ color: 'var(--accent)' }}>Unbilled Extras from Visits ({unbilledExtras.length})</h2>
              </div>
              {unbilledExtras.map(extra => (
                <div key={extra.id} className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
                  <div className="card-row">
                    <div style={{ flex: 1 }}>
                      <div className="card-title">{extra.client_name}</div>
                      <div className="card-sub">{extra.item || extra.description} × {extra.quantity || 1}</div>
                      {extra.needs_owner_pricing ? (
                        <div style={{ marginTop: 4 }}>
                          <span className="badge badge-warning">⚠ Not on rate card — Owner price required</span>
                        </div>
                      ) : extra.unit_price != null ? (
                        <div style={{ marginTop: 4 }}>
                          <span className="badge badge-primary">Rate: {formatRs(extra.unit_price)}/unit</span>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="card-amount" style={{ color: extra.amount ? 'var(--primary)' : 'var(--accent)' }}>
                        {extra.amount !== null ? formatRs(extra.amount) : 'Needs Price'}
                      </div>
                      <div className="card-sub">{extra.gst_extra ? '+GST' : 'incl. GST'}</div>
                    </div>
                  </div>

                  {extra.needs_owner_pricing && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {pricingId === extra.id ? (
                        <>
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            aria-label={`Price in rupees for ${extra.item || extra.description}`}
                            className="input"
                            style={{ width: 120, padding: '4px 8px', fontSize: '.85rem' }}
                            placeholder="Price in Rs"
                            value={customPrice}
                            onChange={e => setCustomPrice(e.target.value)}
                          />
                          <button className="btn btn-success btn-sm" disabled={busyId === extra.id} onClick={() => handleSavePrice(extra.id)}>{busyId === extra.id ? "Saving…" : "Save"}</button>
                          <button className="btn btn-outline btn-sm" onClick={() => { setPricingId(null); setCustomPrice('') }}>Cancel</button>
                        </>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => { setPricingId(extra.id); setCustomPrice('') }}>
                          ✏ Set Price
                        </button>
                      )}
                    </div>
                  )}

                  <div className="source-tag">📎 Source: {extra.source_ref}</div>
                </div>
              ))}
            </div>
          )}

          {overdue.length > 0 && (
            <>
              <div className="section-header">
                <h2 style={{ color: 'var(--danger)' }}>⚠ Overdue Invoices ({overdue.length})</h2>
              </div>
              {overdue.map(inv => <InvoiceCard key={inv.id} inv={inv} onReminder={() => handleDraftReminder(inv)} onMarkPaid={() => handleMarkPaid(inv)} busy={busyId === inv.id} />)}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <div className="section-header" style={{ marginTop: 8 }}><h2>Upcoming Invoices</h2></div>
              {upcoming.map(inv => <InvoiceCard key={inv.id} inv={inv} onMarkPaid={() => handleMarkPaid(inv)} busy={busyId === inv.id} />)}
            </>
          )}

          {paid.length > 0 && (
            <>
              <div className="section-header" style={{ marginTop: 8 }}><h2 style={{ color: 'var(--gray-500)' }}>Paid</h2></div>
              {paid.map(inv => <InvoiceCard key={inv.id} inv={inv} />)}
            </>
          )}

          {invoices.length === 0 && <div className="empty-state"><p>No invoices or bill lines yet.</p></div>}
        </>
      )}

      {/* Reminder modal */}
      {reminderModal && (
        <div className="modal-overlay" onClick={() => { if (!approving && !sending) closeReminder() }}>
          <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="reminder-title" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 id="reminder-title" style={{ marginBottom: 4 }}>Payment Reminder</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--gray-500)', marginBottom: 14 }}>{reminderModal.client_name} · {reminderModal.invoice_no}</p>

            {draftLoading && <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /><p style={{ marginTop: 8 }}>Drafting with AI…</p></div>}

            {draftData && !draftLoading && (
              <>
                {draftData.owner_note && (
                  <div className="review-strip" style={{ marginBottom: 12 }}>
                    <h3>Owner note</h3>
                    <p style={{ fontSize: '.8rem', color: '#78350f' }}>{draftData.owner_note}</p>
                  </div>
                )}

                {isEditingReminder ? (
                  <div style={{ marginBottom: 12 }}>
                    <label className="label" htmlFor="rem-en">English message</label>
                    <textarea id="rem-en" className="input" rows={4} value={editEnglish} onChange={e => setEditEnglish(e.target.value)} />
                    <label className="label" htmlFor="rem-bn" style={{ marginTop: 8 }}>Bengali message</label>
                    <textarea id="rem-bn" className="input" rows={4} lang="bn" value={editBengali} onChange={e => setEditBengali(e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => {
                        setEditEnglish(draftData.message_english || ''); setEditBengali(draftData.message_bengali || ''); setIsEditingReminder(false)
                      }}>Cancel</button>
                      <button className="btn btn-primary btn-sm" style={{ flex: 2 }} disabled={!editEnglish.trim()} onClick={handleSaveReminderEdit}>Save changes</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label className="label">English message</label>
                      <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 10, fontSize: '.85rem', color: 'var(--gray-800)', lineHeight: 1.5, userSelect: 'text' }}>
                        {draftData.message_english}
                      </div>
                    </div>

                    {draftData.message_bengali && (
                      <div style={{ marginBottom: 12 }}>
                        <label className="label">Bengali message</label>
                        <div lang="bn" style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 10, fontSize: '.85rem', color: 'var(--gray-800)', lineHeight: 1.5, userSelect: 'text' }}>
                          {draftData.message_bengali}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                      {!approved && <button className="btn btn-outline btn-sm" onClick={() => setIsEditingReminder(true)}>✏ Edit</button>}
                      <button className="btn btn-outline btn-sm" onClick={() => handleCopyMessage(draftData.message_english)}>Copy English</button>
                      {draftData.message_bengali && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleCopyMessage(draftData.message_bengali)}>Copy Bengali</button>
                      )}
                    </div>
                  </>
                )}

                <p style={{ fontSize: '.75rem', color: 'var(--gray-500)', marginBottom: 12 }}>
                  Days overdue: <strong>{draftData.days_overdue}</strong>
                </p>

                {/* Guardrail: remind owner to send only 09:00–20:00 IST */}
                <div className="review-strip" style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: '.75rem', color: '#78350f' }}>⏰ Please send only between 09:00 and 20:00 IST.</p>
                </div>

                {!approved ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={closeReminder}>Cancel</button>
                    <button className="btn btn-success" style={{ flex: 2 }} disabled={approving || isEditingReminder} onClick={handleApprove}>
                      {approving ? 'Approving…' : draftData.client_phone ? '✓ Approve & Open WhatsApp' : '✓ Approve'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="success-box">
                      {waLink
                        ? 'WhatsApp opened. After sending, tap Mark as Sent.'
                        : 'Approved. No phone number is stored for this client: copy the message above, send it yourself, then tap Mark as Sent.'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {waLink && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => window.open(waLink, '_blank')}>Re-open WhatsApp</button>}
                      <button className="btn btn-primary" style={{ flex: 2 }} disabled={sending} onClick={handleMarkSent}>
                        {sending ? 'Saving…' : '✓ Mark as Sent'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InvoiceCard({ inv, onReminder, onMarkPaid, busy }) {
  const isPaid = inv.status === 'paid'
  return (
    <div className="card" style={{ borderLeft: `4px solid ${isPaid ? 'var(--success)' : inv.days_overdue > 0 ? 'var(--danger)' : 'var(--primary)'}` }}>
      <div className="card-row">
        <div style={{ flex: 1 }}>
          <div className="card-title">{inv.client_name}</div>
          <div className="card-sub">{inv.invoice_no}</div>
          {!isPaid && inv.days_overdue > 0 && (
            <span className="badge badge-danger" style={{ marginTop: 4 }}>
              {inv.days_overdue} days overdue
            </span>
          )}
          {!isPaid && inv.days_overdue === 0 && (
            <span className="badge badge-primary" style={{ marginTop: 4 }}>Due {inv.due_date}</span>
          )}
          {isPaid && <span className="badge badge-success" style={{ marginTop: 4 }}>Paid</span>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="card-amount">Rs {Number(inv.amount).toLocaleString('en-IN')}</div>
          <div className="card-sub">{inv.gst_extra ? '+GST' : 'incl. GST'}</div>
        </div>
      </div>

      {!isPaid && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {onReminder && inv.days_overdue > 0 && (
            <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={onReminder}>
              💬 Draft Reminder
            </button>
          )}
          {onMarkPaid && (
            <button className="btn btn-success btn-sm" style={{ flex: 1 }} disabled={busy} onClick={onMarkPaid}>
              {busy ? "Saving…" : "✓ Mark Paid"}
            </button>
          )}
        </div>
      )}

      <div className="source-tag">📎 {inv.source_ref || 'invoice'}</div>
    </div>
  )
}
