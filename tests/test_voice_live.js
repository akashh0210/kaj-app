// Live voice-note test: real Gemini calls (no mocks) through POST /api/visits/:id/voice-update.
// Run with:  NODE_ENV=test node tests/test_voice_live.js
// Reads visits only; does not write to the database. Never prints the API key.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { app } from '../server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'demo-data', 'KAJ_Demo_Data')
const TENANT = 'das-cooling-services'

if (!process.env.GEMINI_API_KEY && process.env.GEMINI_USE_VERTEX !== 'true') {
  console.error('Set GEMINI_API_KEY or GEMINI_USE_VERTEX=true; this test makes real Gemini calls.')
  process.exit(1)
}

// Which seeded visit each note is posted against (the technician's tapped visit).
// There is no New Town visit in the seed data, so V3 goes to Greenview and should get a mismatch flag.
const CASES = [
  { file: 'v1.ogg', key: 'V1', visit: 'DCS-AMC-2026-041_2026-11-19' },
  { file: 'v2.ogg', key: 'V2', visit: 'DCS-AMC-2026-063_2027-01-01' },
  { file: 'v3.ogg', key: 'V3', visit: 'DCS-AMC-2026-041_2026-11-19', expectMismatch: true },
  { file: 'v4.ogg', key: 'V4', visit: 'DCS-AMC-2026-052_2026-11-19' },
  { file: 'v5.ogg', key: 'V5', visit: 'DCS-AMC-2026-041_2026-11-19' },
]

function loadAnswerKey() {
  const key = {}
  for (const line of fs.readFileSync(path.join(DATA, 'AnswerKey.csv'), 'utf8').trim().split(/\r?\n/).slice(1)) {
    const m = line.match(/^([^,]*),([^,]*),("(?:[^"]|"")*"|[^,]*),(.*)$/)
    if (!m) continue
    const [, item, field, rawVal, flag] = m
    const value = rawVal.startsWith('"') ? rawVal.slice(1, -1).replace(/""/g, '"') : rawVal
    ;(key[item] ||= []).push({ field, value, flagged: flag.startsWith('yes') })
  }
  return key
}

const words = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)
const total = list => (list || []).reduce((n, u) => n + (Number(u.quantity) || 0), 0)
const notes = x => x.needs_review.join(' | ')

// Compare one AnswerKey row; returns [ok, detail].
function check(field, expected, flagged, x) {
  const got = x[field]
  switch (field) {
    case 'site_or_client': {
      if (expected.startsWith('null')) return [got === null && /site/i.test(notes(x)), `got=${got}`]
      // Compare with spaces removed so "Newtown office" matches "New Town IT Office"
      const generic = ['society', 'housing', 'office', 'clinic', 'cafe', 'block']
      const gotCompact = words(got).filter(w => !generic.includes(w)).join('')
      const exp = words(expected).filter(w => !generic.includes(w))
      return [exp.some(w => gotCompact.includes(w)) || gotCompact.includes(exp.join('').slice(0, 7)), `got=${got}`]
    }
    case 'units_serviced':
    case 'units_pending': {
      if (expected.startsWith('null')) {
        const empty = got === null || (Array.isArray(got) && got.length === 0) || total(got) === 0
        return [empty && (!flagged || x.needs_review.length > 0), `got=${JSON.stringify(got)}`]
      }
      const [, n, type] = expected.match(/^(\d+)\s*(.*)$/)
      const typeWord = words(type).find(w => w !== 'ac')
      const typeOk = !typeWord || (got || []).some(u => String(u.type).toLowerCase().includes(typeWord))
      return [total(got) === Number(n) && typeOk, `got=${JSON.stringify(got)}`]
    }
    case 'extra_work': {
      const ew = x.extra_work || []
      if (expected.startsWith('none')) {
        const followUpOk = !/compressor/i.test(expected) || /compressor|noise/i.test(notes(x))
        return [ew.length === 0 && followUpOk, `got=${JSON.stringify(ew)}`]
      }
      const [, item, qty] = expected.match(/^(.*?)\s*x(\d+)/)
      const w = words(item)[0]
      return [ew.some(e => String(e.item).toLowerCase().includes(w) && e.quantity === Number(qty)), `got=${JSON.stringify(ew)}`]
    }
  }
  return [false, 'unknown field']
}

async function main() {
  const key = loadAnswerKey()
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}`
  let pass = 0, totalRows = 0
  try {
    for (const c of CASES) {
      const form = new FormData()
      form.append('audio', new Blob([fs.readFileSync(path.join(DATA, c.file))], { type: 'audio/ogg' }), c.file)
      const res = await fetch(`${base}/api/visits/${c.visit}/voice-update`, {
        method: 'POST', headers: { 'x-tenant-id': TENANT }, body: form,
      })
      const body = await res.json()
      console.log(`\n=== ${c.file} (AnswerKey ${c.key}) -> visit ${c.visit}`)
      if (!res.ok) { console.log(`ERROR ${res.status}: ${body.error}`); continue }
      const x = body.extracted
      console.log(`extraction_method: ${x.extraction_method}   language: ${x.language}   source_ref: ${x.source_ref}`)
      console.log(`summary: ${x.summary_english}`)
      console.log(`needs_review: ${x.needs_review.length ? '\n  - ' + x.needs_review.join('\n  - ') : '(none)'}`)
      for (const row of key[c.key] || []) {
        const [ok, detail] = check(row.field, row.value, row.flagged, x)
        totalRows++; if (ok) pass++
        console.log(`  ${ok ? 'MATCH' : 'MISS '}  ${row.field.padEnd(15)} expected=${row.value}${row.flagged ? ' [flag]' : ''}  ${detail}`)
      }
      if (c.expectMismatch) console.log(`  ${x.site_mismatch ? 'MATCH' : 'MISS '}  site mismatch flagged (posted to a different client's visit)`)
    }
  } finally {
    server.close()
  }
  console.log(`\nTotal: ${pass}/${totalRows} AnswerKey rows match`)
}

main()
