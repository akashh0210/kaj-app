// Step 3 Test: Contract extraction end to end
process.env.NODE_ENV = 'test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractContract, extractTextFromPdf } from '../server.js'
import { initDb, getTenantCollection } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

async function runTests() {
  console.log('Testing Step 3: Contract extraction end to end...\n')

  const { db, Timestamp } = await initDb()
  const tenantId = 'das-cooling-services'
  const col = (s) => getTenantCollection(db, tenantId, s)

  // 1. Test C1 (expect no flags)
  console.log('1. Testing extraction for C1 (Greenview Housing Society)...')
  const c1Path = path.join(ROOT, 'demo-data', 'KAJ_Demo_Data', 'C1_greenview.pdf')
  const c1Text = extractTextFromPdf(c1Path)
  const c1Buffer = fs.readFileSync(c1Path).toString('base64')
  const c1 = await extractContract(c1Buffer, 'application/pdf', c1Text)

  console.log('   Contract No:', c1.contract_no)
  console.log('   Client:', c1.client_name)
  console.log('   Start Date:', c1.start_date)
  console.log('   End Date:', c1.end_date)
  console.log('   Renewal Reminder:', c1.renewal_reminder_date)
  console.log('   Visits:', c1.visit_schedule)
  console.log('   Flags in needs_review:', c1.needs_review)

  if (c1.contract_no !== 'DCS/AMC/2026/041') throw new Error(`C1 contract_no mismatch: ${c1.contract_no}`)
  if (c1.client_name !== 'Greenview Housing Society') throw new Error(`C1 client_name mismatch: ${c1.client_name}`)
  if (c1.start_date !== '2026-04-01') throw new Error(`C1 start_date mismatch: ${c1.start_date}`)
  if (c1.end_date !== '2027-03-31') throw new Error(`C1 end_date mismatch: ${c1.end_date}`)
  if (c1.renewal_reminder_date !== '2027-03-01') throw new Error(`C1 renewal mismatch: ${c1.renewal_reminder_date}`)
  if (c1.visit_schedule.length !== 4) throw new Error(`C1 visit schedule length mismatch: ${c1.visit_schedule.length}`)
  if (c1.needs_review.length !== 0) throw new Error(`C1 expected NO flags, got: ${JSON.stringify(c1.needs_review)}`)
  console.log('   ✓ C1 extraction passed with 0 flags as expected!\n')

  // 2. Test C2 (expect start-date, end-date and renewal flags)
  console.log('2. Testing extraction for C2 (Ballygunge Dental Clinic)...')
  const c2Path = path.join(ROOT, 'demo-data', 'KAJ_Demo_Data', 'C2_ballygunge_dental.pdf')
  const c2Text = extractTextFromPdf(c2Path)
  const c2Buffer = fs.readFileSync(c2Path).toString('base64')
  const c2 = await extractContract(c2Buffer, 'application/pdf', c2Text)

  console.log('   Contract No:', c2.contract_no)
  console.log('   Client:', c2.client_name)
  console.log('   Start Date:', c2.start_date)
  console.log('   End Date:', c2.end_date)
  console.log('   Renewal Reminder:', c2.renewal_reminder_date)
  console.log('   Visits Count:', c2.visit_schedule.length)
  console.log('   Flags in needs_review:', c2.needs_review)

  if (c2.contract_no !== 'DCS/AMC/2026/052') throw new Error(`C2 contract_no mismatch: ${c2.contract_no}`)
  if (c2.client_name !== 'Ballygunge Dental Clinic') throw new Error(`C2 client_name mismatch: ${c2.client_name}`)
  if (c2.start_date !== '2026-06-01') throw new Error(`C2 start_date mismatch: ${c2.start_date}`)
  if (c2.end_date !== null) throw new Error(`C2 end_date expected null, got: ${c2.end_date}`)
  if (c2.renewal_reminder_date !== null) throw new Error(`C2 renewal expected null, got: ${c2.renewal_reminder_date}`)
  if (!c2.needs_review.some(f => f.includes('Only one date given'))) throw new Error(`C2 missing start date flag`)
  if (!c2.needs_review.some(f => f.includes('end_date missing'))) throw new Error(`C2 missing end date / renewal flag`)
  console.log('   ✓ C2 extraction passed with start, end and renewal flags as expected!\n')

  // 3. Confirm and Save C1 and C2
  console.log('3. Saving confirmed contracts to store...')
  const docId1 = c1.contract_no.replace(/\//g, '-')
  await col('contracts').doc(docId1).set({
    ...c1,
    status: 'confirmed',
    tenant_id: tenantId,
    source_ref: 'C1_greenview.pdf',
    created_at: Timestamp.now(),
  })

  const docId2 = c2.contract_no.replace(/\//g, '-')
  await col('contracts').doc(docId2).set({
    ...c2,
    status: 'confirmed',
    tenant_id: tenantId,
    source_ref: 'C2_ballygunge_dental.pdf',
    created_at: Timestamp.now(),
  })
  console.log('   ✓ Contracts confirmed and saved')

  // 4. Retrieve and verify contracts list
  console.log('4. Querying contracts list from store...')
  const snap = await col('contracts').get()
  const list = snap.docs.map(d => d.data())
  console.log(`   Found ${list.length} contracts:`, list.map(c => `${c.contract_no}: ${c.client_name} (renew: ${c.renewal_reminder_date})`))

  const saved1 = list.find(c => c.contract_no === 'DCS/AMC/2026/041')
  const saved2 = list.find(c => c.contract_no === 'DCS/AMC/2026/052')

  if (!saved1) throw new Error('C1 not found in contracts list')
  if (!saved2) throw new Error('C2 not found in contracts list')
  if (saved1.renewal_reminder_date !== '2027-03-01') throw new Error('C1 renewal date mismatch in store')
  if (saved1.visit_schedule.length !== 4) throw new Error('C1 visit schedule mismatch in store')

  console.log('   ✓ Both contracts verified in list with visits and renewal date!')
  console.log('\n🎉 ALL STEP 3 TESTS PASSED!')
  process.exit(0)
}

runTests().catch(e => {
  console.error('\n❌ Test failed:', e)
  process.exit(1)
})
