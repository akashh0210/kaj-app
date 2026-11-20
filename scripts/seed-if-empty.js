// Container startup step: seed the demo data when the local JSON store has no contracts.
// Never touches Firestore (real data); never fails the container start.
import 'dotenv/config'
import { initDb, getTenantCollection } from '../db.js'

const TENANT_ID = process.env.TENANT_ID || 'das-cooling-services'

try {
  const { db, isLocalStore } = await initDb()
  if (!isLocalStore) {
    console.log('seed-if-empty: using Firestore; skipping automatic seed.')
    process.exit(0)
  }
  const snap = await getTenantCollection(db, TENANT_ID, 'contracts').get()
  if (!snap.empty) {
    console.log(`seed-if-empty: local store already has ${snap.size} contracts; skipping.`)
    process.exit(0)
  }
  console.log('seed-if-empty: local store is empty; seeding demo data.')
  await import('./seed.js') // runs the seed and exits the process when done
} catch (e) {
  console.error('seed-if-empty failed (server will still start):', e.message)
  process.exit(0)
}
