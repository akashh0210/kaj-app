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
  const [waLink, setWaLink] = useState(null)

  async function load() {
    setLoading(true)
    try { setInvoices(await fetchInvoices()) } catch (e) { showToast('Error: ' + e.message) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleMarkPaid(inv) {
    try {
      await markInvoicePaid(inv.id)
      showToast('Marked as paid ✓')
      await load()
    } catch (e) { showToast('Error: ' + e.message) }
  }

  const [isEditingReminder, setIsEditingReminder] = useState(false)
  const [editEnglish, setEditEnglish] = useState('')
  const [editBengali, setEditBengali] = useState('')

  async function handleDraftReminder(inv) {
    setReminderModal(inv)
    setDraftLoading(true)
    setDraftData(null)
    setWaLink(null)
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

  function handleCopyMessage() {
    const textToCopy = editEnglish || draftData?.message_english || ''
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => showToast('Message copied to clipboard ✓'))
        .catch(() => showToast('Copied to clipboard ✓'))
    } else {
      showToast('Copied to clipboard ✓')
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
    if (!draftData?.id) return
    await markReminderSent(draftData.id)
    showToast('Marked as sent ✓')
    setReminderModal(null)
    setDraftData(null)
    await load()
  }

  const [pricingId, setPricingId] = useState(null)
  const [customPrice, setCustomPrice] = useState('')

  async function handleSavePrice(invId) {
    if (!customPrice || isNaN(customPrice)) return showToast('Enter a valid price')
    try {
      await setExtraPrice(invId, { unit_price: Number(customPrice), quantity: 1 })
      showToast('Price set ✓')
      setPricingId(null)
      setCustomPrice('')
      await load()
    } catch (e) {
      showToast('Error: ' + e.message)
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

      {loading ? <div className="spinner" /> : (
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
                      ) : (
                        <div style={{ marginTop: 4 }}>
                          <span className="badge badge-primary">Rate: {formatRs(extra.unit_price)}/unit</span>
                        </div>
                      )}
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
                            className="input"
                            style={{ width: 120, padding: '4px 8px', fontSize: '.85rem' }}
                            placeholder="Price in Rs"
                            value={customPrice}
                            onChange={e => setCustomPrice(e.target.value)}
                          />
                          <button className="btn btn-success btn-sm" onClick={() => handleSavePrice(extra.id)}>Save</button>
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
              {overdue.map(inv => <InvoiceCard key={inv.id} inv={inv} onReminder={() => handleDraftReminder(inv)} onMarkPaid={() => handleMarkPaid(inv)} />)}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <div className="section-header" style={{ marginTop: 8 }}><h2>Upcoming Invoices</h2></div>
              {upcoming.map(inv => <InvoiceCard key={inv.id} inv={inv} onMarkPaid={() => handleMarkPaid(inv)} />)}
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
        <div className="modal-overlay" onClick={() => { setReminderModal(null); setDraftData(null) }}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 style={{ marginBottom: 4 }}>Payment Reminder</h3>
            <p style={{ fontSize: '.8rem', color: 'var(--gray-500)', marginBottom: 14 }}>{reminderModal.client_name} · {reminderModal.invoice_no}</p>

            {draftLoading && <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /><p style={{ marginTop: 8 }}>Drafting with AI…</p></div>}

            {draftData && !draftLoading && (
              <>
                {draftData.owner_note && (
                  <div className="review-strip" style={{ marginBottom: 12 }}>
                    <h3>Owner note</h3>
                    <p style={{ fontSize: '.8rem', color: '#78350f' }}>{draftData.owner_note}</p>
                  </div>
                )}

                <div style={{ marginBottom: 12 }}>
                  <label className="label">English message</label>
                  <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 10, fontSize: '.85rem', color: 'var(--gray-800)', lineHeight: 1.5 }}>
                    {draftData.message_english}
                  </div>
                </div>

                {draftData.message_bengali && (
                  <div style={{ marginBottom: 12 }}>
                    <label className="label">Bengali message</label>
                    <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 10, fontSize: '.85rem', color: 'var(--gray-800)', lineHeight: 1.5 }}>
                      {draftData.message_bengali}
                    </div>
                  </div>
                )}

                <p style={{ fontSize: '.75rem', color: 'var(--gray-500)', marginBottom: 12 }}>
                  Days overdue: <strong>{draftData.days_overdue}</strong>
                </p>

                {/* Guardrail: remind owner to send only 09:00–20:00 IST */}
                <div className="review-strip" style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: '.75rem', color: '#78350f' }}>⏰ Please send only between 09:00 and 20:00 IST.</p>
                </div>

                {!waLink ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setReminderModal(null); setDraftData(null) }}>Cancel</button>
                    <button className="btn btn-success" style={{ flex: 2 }} disabled={approving} onClick={handleApprove}>
                      {approving ? 'Approving…' : '✓ Approve & Open WhatsApp'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="success-box">WhatsApp opened. After sending, tap below.</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => window.open(waLink, '_blank')}>Re-open WhatsApp</button>
                      <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleMarkSent}>✓ Mark as Sent</button>
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

function InvoiceCard({ inv, onReminder, onMarkPaid }) {
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
            <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={onMarkPaid}>
              ✓ Mark Paid
            </button>
          )}
        </div>
      )}

      <div className="source-tag">📎 {inv.source_ref || 'invoice'}</div>
    </div>
  )
}
