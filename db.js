// Database abstraction: Firestore on Cloud Run / GCP, or local JSON store fallback
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// KAJ_DATA_DIR lets tests and containers keep the local store somewhere else.
const DATA_DIR = process.env.KAJ_DATA_DIR || path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'local_db.json')

export class LocalTimestamp {
  constructor(date = new Date()) {
    this._date = date instanceof Date ? date : new Date(date)
    this.seconds = Math.floor(this._date.getTime() / 1000)
    this.nanoseconds = (this._date.getTime() % 1000) * 1e6
  }
  toDate() {
    return this._date
  }
  toISOString() {
    return this._date.toISOString()
  }
  static now() {
    return new LocalTimestamp(new Date())
  }
  static fromDate(date) {
    return new LocalTimestamp(date)
  }
}

// In-memory store backed by local JSON file
class LocalQuery {
  constructor(docs, parentPath) {
    this._docs = docs // array of { id, data }
    this._parentPath = parentPath
  }

  where(field, op, value) {
    const filtered = this._docs.filter(doc => {
      const val = doc.data[field]
      if (op === '==') return val === value
      if (op === '!=') return val !== value
      if (op === '>') return val > value
      if (op === '>=') return val >= value
      if (op === '<') return val < value
      if (op === '<=') return val <= value
      if (op === 'in') return Array.isArray(value) && value.includes(val)
      return false
    })
    return new LocalQuery(filtered, this._parentPath)
  }

  orderBy(field, direction = 'asc') {
    const sorted = [...this._docs].sort((a, b) => {
      let valA = a.data[field]
      let valB = b.data[field]

      // Handle Timestamp or date-like objects
      if (valA && typeof valA.toDate === 'function') valA = valA.toDate().getTime()
      if (valB && typeof valB.toDate === 'function') valB = valB.toDate().getTime()

      if (valA === valB) return 0
      if (valA === undefined || valA === null) return 1
      if (valB === undefined || valB === null) return -1

      if (direction === 'desc') {
        return valA < valB ? 1 : -1
      }
      return valA > valB ? 1 : -1
    })
    return new LocalQuery(sorted, this._parentPath)
  }

  async get() {
    const docSnapshots = this._docs.map(doc => ({
      id: doc.id,
      exists: true,
      data: () => ({ ...doc.data }),
    }))
    return {
      docs: docSnapshots,
      size: docSnapshots.length,
      empty: docSnapshots.length === 0,
    }
  }
}

class LocalDocRef {
  constructor(collectionPath, docId, storeInstance) {
    this._collectionPath = collectionPath
    this._docId = docId
    this._store = storeInstance
    this.id = docId
  }

  async get() {
    const colData = this._store._getCollection(this._collectionPath)
    const data = colData[this._docId]
    return {
      id: this._docId,
      exists: data !== undefined,
      data: () => (data ? { ...data } : undefined),
    }
  }

  async set(data) {
    const colData = this._store._getCollection(this._collectionPath)
    colData[this._docId] = JSON.parse(JSON.stringify(data))
    this._store._persist()
    return { id: this._docId }
  }

  async update(updates) {
    const colData = this._store._getCollection(this._collectionPath)
    if (!colData[this._docId]) {
      colData[this._docId] = {}
    }
    Object.assign(colData[this._docId], JSON.parse(JSON.stringify(updates)))
    this._store._persist()
    return { id: this._docId }
  }

  async delete() {
    const colData = this._store._getCollection(this._collectionPath)
    delete colData[this._docId]
    this._store._persist()
  }
}

class LocalCollectionRef {
  constructor(pathStr, storeInstance) {
    this._path = pathStr
    this._store = storeInstance
  }

  doc(id) {
    return new LocalDocRef(this._path, id, this._store)
  }

  async add(data) {
    const id = crypto.randomUUID()
    const docRef = this.doc(id)
    await docRef.set(data)
    return { id }
  }

