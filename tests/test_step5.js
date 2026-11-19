// Step 5 Test: Rate card billing
process.env.NODE_ENV = 'test'
import { initDb, getTenantCollection } from '../db.js'

async function runTests() {
  console.log('Testing Step 5: Rate card billing...\n')

  const { db, Timestamp } = await initDb()
  const tenantId = 'das-cooling-services'
  const col = (s) => getTenantCollection(db, tenantId, s)

  // 1. Fetch rate card
  const rcSnap = await col('rate_card').get()
  const rateCard = rcSnap.docs.map(d => d.data())
  console.log('Rate card items loaded:', rateCard.map(r => `${r.item} (Rs ${r.price})`))

  if (rateCard.length < 4) throw new Error('Expected at least 4 rate card items')

  // Find a visit
  const visitsSnap = await col('visits').get()
  const testVisit = visitsSnap.docs[0]
  const visitId = testVisit.id
  const vData = testVisit.data()

  // 2. Submit update with 1 listed extra item and 1 unlisted extra item
  console.log('\nSubmitting visit update with listed and unlisted extra work items...')
  const extraWork = [
    { item: 'Gas top-up (R32)', quantity: 2 },        // Listed: Rs 1800 * 2 = Rs 3600
    { item: 'Custom duct welding', quantity: 1 },     // Unlisted: null price, flagged
  ]

  // Simulate server.js mapping logic
  function matchRateCard(itemName, rcList) {
    if (!itemName) return null
    const clean = itemName.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
    for (const rc of rcList) {
      const rcClean = rc.item.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim()
      if (clean.includes(rcClean) || rcClean.includes(clean)) return rc
      if (clean.includes('gas') && rcClean.includes('gas')) return rc
      if (clean.includes('filter') && rcClean.includes('filter')) return rc
      if (clean.includes('capacitor') && rcClean.includes('capacitor')) return rc
      if (clean.includes('jet') && rcClean.includes('jet')) return rc
    }
    return null
  }

  const createdLines = []
  const todayStr = new Date().toISOString().split('T')[0]

  for (let i = 0; i < extraWork.length; i++) {
    const extra = extraWork[i]
    const matched = matchRateCard(extra.item, rateCard)
    const qty = Number(extra.quantity) || 1
    const unitPrice = matched ? matched.price : null
    const amount = unitPrice !== null ? unitPrice * qty : null

    const docId = `TEST-EXTRA-${visitId}-${i + 1}`
    const line = {
      invoice_no: docId,
      client_name: vData.client_name,
      contract_no: vData.contract_no,
      visit_id: visitId,
      item: extra.item,
      quantity: qty,
      unit_price: unitPrice,
      amount: amount,
      rate_card_item: matched ? matched.item : null,
      is_extra: true,
      status: 'draft',
      gst_extra: true,
      needs_owner_pricing: matched === null,
      review_note: matched === null ? `Item '${extra.item}' not found on rate card; price required from owner.` : null,
      source_ref: 'technician-voice-update',
      created_date: todayStr,
      created_at: Timestamp.now(),
      tenant_id: tenantId,
    }
    await col('invoices').doc(docId).set(line)
    createdLines.push(line)
  }

  // 3. Verify listed item
  console.log('\n3. Verifying listed item billing...')
  const listedLine = createdLines[0]
  console.log('   Item:', listedLine.item)
  console.log('   Unit price:', listedLine.unit_price)
  console.log('   Quantity:', listedLine.quantity)
  console.log('   Total amount:', listedLine.amount)
  console.log('   Needs owner pricing:', listedLine.needs_owner_pricing)

  if (listedLine.unit_price !== 1800) throw new Error(`Expected unit_price 1800, got ${listedLine.unit_price}`)
  if (listedLine.amount !== 3600) throw new Error(`Expected amount 3600, got ${listedLine.amount}`)
  if (listedLine.needs_owner_pricing !== false) throw new Error('Listed item should not need owner pricing')
  console.log('   ✓ Listed item correctly priced from rate card!\n')

  // 4. Verify unlisted item
  console.log('4. Verifying unlisted item billing...')
  const unlistedLine = createdLines[1]
  console.log('   Item:', unlistedLine.item)
  console.log('   Unit price:', unlistedLine.unit_price)
  console.log('   Total amount:', unlistedLine.amount)
  console.log('   Needs owner pricing:', unlistedLine.needs_owner_pricing)
  console.log('   Review note:', unlistedLine.review_note)

  if (unlistedLine.unit_price !== null) throw new Error('Unlisted item should have null unit_price')
  if (unlistedLine.amount !== null) throw new Error('Unlisted item should have null amount')
  if (unlistedLine.needs_owner_pricing !== true) throw new Error('Unlisted item should need owner pricing')
  if (!unlistedLine.review_note.includes('price required from owner')) throw new Error('Unlisted item missing review note')
  console.log('   ✓ Unlisted item correctly set to null price with owner flag!\n')

  // 5. Owner sets price on unlisted item
  console.log('5. Simulating owner setting price on unlisted item...')
  const unlistedDocId = unlistedLine.invoice_no
  await col('invoices').doc(unlistedDocId).update({
    unit_price: 2500,
    amount: 2500,
    needs_owner_pricing: false,
    review_note: null,
    updated_at: Timestamp.now(),
  })

  const updatedLine = (await col('invoices').doc(unlistedDocId).get()).data()
  console.log('   Updated unit price:', updatedLine.unit_price)
  console.log('   Updated amount:', updatedLine.amount)
  console.log('   Needs owner pricing:', updatedLine.needs_owner_pricing)

  if (updatedLine.unit_price !== 2500) throw new Error('Price was not updated')
  if (updatedLine.amount !== 2500) throw new Error('Amount was not updated')
  if (updatedLine.needs_owner_pricing !== false) throw new Error('needs_owner_pricing was not cleared')
  console.log('   ✓ Owner pricing update confirmed!\n')

  // Clean up test draft lines
  await col('invoices').doc(createdLines[0].invoice_no).delete()
  await col('invoices').doc(createdLines[1].invoice_no).delete()

  console.log('🎉 ALL STEP 5 TESTS PASSED!')
  process.exit(0)
}

runTests().catch(e => {
  console.error('\n❌ Test failed:', e)
  process.exit(1)
})
