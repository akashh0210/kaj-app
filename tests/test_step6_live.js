// Step 6 live test: real Gemini calls (no mocks) through POST /api/contracts/extract.
// Run with:  NODE_ENV=test node tests/test_step6_live.js [extra files...]
// Each extra file arg is "<path>[=<AnswerKey item, e.g. C4>]".
// Never prints the API key.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { app } from '../server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'demo-data', 'KAJ_Demo_Data')

if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set; this test needs the real key.')
  process.exit(1)
}

// ── Answer key ──────────────────────────────────────────────────────────────
function loadAnswerKey() {
  const rows = fs.readFileSync(path.join(DATA, 'AnswerKey.csv'), 'utf8').trim().split(/\r?\n/).slice(1)
  const key = {}
  for (const line of rows) {
    // item,field,correct_value,should_be_flagged  (correct_value may be quoted)
    const m = line.match(/^([^,]*),([^,]*),("(?:[^"]|"")*"|[^,]*),(.*)$/)
    if (!m) continue
    const [, item, field, rawVal, flag] = m
    const value = rawVal.startsWith('"') ? rawVal.slice(1, -1).replace(/""/g, '"') : rawVal
    ;(key[item] ||= []).push({ field, value, flagged: flag.startsWith('yes') })
  }
  return key
}

// ── Field comparison ────────────────────────────────────────────────────────
const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim()

function matchEquipment(expected, actual) {
  if (!Array.isArray(actual)) return false
  const parts = expected.split(';').map(s => s.trim())
  if (parts.length !== actual.length) return false
  return parts.every(part => {
    const [, qty, rest] = part.match(/^(\d+)\s+(.*)$/) || []
    const cap = (rest.match(/[\d.]+/) || [])[0]
    const kind = rest.split(' ')[0] // split / window / cassette
    return actual.some(e =>
      Number(e.quantity) === Number(qty) &&
      norm(`${e.type} ${e.capacity}`).includes(kind) &&
      (!cap || String(e.capacity ?? e.type).includes(cap)))
  })
}

function fieldMatches(field, expected, actual) {
  if (expected.startsWith('null')) return actual === null || actual === undefined
  switch (field) {
    case 'equipment': return matchEquipment(expected, actual)
    case 'visit_schedule': return JSON.stringify(actual || []) === JSON.stringify(expected.split(';').map(s => s.trim()))
    case 'contract_value': return Number(actual) === Number(expected)
    case 'gst_extra': return String(actual) === expected
    case 'visit_frequency': return norm(actual).replace(/ /g, '') === norm(expected).replace(/ /g, '')
    default: return norm(actual) === norm(expected)
  }
}

// Words a needs_review note would use when flagging each field
const FLAG_WORDS = {
  start_date: /start/i, end_date: /end/i, renewal_reminder_date: /renewal/i,
  contract_value: /value|amount|price/i,
}
const isFlagged = (field, notes) => notes.some(n => (FLAG_WORDS[field] || new RegExp(field, 'i')).test(n))

// ── Run one file through the real route ─────────────────────────────────────
async function extractViaRoute(base, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const type = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext]
  const form = new FormData()
  form.append('file', new Blob([fs.readFileSync(filePath)], { type }), path.basename(filePath))
  const res = await fetch(`${base}/api/contracts/extract`, { method: 'POST', body: form })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || res.status)
  return body.extracted
}

function report(label, item, x, key) {
  console.log(`\n=== ${label}${item ? ` (AnswerKey ${item})` : ''}`)
  console.log(`extraction_method: ${x.extraction_method}`)
  console.log(`extraction_failed: ${x.extraction_failed}   status: ${x.status}`)
  console.log(`source_ref: ${x.source_ref}`)
  console.log(`needs_review: ${x.needs_review.length ? '\n  - ' + x.needs_review.join('\n  - ') : '(none)'}`)
  if (!item || !key[item]) return { pass: 0, total: 0 }
  let pass = 0
  for (const { field, value, flagged } of key[item]) {
    const valOk = fieldMatches(field, value, x[field])
    const flagOk = flagged ? isFlagged(field, x.needs_review) : true
    const ok = valOk && flagOk
    if (ok) pass++
    const shown = typeof x[field] === 'object' && x[field] !== null ? JSON.stringify(x[field]) : x[field]
    console.log(`  ${ok ? 'MATCH' : 'MISS '}  ${field.padEnd(22)} expected=${value}${flagged ? ' [flag]' : ''}  got=${shown}${flagged ? `  flagged=${flagOk}` : ''}`)
  }
  if (!key[item].some(r => r.flagged) && x.needs_review.length) {
    console.log('  NOTE   expected no flags but needs_review is not empty')
  }
  console.log(`  -> ${pass}/${key[item].length} fields match`)
  return { pass, total: key[item].length }
}

async function main() {
  const key = loadAnswerKey()
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  const cases = [
    [path.join(DATA, 'C1_greenview.pdf'), 'C1'],
    [path.join(DATA, 'C2_ballygunge_dental.pdf'), 'C2'],
    ...process.argv.slice(2).map(a => a.split('=')),
  ]
  const refs = []
  try {
    for (const [file, item] of cases) {
      try {
        const x = await extractViaRoute(base, file)
        refs.push(x.source_ref)
        report(path.basename(file), item, x, key)
      } catch (e) {
        console.log(`\n=== ${path.basename(file)}: ERROR ${e.message}`)
      }
    }
    // Unique filenames: uploading C1 again must not reuse the earlier stored name
    const again = await extractViaRoute(base, cases[0][0])
    console.log(`\nUnique upload names: ${refs[0]} vs ${again.source_ref} -> ${refs[0] !== again.source_ref ? 'OK' : 'COLLISION'}`)
  } finally {
    server.close()
  }
}

main()