  where(field, op, value) {
    return this._toQuery().where(field, op, value)
  }

  orderBy(field, direction = 'asc') {
    return this._toQuery().orderBy(field, direction)
  }

  async get() {
    return this._toQuery().get()
  }

  _toQuery() {
    const colData = this._store._getCollection(this._path)
    const docs = Object.keys(colData).map(id => ({
      id,
      data: colData[id],
    }))
    return new LocalQuery(docs, this._path)
  }
}

class LocalStore {
  constructor(filePath) {
    this._filePath = filePath
    this._data = {}
    this._load()
  }

  _load() {
    try {
      if (fs.existsSync(this._filePath)) {
        const raw = fs.readFileSync(this._filePath, 'utf8')
        this._data = JSON.parse(raw)
      }
    } catch (e) {
      console.warn('Could not load local_db.json, starting with empty store:', e.message)
      this._data = {}
    }
  }

  _persist() {
    try {
      const dir = path.dirname(this._filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this._filePath, JSON.stringify(this._data, null, 2), 'utf8')
    } catch (e) {
      console.error('Failed to persist local_db.json:', e.message)
    }
  }

  _getCollection(pathStr) {
    if (!this._data[pathStr]) {
      this._data[pathStr] = {}
    }
    return this._data[pathStr]
  }

  collection(pathStr) {
    return new LocalCollectionRef(pathStr, this)
  }
}

// ── Initialize DB ────────────────────────────────────────────────────────────
let dbInstance = null
let TimestampClass = LocalTimestamp
let isLocalStore = false

async function initDb() {
  if (dbInstance) return { db: dbInstance, Timestamp: TimestampClass, isLocalStore }

  const hasCert = process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION)
  // KAJ_STORE=local forces the local JSON store (e.g. a Cloud Run demo without Firestore).
  const forceLocal = process.env.KAJ_STORE === 'local'

  if (!forceLocal && (hasCert || isCloudRun)) {
    try {
      const { initializeApp, cert, getApps } = await import('firebase-admin/app')
      const { getFirestore, Timestamp } = await import('firebase-admin/firestore')

      let app
      if (getApps().length === 0) {
        if (hasCert) {
          app = initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
          })
          console.log('Firebase initialized with service account certificate.')
        } else {
          // Cloud Run with Application Default Credentials
          app = initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
          })
          console.log('Firebase initialized with Application Default Credentials (Cloud Run).')
        }
      } else {
        app = getApps()[0]
      }
      const firestore = getFirestore(app)
      // initializeApp succeeds even when Firestore is not set up; make one real read so a
      // missing database falls back to the local store instead of failing every request.
      await Promise.race([
        firestore.collection('_kaj_health').limit(1).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore did not respond in 8s')), 8000)),
      ])
      dbInstance = firestore
      TimestampClass = Timestamp
      isLocalStore = false
      return { db: dbInstance, Timestamp: TimestampClass, isLocalStore }
    } catch (err) {
      console.warn('Failed to initialize Firestore admin SDK, falling back to local JSON store:', err.message)
    }
  }

  console.log(`Using local JSON store at ${DB_FILE}`)
  const localStore = new LocalStore(DB_FILE)
  dbInstance = {
    collection: (colPath) => localStore.collection(colPath),
    _localStore: localStore,
  }
  TimestampClass = LocalTimestamp
  isLocalStore = true
  return { db: dbInstance, Timestamp: TimestampClass, isLocalStore }
}

// Synchronous default export for local store with fallback
const localStore = new LocalStore(DB_FILE)
export const localDb = {
  collection: (colPath) => localStore.collection(colPath),
  _localStore: localStore,
}

export function getTenantCollection(db, tenantId, ...segments) {
  if (db && typeof db.doc === 'function') {
    return db.collection('tenants').doc(tenantId).collection(segments.join('/'))
  }
  return db.collection(`tenants/${tenantId}/${segments.join('/')}`)
}

export { initDb, TimestampClass as Timestamp }
