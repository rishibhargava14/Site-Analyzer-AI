import { MongoClient, Db, ObjectId } from 'mongodb'

// Cached across hot-reloads (dev) and warm serverless invocations (Vercel).
const g = globalThis as unknown as { _mongo?: Promise<MongoClient> }

export const dbEnabled = () => !!process.env.MONGODB_URI

export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI
  if (!uri) return null // DB is optional: app keeps working statelessly without it
  if (!g._mongo) g._mongo = new MongoClient(uri, { serverSelectionTimeoutMS: 4000 }).connect()
  try {
    const db = (await g._mongo).db(process.env.MONGODB_DB || 'site_analyzer')
    await ensureIndexes(db)
    return db
  } catch (e) {
    g._mongo = undefined
    console.error('[db] connection failed:', (e as Error).message)
    return null
  }
}

let indexed = false
async function ensureIndexes(db: Db) {
  if (indexed) return
  indexed = true
  await Promise.all([
    db.collection('audits').createIndex({ createdAt: -1 }),
    db.collection('audits').createIndex({ url: 1, createdAt: -1 }),
    db.collection('chats').createIndex({ auditId: 1, createdAt: 1 }),
    db.collection('rate_limits').createIndex({ at: 1 }, { expireAfterSeconds: 120 }), // TTL: auto-clean
  ]).catch(() => { indexed = false })
}

export const oid = (id: string) => { try { return new ObjectId(id) } catch { return null } }
export { ObjectId }
