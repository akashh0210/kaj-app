// Seed script: Populates Firestore / local store with demo data from demo-data/KAJ_Demo_Data
// Contracts: C1, C2, C3 from AnswerKey.csv
// Invoices: I1, I2, I3 with exact due dates and amounts
// Rate card: JSON for extra work
// Visits: generated from contract schedules including today's visits and unbilled extras

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { initDb, getTenantCollection } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const { db, Timestamp } = await initDb()

const TENANT_ID = process.env.TENANT_ID || 'das-cooling-services'

function col(...segments) {
  return getTenantCollection(db, TENANT_ID, ...segments)
}

function ts(dateStr) {
  return Timestamp.fromDate(new Date(dateStr))
}

// India date (IST), matching the server's todayIST(); containers run in UTC.
function today() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0]
}

async function seed() {
  console.log(`Seeding demo data for tenant: ${TENANT_ID}`)
  const todayStr = today()

  // ── Clear existing collections to cleanly replace synthetic data ────────────
  for (const subcol of ['contracts', 'invoices', 'visits', 'rate_card', 'reminders', 'audit_log']) {
    const snap = await col(subcol).get()
    for (const doc of snap.docs) {
      await col(subcol).doc(doc.id).delete()
    }
  }
  console.log('✓ Cleared previous tenant collections')

  // ── Rate Card (JSON) ────────────────────────────────────────────────────────
  const rateCard = [
    { id: 'gas_top_up_r32', item: 'Gas top-up (R32)', price: 1800, unit: 'unit' },
    { id: 'filter_replacement', item: 'Filter replacement', price: 450, unit: 'unit' },
    { id: 'capacitor_replacement', item: 'Capacitor replacement', price: 650, unit: 'unit' },
    { id: 'jet_pump_wash', item: 'Jet-pump wash', price: 600, unit: 'unit' },
  ]

  for (const item of rateCard) {
    await col('rate_card').doc(item.id).set(item)
  }
  console.log('✓ Rate card saved (4 items)')

  // ── Contracts C1, C2, C3 (from AnswerKey.csv) ──────────────────────────────
  const contracts = [
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/AMC/2026/041',
      client_name: 'Greenview Housing Society',
      site_address: 'Block C, Salt Lake Sector II, Kolkata',
      equipment: [
        { type: 'Split AC', capacity: '1.5 ton', quantity: 6 },
        { type: 'Window AC', capacity: '1 ton', quantity: 2 },
      ],
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      visit_frequency: 'Quarterly',
      visit_schedule: ['2026-04-01', '2026-07-01', '2026-10-01', '2027-01-01'],
      contract_value: 38500,
      gst_extra: true,
      payment_terms: '50% advance, balance within 30 days of the second visit',
      renewal_reminder_date: '2027-03-01',
      extras_chargeable: true,
      needs_review: [],
      status: 'confirmed',
      source_ref: 'C1_greenview.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-04-01'),
    },
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/AMC/2026/052',
      client_name: 'Ballygunge Dental Clinic',
      site_address: '12 Ballygunge Place, Kolkata',
      equipment: [
        { type: 'Split AC', capacity: '2 ton', quantity: 3 },
      ],
      start_date: '2026-06-01',
      end_date: null,
      visit_frequency: 'Monthly',
      visit_schedule: [
        '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01',
        '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01', '2027-05-01',
      ],
      contract_value: 54000,
      gst_extra: true,
      payment_terms: 'Quarterly in advance',
      renewal_reminder_date: null,
      extras_chargeable: true,
      needs_review: [
        'Only one date given; assumed as start date, please confirm.',
        'end_date missing; renewal_reminder_date cannot be computed.',
      ],
      status: 'pending_review',
      source_ref: 'C2_ballygunge_dental.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-06-01'),
    },
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/AMC/2026/063',
      client_name: 'Park Street Flavours Cafe',
      site_address: '24 Park Street, Kolkata',
      equipment: [
        { type: 'Cassette AC', capacity: '2 ton', quantity: 4 },
      ],
      start_date: '2026-07-01',
      end_date: '2027-06-30',
      visit_frequency: 'Half-yearly',
      visit_schedule: ['2026-07-01', '2027-01-01'],
      contract_value: 26000,
      gst_extra: true,
      payment_terms: '100% advance',
      renewal_reminder_date: '2027-05-31',
      extras_chargeable: true,
      needs_review: [],
      status: 'confirmed',
      source_ref: 'C3_parkstreet_cafe.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-07-01'),
    },
  ]

  for (const c of contracts) {
    const docId = c.contract_no.replace(/\//g, '-')
    await col('contracts').doc(docId).set(c)
    console.log('✓ Contract:', c.contract_no, '-', c.client_name)
  }

  // ── Invoices I1, I2, I3 (from demo data & AnswerKey.csv) ───────────────────
  const invoices = [
    {
      invoice_no: 'DCS/INV/2026/118',
      client_name: 'Greenview Housing Society',
      contract_no: 'DCS/AMC/2026/041',
      amount: 19250,
      gst_extra: true,
      due_date: '2026-10-15', // 36 days overdue on 2026-11-20
      status: 'overdue',
      is_extra: false,
      client_phone: '+919830012345',
      tenant_id: TENANT_ID,
      source_ref: 'I1_greenview.pdf',
      created_date: '2026-09-15',
      created_at: ts('2026-09-15'),
    },
    {
      invoice_no: 'DCS/INV/2026/131',
      client_name: 'Park Street Flavours Cafe',
      contract_no: 'DCS/AMC/2026/063',
      amount: 13000,
      gst_extra: true,
      due_date: '2026-11-10', // 10 days overdue on 2026-11-20
      status: 'overdue',
      is_extra: false,
      client_phone: '+919831023456',
      tenant_id: TENANT_ID,
      source_ref: 'I2_parkstreet_cafe.pdf',
      created_date: '2026-10-27',
      created_at: ts('2026-10-27'),
    },
    {
      invoice_no: 'DCS/INV/2026/140',
      client_name: 'New Town IT Office (Brightlane Technologies)',
      contract_no: 'DCS/AMC/2026/007',
      amount: 18000,
      gst_extra: true,
      due_date: '2026-11-30', // not yet due (10 days left on 2026-11-20)
      status: 'pending',
      is_extra: false,
      client_phone: '+919832034567',
      tenant_id: TENANT_ID,
      source_ref: 'I3_newtown_office.pdf',
      created_date: '2026-11-15',
      created_at: ts('2026-11-15'),
    },
  ]

  for (const inv of invoices) {
    const docId = inv.invoice_no.replace(/\//g, '-')
    await col('invoices').doc(docId).set(inv)
    console.log('✓ Invoice:', inv.invoice_no, '- Due:', inv.due_date, 'Rs', inv.amount)
  }

  // ── Unbilled Extras (Draft bill lines from V1 & V2 extra work) ─────────────
  const unbilledExtras = [
    {
      invoice_no: 'DRAFT-EXTRA-001',
      client_name: 'Greenview Housing Society',
      contract_no: 'DCS/AMC/2026/041',
      description: 'Gas top-up (R32) x1 unit',
      extra_items: [{ item: 'Gas top-up (R32)', quantity: 1, unit_price: 1800, amount: 1800 }],
      amount: 1800,
      gst_extra: true,
      status: 'draft',
      is_extra: true,
      source_ref: 'voice-note-V1',
      tenant_id: TENANT_ID,
      created_date: todayStr,
      created_at: ts(todayStr),
    },
    {
      invoice_no: 'DRAFT-EXTRA-002',
      client_name: 'Park Street Flavours Cafe',
      contract_no: 'DCS/AMC/2026/063',
      description: 'Filter replacement x1 unit',
      extra_items: [{ item: 'Filter replacement', quantity: 1, unit_price: 450, amount: 450 }],
      amount: 450,
      gst_extra: true,
      status: 'draft',
      is_extra: true,
      source_ref: 'voice-note-V2',
      tenant_id: TENANT_ID,
      created_date: todayStr,
      created_at: ts(todayStr),
    },
  ]

  for (const extra of unbilledExtras) {
    await col('invoices').doc(extra.invoice_no).set(extra)
    console.log('✓ Unbilled Extra:', extra.invoice_no, '-', extra.description)
  }

  // ── Visits generated from contract schedules ───────────────────────────────
  // Includes visits scheduled for today so "Visits due today" card shows real visits
  const visits = [
    // Today's scheduled visits
    {
      contract_no: 'DCS/AMC/2026/041',
      client_name: 'Greenview Housing Society',
      site_address: 'Block C, Salt Lake Sector II, Kolkata',
      scheduled_date: todayStr,
      status: 'scheduled',
      units: [
        { type: 'Split AC', quantity: 6 },
        { type: 'Window AC', quantity: 2 },
      ],
      technician: 'Raju Das',
      tenant_id: TENANT_ID,
      source_ref: 'C1_greenview.pdf',
    },
    {
      contract_no: 'DCS/AMC/2026/052',
      client_name: 'Ballygunge Dental Clinic',
      site_address: '12 Ballygunge Place, Kolkata',
      scheduled_date: todayStr,
      status: 'scheduled',
      units: [{ type: 'Split AC', quantity: 3 }],
      technician: 'Bikash Sen',
      tenant_id: TENANT_ID,
      source_ref: 'C2_ballygunge_dental.pdf',
    },
    // Past completed visits with job summaries
    {
      contract_no: 'DCS/AMC/2026/041',
      client_name: 'Greenview Housing Society',
      site_address: 'Block C, Salt Lake Sector II, Kolkata',
      scheduled_date: '2026-10-01',
      status: 'done',
      units: [
        { type: 'Split AC', quantity: 6 },
        { type: 'Window AC', quantity: 2 },
      ],
      technician: 'Raju Das',
      confirmed_by: 'owner',
      confirmed_at: ts('2026-10-01'),
      job_summary: '4 split ACs serviced, 2 split ACs pending. 1 gas top-up done on unit 3.',
      tenant_id: TENANT_ID,
      source_ref: 'voice-note-V1',
    },
    {
      contract_no: 'DCS/AMC/2026/063',
      client_name: 'Park Street Flavours Cafe',
      site_address: '24 Park Street, Kolkata',
      scheduled_date: '2026-07-01',
      status: 'done',
      units: [{ type: 'Cassette AC', quantity: 4 }],
      technician: 'Bikash Sen',
      confirmed_by: 'owner',
      confirmed_at: ts('2026-07-01'),
      job_summary: 'All 4 cassette units serviced. Replaced 1 air filter as requested.',
      tenant_id: TENANT_ID,
      source_ref: 'voice-note-V2',
    },
    {
      contract_no: 'DCS/AMC/2026/052',
      client_name: 'Ballygunge Dental Clinic',
      site_address: '12 Ballygunge Place, Kolkata',
      scheduled_date: '2026-10-01',
      status: 'done',
      units: [{ type: 'Split AC', quantity: 3 }],
      technician: 'Raju Das',
      confirmed_by: 'owner',
      confirmed_at: ts('2026-10-01'),
      job_summary: 'Routine monthly service on 3 split units completed.',
      tenant_id: TENANT_ID,
      source_ref: 'voice-note-V4',
    },
    // Future visits from schedule
    {
      contract_no: 'DCS/AMC/2026/041',
      client_name: 'Greenview Housing Society',
      site_address: 'Block C, Salt Lake Sector II, Kolkata',
      scheduled_date: '2027-01-01',
      status: 'scheduled',
      units: [
        { type: 'Split AC', quantity: 6 },
        { type: 'Window AC', quantity: 2 },
      ],
      technician: 'Raju Das',
      tenant_id: TENANT_ID,
      source_ref: 'C1_greenview.pdf',
    },
    {
      contract_no: 'DCS/AMC/2026/063',
      client_name: 'Park Street Flavours Cafe',
      site_address: '24 Park Street, Kolkata',
      scheduled_date: '2027-01-01',
      status: 'scheduled',
      units: [{ type: 'Cassette AC', quantity: 4 }],
      technician: 'Bikash Sen',
      tenant_id: TENANT_ID,
      source_ref: 'C3_parkstreet_cafe.pdf',
    },
  ]

  for (const v of visits) {
    const docId = `${v.contract_no.replace(/\//g, '-')}_${v.scheduled_date}`
    await col('visits').doc(docId).set(v)
    console.log('✓ Visit:', v.client_name, '-', v.scheduled_date, `[${v.status}]`)
  }

  console.log('\n✅ Demo seed complete!')
  process.exit(0)
}

seed().catch(e => {
  console.error('Seed failed:', e)
  process.exit(1)
})
