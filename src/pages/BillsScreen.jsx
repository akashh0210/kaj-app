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
import { Check, CheckCheck, Clock, Copy, MessageSquare, Paperclip, Pencil, Send, TriangleAlert } from 'lucide-react'
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
  const [sentIds, setSentIds] = useState(() => new Set()) // display only: reminders marked sent this session
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
      showToast('Marked as paid')
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
      showToast('Reminder edited')
    } catch (e) {
      showToast('Edit failed: ' + e.message)
    }
  }

  async function handleCopyMessage(text) {
    const textToCopy = text ?? (editEnglish || draftData?.message_english || '')
    try {
      await navigator.clipboard.writeText(textToCopy)
      showToast('Message copied')
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
      showToast('Marked as sent')
      setSentIds(prev => new Set(prev).add(reminderModal.id))
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
      showToast('Price set')
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
      <h2 className="page-title" style={{ marginBottom: 12 }}>Bills and payments</h2>

      {loading ? <div className="spinner" /> : loadError ? <LoadError message={loadError} onRetry={load} /> : (
        <>
          {/* Unbilled extras (bill lines from voice notes) */}
          {unbilledExtras.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div className="section-header"><h2>Unbilled extras from visits ({unbilledExtras.length})</h2></div>
              {unbilledExtras.map(extra => (
                <div key={extra.id} className="card" style={extra.needs_owner_pricing ? { borderLeft: '3px solid var(--amber)' } : undefined}>
                  <div className="card-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="card-title">{extra.client_name}</div>
                      <div className="card-sub">{extra.item || extra.description} × {extra.quantity || 1}</div>
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <StatusPill status="draft" />
                        {extra.needs_owner_pricing ? (
                          <span className="pill pill-amber">Not on rate card: owner price needed</span>
                        ) : extra.unit_price != null ? (
                          <span className="pill pill-quiet tabular">Rate {formatRs(extra.unit_price)}/unit</span>
                        ) : null}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="card-amount">
                        {extra.amount !== null ? formatRs(extra.amount) : <span style={{ color: 'var(--amber)' }}>Needs price</span>}
                      </div>
                      <div className="card-sub">{extra.gst_extra ? '+GST' : 'incl. GST'}</div>
                    </div>
                  </div>

                  {extra.needs_owner_pricing && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {pricingId === extra.id ? (
                        <>
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            aria-label={`Price in rupees for ${extra.item || extra.description}`}
                            className="input"
                            style={{ width: 140 }}
                            placeholder="Price in Rs"
                            value={customPrice}
                            onChange={e => setCustomPrice(e.target.value)}
                          />
                          <button className="btn btn-primary btn-sm" disabled={busyId === extra.id} onClick={() => handleSavePrice(extra.id)}>{busyId === extra.id ? 'Saving…' : 'Save'}</button>
                          <button className="btn btn-outline btn-sm" onClick={() => { setPricingId(null); setCustomPrice('') }}>Cancel</button>
                        </>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => { setPricingId(extra.id); setCustomPrice('') }}>
                          <Pencil size={14} aria-hidden="true" />Set price
                        </button>
                      )}
                    </div>
                  )}

                  <div className="source-tag"><Paperclip size={14} aria-hidden="true" />Source: {extra.source_ref}</div>
                </div>
              ))}
            </div>
          )}

          {overdue.length > 0 && (
            <>
              <div className="section-header"><h2>Overdue invoices ({overdue.length})</h2></div>
              {overdue.map(inv => <InvoiceCard key={inv.id} inv={inv} sent={sentIds.has(inv.id)} onReminder={() => handleDraftReminder(inv)} onMarkPaid={() => handleMarkPaid(inv)} busy={busyId === inv.id} />)}
            </>
          )}

          {upcoming.length > 0 && (
            <>
              <div className="section-header"><h2>Upcoming invoices</h2></div>
              {upcoming.map(inv => <InvoiceCard key={inv.id} inv={inv} onMarkPaid={() => handleMarkPaid(inv)} busy={busyId === inv.id} />)}
            </>
          )}

          {paid.length > 0 && (
            <>
              <div className="section-header"><h2>Paid</h2></div>
              {paid.map(inv => <InvoiceCard key={inv.id} inv={inv} />)}
            </>
          )}

          {invoices.length === 0 && <div className="empty-state"><p>No invoices or bill lines yet.</p></div>}
        </>
      )}

      {/* Reminder sheet: message preview */}
      {reminderModal && (
        <div className="modal-overlay" onClick={() => { if (!approving && !sending) closeReminder() }}>
          <div className="modal-sheet" role="dialog" aria-modal="true" aria-labelledby="reminder-title" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="sheet-head">
              <div>
                <h3 id="reminder-title">Payment reminder</h3>
                <p className="card-sub tabular" style={{ marginTop: 2 }}>{reminderModal.invoice_no} · {draftData ? `${draftData.days_overdue} days overdue` : 'drafting'}</p>
              </div>
              {draftData && !draftLoading && <StatusPill status={approved ? 'approved' : 'draft'} />}
            </div>

            {draftLoading && <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /><p className="muted">Drafting with AI…</p></div>}

            {draftData && !draftLoading && (
              <>
                {draftData.owner_note && (
                  <section className="review-strip" aria-label="Owner note" style={{ marginBottom: 12 }}>
                    <h3><TriangleAlert size={16} aria-hidden="true" />Check before sending</h3>
                    <p>{draftData.owner_note}</p>
                  </section>
                )}

                {isEditingReminder ? (
                  <div style={{ marginBottom: 12 }}>
                    <label className="label" htmlFor="rem-en">English message</label>
                    <textarea id="rem-en" className="input" rows={5} value={editEnglish} onChange={e => setEditEnglish(e.target.value)} />
                    <label className="label" htmlFor="rem-bn" style={{ marginTop: 10 }}>Bengali message</label>
                    <textarea id="rem-bn" className="input" rows={5} lang="bn" value={editBengali} onChange={e => setEditBengali(e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => {
                        setEditEnglish(draftData.message_english || ''); setEditBengali(draftData.message_bengali || ''); setIsEditingReminder(false)
                      }}>Cancel</button>
                      <button className="btn btn-primary btn-sm" style={{ flex: 2 }} disabled={!editEnglish.trim()} onClick={handleSaveReminderEdit}>Save changes</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Looks like the chat it will be sent in */}
                    <div className="chat" aria-label="Message preview">
                      <div className="chat-head">
                        <span className="chat-avatar" aria-hidden="true">{initials(reminderModal.client_name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="chat-name">{reminderModal.client_name}</div>
                          <div className="chat-phone tabular">{draftData.client_phone || 'No phone number stored: copy and send yourself'}</div>
                        </div>
                      </div>
                      <div className="chat-body">
                        <div className="bubble">
                          <div className="bubble-lang">English</div>
                          {draftData.message_english}
                          <div className="bubble-meta">{approved ? 'Approved' : 'Draft'}<CheckCheck size={14} className={approved ? 'read' : ''} aria-hidden="true" /></div>
                        </div>
                        {draftData.message_bengali && (
                          <div className="bubble" lang="bn">
                            <div className="bubble-lang" lang="en">Bengali</div>
                            {draftData.message_bengali}
                            <div className="bubble-meta" lang="en">{approved ? 'Approved' : 'Draft'}<CheckCheck size={14} className={approved ? 'read' : ''} aria-hidden="true" /></div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      {!approved && <button className="btn btn-outline btn-sm" onClick={() => setIsEditingReminder(true)}><Pencil size={14} aria-hidden="true" />Edit</button>}
                      <button className="btn btn-outline btn-sm" onClick={() => handleCopyMessage(draftData.message_english)}><Copy size={14} aria-hidden="true" />Copy English</button>
                      {draftData.message_bengali && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleCopyMessage(draftData.message_bengali)}><Copy size={14} aria-hidden="true" />Copy Bengali</button>
                      )}
                    </div>
                  </>
                )}

                {/* Guardrail: remind owner to send only 09:00–20:00 IST */}
                <p className="send-window"><Clock size={16} aria-hidden="true" />Please send only between 09:00 and 20:00 IST.</p>

                {!approved ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-outline" style={{ flex: 1 }} onClick={closeReminder}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} disabled={approving || isEditingReminder} onClick={handleApprove}>
                      {approving ? 'Approving…' : <><Check size={18} aria-hidden="true" />{draftData.client_phone ? 'Approve and open WhatsApp' : 'Approve'}</>}
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="success-box">
                      {waLink
                        ? 'WhatsApp opened. After sending, tap Mark as sent.'
                        : 'Approved. No phone number is stored for this client: copy the message above, send it yourself, then tap Mark as sent.'}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {waLink && <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => window.open(waLink, '_blank')}><Send size={16} aria-hidden="true" />Re-open WhatsApp</button>}
                      <button className="btn btn-primary" style={{ flex: 2 }} disabled={sending} onClick={handleMarkSent}>
                        {sending ? 'Saving…' : <><Check size={18} aria-hidden="true" />Mark as sent</>}
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

function initials(name = '') {
  return name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

// Draft, Approved, Sent, Paid (plus Overdue, which is about money)
function StatusPill({ status }) {
  const map = {
    draft: ['pill pill-amber', 'Draft'],
    approved: ['pill pill-blue', 'Approved'],
    sent: ['pill pill-blue', 'Reminder sent'],
    paid: ['pill pill-blue', 'Paid'],
  }
  const [cls, label] = map[status] || ['pill pill-quiet', status]
  return <span className={cls}>{label}</span>
}

function InvoiceCard({ inv, onReminder, onMarkPaid, busy, sent }) {
  const isPaid = inv.status === 'paid'
  const isOverdue = !isPaid && inv.days_overdue > 0
  return (
    <div className="card" style={isOverdue ? { borderLeft: '3px solid var(--red)' } : undefined}>
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">{inv.client_name}</div>
          <div className="card-sub tabular">{inv.invoice_no}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isOverdue && <span className="pill pill-red tabular"><span className="pill-dot" aria-hidden="true" />{inv.days_overdue} days overdue</span>}
            {!isPaid && inv.days_overdue === 0 && <span className="pill pill-quiet tabular">Due {inv.due_date}</span>}
            {isPaid && <StatusPill status="paid" />}
            {sent && !isPaid && <StatusPill status="sent" />}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className={`card-amount${isOverdue ? ' overdue' : ''}`}>Rs {Number(inv.amount).toLocaleString('en-IN')}</div>
          <div className="card-sub">{inv.gst_extra ? '+GST' : 'incl. GST'}</div>
        </div>
      </div>

      {!isPaid && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {onReminder && inv.days_overdue > 0 && (
            <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={onReminder}>
              <MessageSquare size={16} aria-hidden="true" />Draft reminder
            </button>
          )}
          {onMarkPaid && (
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={busy} onClick={onMarkPaid}>
              {busy ? 'Saving…' : <><Check size={16} aria-hidden="true" />Mark paid</>}
            </button>
          )}
        </div>
      )}

      <div className="source-tag"><Paperclip size={14} aria-hidden="true" />{inv.source_ref || 'invoice'}</div>
    </div>
  )
}
