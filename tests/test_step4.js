// Step 4 Test: Owner confirmation of visits
process.env.NODE_ENV = 'test'
import { initDb, getTenantCollection } from '../db.js'

async function runTests() {
  console.log('Testing Step 4: Owner confirmation of visits...\n')

  const { db, Timestamp } = await initDb()
  const tenantId = 'das-cooling-services'
  const col = (s) => getTenantCollection(db, tenantId, s)

  // Find a scheduled visit for today
  const today = new Date().toISOString().split('T')[0]
  const visitsSnap = await col('visits').where('scheduled_date', '==', today).get()
  const scheduledVisit = visitsSnap.docs.find(d => d.data().status === 'scheduled')

  if (!scheduledVisit) throw new Error('No scheduled visit found for today')
  const visitId = scheduledVisit.id
  console.log(`Found scheduled visit for: ${scheduledVisit.data().client_name} (ID: ${visitId})`)

  // 1. Technician submits a voice note update
  console.log('1. Simulating technician submitting voice note update...')
  const techUpdate = {
    summary_english: '4 split ACs serviced, 2 pending. 1 gas top-up done on unit 3.',
    units_serviced: [{ type: 'Split AC', quantity: 4 }],
    units_pending: [{ type: 'Split AC', quantity: 2 }],
    extra_work: [{ item: 'Gas top-up (R32)', quantity: 1 }],
    source_ref: 'technician-audio-note.webm',
    submitted_by: 'technician',
  }

  // Update visit to pending_confirmation
  await col('visits').doc(visitId).update({
    status: 'pending_confirmation',
    pending_update: {
      ...techUpdate,
      submitted_at: Timestamp.now(),
    },
    updated_at: Timestamp.now(),
  })
  await col('audit_log').add({
    action: 'visit_update_submitted',
    visit_id: visitId,
    who: 'technician',
    created_at: Timestamp.now(),
  })

  // Verify status is pending_confirmation, NOT done!
  const visitAfterTech = (await col('visits').doc(visitId).get()).data()
  console.log('   Visit status after tech submission:', visitAfterTech.status)
  if (visitAfterTech.status !== 'pending_confirmation') {
    throw new Error(`Expected status 'pending_confirmation', got: ${visitAfterTech.status}`)
  }
  if (!visitAfterTech.pending_update) {
    throw new Error('Expected pending_update object on visit')
  }
  console.log('   ✓ Visit is in pending_confirmation status, NOT marked done yet!\n')

  // 2. Owner confirms the visit
  console.log('2. Simulating owner confirming the visit...')
  await col('visits').doc(visitId).update({
    status: 'done',
    confirmed_by: 'owner',
    confirmed_at: Timestamp.now(),
    job_summary: visitAfterTech.pending_update.summary_english,
    updated_at: Timestamp.now(),
  })
  await col('audit_log').add({
    action: 'visit_confirmed',
    visit_id: visitId,
    who: 'owner',
    created_at: Timestamp.now(),
  })

  // Verify visit is now marked done with owner confirmation
  const visitAfterOwner = (await col('visits').doc(visitId).get()).data()
  console.log('   Visit status after owner confirmation:', visitAfterOwner.status)
  console.log('   Confirmed by:', visitAfterOwner.confirmed_by)
  console.log('   Job summary:', visitAfterOwner.job_summary)

  if (visitAfterOwner.status !== 'done') {
    throw new Error(`Expected status 'done', got: ${visitAfterOwner.status}`)
  }
  if (visitAfterOwner.confirmed_by !== 'owner') {
    throw new Error(`Expected confirmed_by 'owner', got: ${visitAfterOwner.confirmed_by}`)
  }

  // 3. Verify audit log has both entries
  const auditSnap = await col('audit_log').get()
  const auditEntries = auditSnap.docs.map(d => d.data())
  const techEntry = auditEntries.find(a => a.action === 'visit_update_submitted' && a.visit_id === visitId)
  const ownerEntry = auditEntries.find(a => a.action === 'visit_confirmed' && a.visit_id === visitId)

  if (!techEntry) throw new Error('Missing visit_update_submitted audit entry')
  if (!ownerEntry) throw new Error('Missing visit_confirmed audit entry')
  console.log('   ✓ Audit log entries verified for technician submit and owner confirm!')

  console.log('\n🎉 ALL STEP 4 TESTS PASSED!')
  process.exit(0)
}

runTests().catch(e => {
  console.error('\n❌ Test failed:', e)
  process.exit(1)
})
