// Seed script: Populates Firestore with demo data for Das Cooling Services.
// Run once: node scripts/seed.js
// Demo data: 1 provider, 5 contracts, 8 visits, 3 invoices (1 overdue 36+ days), 1 renewal in 30 days.

import 'dotenv/config'
import { initDb, getTenantCollection } from '../db.js'

const { db, Timestamp } = await initDb()

const TENANT_ID = process.env.TENANT_ID || 'das-cooling-services'

function col(...segments) {
  return getTenantCollection(db, TENANT_ID, ...segments)
}

function ts(dateStr) {
  return Timestamp.fromDate(new Date(dateStr))
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

async function seed() {
  console.log(`Seeding tenant: ${TENANT_ID}`)

  // ── Contracts (5) ─────────────────────────────────────────────────────────
  const contracts = [
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/2026/001',
      client_name: 'Greenview Housing Society',
      site_address: 'Block C, Greenview Society, Salt Lake, Kolkata 700091',
      equipment: [{ type: 'Split AC', capacity: '1.5 ton', quantity: 6 }],
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      visit_frequency: 'quarterly',
      visit_schedule: ['2026-04-01', '2026-07-01', '2026-10-01', '2027-01-01'],
      contract_value: 38500,
      gst_extra: true,
      payment_terms: 'Quarterly advance',
      renewal_reminder_date: '2027-03-01',
      extras_chargeable: true,
      needs_review: [],
      status: 'confirmed',
      source_ref: 'DCS-2026-001.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-04-01'),
    },
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/2026/002',
      client_name: 'Sunrise Office Park',
      site_address: '5th Floor, Sunrise Tower, Sector V, Kolkata 700156',
      equipment: [
        { type: 'Cassette AC', capacity: '2 ton', quantity: 4 },
        { type: 'Split AC', capacity: '1 ton', quantity: 2 },
      ],
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      visit_frequency: 'monthly',
      visit_schedule: [
        '2026-01-01','2026-02-01','2026-03-01','2026-04-01','2026-05-01','2026-06-01',
        '2026-07-01','2026-08-01','2026-09-01','2026-10-01','2026-11-01','2026-12-01',
      ],
      contract_value: 54000,
      gst_extra: true,
      payment_terms: 'Monthly',
      renewal_reminder_date: daysFromNow(12), // renewal coming soon
      extras_chargeable: true,
      needs_review: [],
      status: 'confirmed',
      source_ref: 'DCS-2026-002.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-01-01'),
    },
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/2026/003',
      client_name: 'City Hospital',
      site_address: 'Ward Block A, City Hospital, EM Bypass, Kolkata 700099',
      equipment: [{ type: 'Central AC', capacity: '5 ton', quantity: 2 }],
      start_date: '2026-06-01',
      end_date: '2027-05-31',
      visit_frequency: 'monthly',
      visit_schedule: [
        '2026-06-01','2026-07-01','2026-08-01','2026-09-01','2026-10-01','2026-11-01','2026-12-01',
        '2027-01-01','2027-02-01','2027-03-01','2027-04-01','2027-05-01',
      ],
      contract_value: 72000,
      gst_extra: true,
      payment_terms: 'Bi-annual',
      renewal_reminder_date: '2027-05-01',
      extras_chargeable: false,
      needs_review: [],
      status: 'confirmed',
      source_ref: 'DCS-2026-003.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-06-01'),
    },
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/2026/004',
      client_name: 'Metro Mall',
      site_address: 'Ground Floor, Metro Mall, Rajarhat, Kolkata 700136',
      equipment: [{ type: 'VRF System', capacity: '10 ton', quantity: 1 }],
      start_date: '2026-03-01',
      end_date: '2027-02-28',
      visit_frequency: 'half-yearly',
      visit_schedule: ['2026-03-01', '2026-09-01'],
      contract_value: 95000,
      gst_extra: true,
      payment_terms: 'Advance',
      renewal_reminder_date: '2027-01-27',
      extras_chargeable: true,
      needs_review: [],
      status: 'confirmed',
      source_ref: 'DCS-2026-004.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-03-01'),
    },
    {
      provider_name: 'Das Cooling Services',
      contract_no: 'DCS/2026/005',
      client_name: 'Sen Air Solutions Office',
      site_address: '2nd Floor, Rabindra Sarani, Kolkata 700003',
      equipment: [{ type: 'Window AC', capacity: '1.5 ton', quantity: 3 }],
      start_date: '2026-06-01',
      end_date: null,
      visit_frequency: 'quarterly',
      visit_schedule: ['2026-06-01', '2026-09-01', '2026-12-01', '2027-03-01'],
      contract_value: 18000,
      gst_extra: true,
      payment_terms: 'On visit',
      renewal_reminder_date: null,
      extras_chargeable: true,
      needs_review: [
        'Only one date given; assumed as start date, please confirm.',
        'end_date missing; renewal_reminder_date cannot be computed.',
      ],
      status: 'pending_review',
      source_ref: 'DCS-2026-005.pdf',
      tenant_id: TENANT_ID,
      created_at: ts('2026-06-01'),
    },
  ]

  for (const c of contracts) {
    await col('contracts').doc(c.contract_no.replace(/\//g, '-')).set(c)
    console.log('  Contract:', c.contract_no)
  }

  // ── Visits (8) ─────────────────────────────────────────────────────────────
  const todayStr = today()
  const visits = [
    {
      contract_no: 'DCS/2026/001',
      client_name: 'Greenview Housing Society',
      site_address: 'Block C, Greenview Society, Salt Lake, Kolkata 700091',
      scheduled_date: todayStr,
      status: 'scheduled',
      units: [{ type: 'Split AC', quantity: 6 }],
      technician: 'Raju Das',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
    {
      contract_no: 'DCS/2026/002',
      client_name: 'Sunrise Office Park',
      site_address: '5th Floor, Sunrise Tower, Sector V, Kolkata 700156',
      scheduled_date: todayStr,
      status: 'done',
      units: [{ type: 'Cassette AC', quantity: 4 }],
      technician: 'Bikash Sen',
      confirmed_by: 'owner',
      confirmed_at: ts(todayStr),
      job_summary: 'All 4 cassette units serviced, filters cleaned, gas checked.',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
    {
      contract_no: 'DCS/2026/003',
      client_name: 'City Hospital',
      site_address: 'Ward Block A, City Hospital, EM Bypass, Kolkata 700099',
      scheduled_date: todayStr,
      status: 'scheduled',
      units: [{ type: 'Central AC', quantity: 2 }],
      technician: 'Raju Das',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
    {
      contract_no: 'DCS/2026/001',
      client_name: 'Greenview Housing Society',
      site_address: 'Block C, Greenview Society, Salt Lake, Kolkata 700091',
      scheduled_date: daysAgo(7),
      status: 'done',
      units: [{ type: 'Split AC', quantity: 6 }],
      technician: 'Raju Das',
      confirmed_by: 'owner',
      confirmed_at: ts(daysAgo(7)),
      job_summary: 'Routine service, all units OK.',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
    {
      contract_no: 'DCS/2026/004',
      client_name: 'Metro Mall',
      site_address: 'Ground Floor, Metro Mall, Rajarhat, Kolkata 700136',
      scheduled_date: daysAgo(14),
      status: 'done',
      units: [{ type: 'VRF System', quantity: 1 }],
      technician: 'Bikash Sen',
      confirmed_by: 'owner',
      confirmed_at: ts(daysAgo(14)),
      job_summary: 'VRF system full service. One compressor cleaned.',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
    {
      contract_no: 'DCS/2026/002',
      client_name: 'Sunrise Office Park',
      site_address: '5th Floor, Sunrise Tower, Sector V, Kolkata 700156',
      scheduled_date: daysFromNow(1),
      status: 'scheduled',
      units: [{ type: 'Split AC', quantity: 2 }],
      technician: 'Raju Das',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
    {
      contract_no: 'DCS/2026/005',
      client_name: 'Sen Air Solutions Office',
      site_address: '2nd Floor, Rabindra Sarani, Kolkata 700003',
      scheduled_date: daysFromNow(3),
      status: 'scheduled',
      units: [{ type: 'Window AC', quantity: 3 }],
      technician: 'Raju Das',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
    {
      contract_no: 'DCS/2026/003',
      client_name: 'City Hospital',
      site_address: 'Ward Block A, City Hospital, EM Bypass, Kolkata 700099',
      scheduled_date: daysAgo(3),
      status: 'done',
      units: [{ type: 'Central AC', quantity: 2 }],
      technician: 'Bikash Sen',
      confirmed_by: 'owner',
      confirmed_at: ts(daysAgo(3)),
      job_summary: 'Monthly service done. Coil cleaned.',
      tenant_id: TENANT_ID,
      source_ref: 'visit-schedule',
    },
  ]

  for (let i = 0; i < visits.length; i++) {
    await col('visits').add(visits[i])
    console.log('  Visit:', visits[i].client_name, visits[i].scheduled_date)
  }

  // ── Invoices (3: 1 overdue 36 days, 1 overdue, 1 recent) ──────────────────
  const invoices = [
    {
      invoice_no: 'DCS/INV/2026/118',
      client_name: 'Greenview Housing Society',
      contract_no: 'DCS/2026/001',
      amount: 19250,
      gst_extra: true,
      due_date: daysAgo(36),
      status: 'overdue',
      is_extra: false,
      client_phone: '+919830012345',
      tenant_id: TENANT_ID,
      source_ref: 'invoice-generated',
      created_date: daysAgo(45),
      created_at: ts(daysAgo(45)),
    },
    {
      invoice_no: 'DCS/INV/2026/119',
      client_name: 'Sunrise Office Park',
      contract_no: 'DCS/2026/002',
      amount: 13500,
      gst_extra: true,
      due_date: daysAgo(10),
      status: 'overdue',
      is_extra: false,
      client_phone: '+919831023456',
      tenant_id: TENANT_ID,
      source_ref: 'invoice-generated',
      created_date: daysAgo(20),
      created_at: ts(daysAgo(20)),
    },
    {
      invoice_no: 'DCS/INV/2026/120',
      client_name: 'City Hospital',
      contract_no: 'DCS/2026/003',
      amount: 9000,
      gst_extra: true,
      due_date: daysFromNow(15),
      status: 'pending',
      is_extra: false,
      client_phone: '+919832034567',
      tenant_id: TENANT_ID,
      source_ref: 'invoice-generated',
      created_date: daysAgo(5),
      created_at: ts(daysAgo(5)),
    },
  ]

  for (const inv of invoices) {
    await col('invoices').doc(inv.invoice_no.replace(/\//g, '-')).set(inv)
    console.log('  Invoice:', inv.invoice_no)
  }

  console.log('\n✅ Seed complete! Tenant:', TENANT_ID)
  process.exit(0)
}

seed().catch(e => { console.error('Seed failed:', e); process.exit(1) })
