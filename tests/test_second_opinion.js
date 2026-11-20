// Second-opinion logic with mocked model answers (no network, no API key needed).
// Run with:  node tests/test_second_opinion.js
// The mocks are shaped like the C5 (Behala Nursing Home) contract.

// Settings must exist before server.js loads; models are mocked, so no real Gemini access is used.
Object.assign(process.env, {
  NODE_ENV: 'test',
  KAJ_STORE: 'local',
  GEMINI_USE_VERTEX: 'true',
  GOOGLE_CLOUD_PROJECT: 'mock-project',
  GEMINI_MODEL: 'gemini-4-hydrogen',
  GEMINI_FALLBACK_MODEL: 'gemini-3.8-flash',
})
const { extractContract } = await import('../server.js')

const MAIN = 'gemini-4-hydrogen'
const SECOND = 'gemini-3.8-flash'

// Main model on C5: correct values, 3 flags (so a second opinion is asked)
const c5Main = () => ({
  provider_name: 'Das Cooling Services',
  contract_no: 'DCS/AMC/2026/078',
  client_name: 'Behala Nursing Home',
  site_address: 'Diamond Harbour Road, Behala, Kolkata',
  equipment: [{ type: 'split AC', capacity: '1.5 ton', quantity: 5 }],
  start_date: '2026-09-01',
  end_date: '2027-08-31',
  visit_frequency: 'Quarterly',
  contract_value: null,
  gst_extra: null,
  payment_terms: 'Within 15 days of each visit invoice',
  extras_chargeable: true,
  needs_review: ['Contract value is missing.', 'GST terms are not specified.', 'Payment terms wording unclear.'],
})

// Second model: same contract, different wording in places that mean the same thing,
// plus two real disagreements (end_date, contract_value).
const c5SecondDisagrees = () => ({
  ...c5Main(),
  client_name: 'BEHALA NURSING HOME',                                   // same, different case
  site_address: 'Behala Nursing Home, Diamond Harbour Road, Behala, Kolkata', // contains main's wording
  equipment: [{ type: 'Split AC units', capacity: '1.5 Ton', quantity: 5 }],  // same after normalising
  visit_frequency: 'quarterly',                                          // same
  end_date: '2027-08-30',                                                // DISAGREES
  contract_value: 45000,                                                 // DISAGREES (main: missing)
  needs_review: ['GST terms are not specified.', 'Check end date.'],
})

const c5SecondAgrees = () => ({ ...c5Main(), needs_review: ['Contract value is missing.', 'GST terms are not specified.'] })

function mockModels(answers) {
  const calls = []
  const callModel = async (model) => {
    calls.push(model)
    const a = answers[model]
    if (a instanceof Error) throw a
    const out = a()
    out.extraction_method = `gemini:${model}`
    return out
  }
  return { callModel, calls }
}

let failed = 0
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
  if (!cond) failed++
}
const disagreeNotes = x => x.needs_review.filter(n => n.startsWith('Two AI models disagreed; please check'))

// ── 1. C5: models disagree on two fields ────────────────────────────────────
{
  const m = mockModels({ [MAIN]: c5Main, [SECOND]: c5SecondDisagrees })
  const x = await extractContract('mock', 'application/pdf', '', { callModel: m.callModel })
  console.log('\n1. C5, second model disagrees')
  console.log('   needs_review:\n     - ' + x.needs_review.join('\n     - '))
  console.log('   extraction_log:', JSON.stringify(x.extraction_log))
  check('both models called', m.calls.join(',') === `${MAIN},${SECOND}`, m.calls.join(','))
  check('main model kept', x.extraction_method === `gemini:${MAIN}` && x.extraction_log.kept === MAIN)
  check('disagreements are exactly end_date and contract_value',
    JSON.stringify(x.extraction_log.disagreements) === '["end_date","contract_value"]', JSON.stringify(x.extraction_log.disagreements))
  check("main's end_date kept", x.end_date === '2027-08-31', x.end_date)
  check("main's contract_value kept (missing stays null, not 45000)", x.contract_value === null, String(x.contract_value))
  check('renewal computed from main end_date', x.renewal_reminder_date === '2027-08-01', x.renewal_reminder_date)
  check('two disagreement notes, one per field', disagreeNotes(x).length === 2 &&
    disagreeNotes(x).some(n => n.includes('end_date')) && disagreeNotes(x).some(n => n.includes('contract_value')))
  check("main model's own 3 flags kept", ['Contract value is missing.', 'GST terms are not specified.', 'Payment terms wording unclear.']
    .every(n => x.needs_review.includes(n)))
  check('wording-only differences not flagged (client, site, equipment, frequency)',
    !disagreeNotes(x).some(n => /client_name|site_address|equipment|visit_frequency/.test(n)))
}

// ── 2. C5: models agree ─────────────────────────────────────────────────────
{
  const m = mockModels({ [MAIN]: c5Main, [SECOND]: c5SecondAgrees })
  const x = await extractContract('mock', 'application/pdf', '', { callModel: m.callModel })
  console.log('\n2. C5, second model agrees')
  check('both models called', m.calls.length === 2)
  check('no disagreement notes', disagreeNotes(x).length === 0 && x.extraction_log.disagreements.length === 0)
  check('only the main model flags remain', x.needs_review.length === 3, String(x.needs_review.length))
}

// ── 3. Main model flags 2 or fewer: no second opinion ───────────────────────
{
  const twoFlags = () => ({ ...c5Main(), needs_review: ['Contract value is missing.', 'GST terms are not specified.'] })
  const m = mockModels({ [MAIN]: twoFlags, [SECOND]: c5SecondDisagrees })
  const x = await extractContract('mock', 'application/pdf', '', { callModel: m.callModel })
  console.log('\n3. Main model flags 2 fields')
  check('second model not called', m.calls.join(',') === MAIN, m.calls.join(','))
  check('no retry logged', !x.extraction_log.retry_reason)
}

// ── 4. Main model unavailable: second model stands in (no comparison possible) ─
{
  const busy = Object.assign(new Error('[503] high demand'), { status: 503 })
  const m = mockModels({ [MAIN]: busy, [SECOND]: c5SecondAgrees })
  const x = await extractContract('mock', 'application/pdf', '', { callModel: m.callModel })
  console.log('\n4. Main model returns 503')
  check('second model used as stand-in', x.extraction_method === `gemini:${SECOND}` && x.extraction_log.kept === SECOND)
  check('no disagreement notes (only one answer)', disagreeNotes(x).length === 0)
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
