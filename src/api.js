// API client helpers – all calls go through the Express /api backend
// Tenant ID is sent as a header on every request (guardrail: data scoped by tenant)

const TENANT_ID = import.meta.env.VITE_TENANT_ID || 'das-cooling-services'

function headers(extra = {}) {
  return {
    'x-tenant-id': TENANT_ID,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function handleResponse(res) {
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

// --- Dashboard ---
export async function fetchDashboard() {
  return handleResponse(await fetch('/api/dashboard', { headers: headers() }))
}

export async function fetchDigest() {
  return handleResponse(await fetch('/api/digest', { headers: headers() }))
}

// --- Contracts ---
export async function fetchContracts() {
  return handleResponse(await fetch('/api/contracts', { headers: headers() }))
}

export async function extractContractText(text) {
  return handleResponse(await fetch('/api/contracts/extract', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ text }),
  }))
}

export async function extractContractFile(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/contracts/extract', {
    method: 'POST',
    headers: { 'x-tenant-id': TENANT_ID }, // no Content-Type; multipart
    body: form,
  })
  return handleResponse(res)
}

export async function confirmContract(data) {
  return handleResponse(await fetch('/api/contracts', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  }))
}

export async function editContractField(id, updates) {
  return handleResponse(await fetch(`/api/contracts/${id}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(updates),
  }))
}

// --- Visits ---
export async function fetchVisits(date) {
  const q = date ? `?date=${date}` : ''
  return handleResponse(await fetch(`/api/visits${q}`, { headers: headers() }))
}

export async function submitVisitUpdate(id, updateData) {
  return handleResponse(await fetch(`/api/visits/${id}/submit-update`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(updateData),
  }))
}

export async function confirmVisit(id, { confirmed_by, job_summary } = {}) {
  return handleResponse(await fetch(`/api/visits/${id}/confirm`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ confirmed_by, job_summary }),
  }))
}

export async function submitVoiceUpdate(visitId, audioBlob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  const res = await fetch(`/api/visits/${visitId}/voice-update`, {
    method: 'POST',
    headers: { 'x-tenant-id': TENANT_ID },
    body: form,
  })
  return handleResponse(res)
}

// --- Invoices ---
export async function fetchInvoices() {
  return handleResponse(await fetch('/api/invoices', { headers: headers() }))
}

export async function markInvoicePaid(id, who = 'owner') {
  return handleResponse(await fetch(`/api/invoices/${id}/mark-paid`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ who }),
  }))
}

// --- Reminders ---
export async function draftReminder(payload) {
  return handleResponse(await fetch('/api/reminders/draft', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  }))
}

export async function approveReminder(id, approved_by = 'owner') {
  return handleResponse(await fetch(`/api/reminders/${id}/approve`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ approved_by }),
  }))
}

export async function markReminderSent(id) {
  return handleResponse(await fetch(`/api/reminders/${id}/mark-sent`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ who: 'owner' }),
  }))
}
