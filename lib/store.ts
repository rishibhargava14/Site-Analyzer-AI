import { getDb, oid } from './db'
import type { Audit } from './analyzer'
import type { Chunk } from './rag'
import type { Site } from './crawler'
import type { Session } from './auth'

// Fail-safe: if the DB is missing/down these return null/[] instead of throwing.
const own = (u: Session) => (u.role === 'admin' ? {} : { userId: u.uid })

export async function saveAudit(audit: Audit, knowledge: Chunk[], site: Site, user: Session): Promise<string | null> {
  try {
    const db = await getDb(); if (!db) return null
    const r = await db.collection('audits').insertOne({
      userId: user.uid, userEmail: user.email, userName: user.name,
      url: audit.url, domain: audit.domain, score: audit.score, grade: audit.grade, pillars: audit.pillars,
      audit, knowledge, site, createdAt: new Date(),
    })
    return r.insertedId.toString()
  } catch { return null }
}

// Reuse this user's scan of the same URL from the last 10 minutes
export async function findRecentAudit(url: string, user: Session, maxAgeMs = 600_000) {
  try {
    const db = await getDb(); if (!db) return null
    const d = await db.collection('audits').findOne({ url, userId: user.uid, createdAt: { $gt: new Date(Date.now() - maxAgeMs) } }, { sort: { createdAt: -1 } })
    return d ? { auditId: d._id.toString(), audit: d.audit as Audit, knowledge: d.knowledge as Chunk[] } : null
  } catch { return null }
}

// "mine" list for the analyzer page
export async function listAudits(user: Session, limit = 20) {
  try {
    const db = await getDb(); if (!db) return []
    const rows = await db.collection('audits').find({ userId: user.uid }, { projection: { url: 1, domain: 1, score: 1, grade: 1, pillars: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(limit).toArray()
    return rows.map(r => ({ id: r._id.toString(), url: r.url, domain: r.domain, score: r.score, grade: r.grade, pillars: r.pillars, createdAt: r.createdAt }))
  } catch { return [] }
}

export async function getAudit(id: string, user: Session) {
  try {
    const db = await getDb(); const _id = oid(id); if (!db || !_id) return null
    const d = await db.collection('audits').findOne({ _id, ...own(user) })
    if (!d) return null
    const chats = await db.collection('chats').find({ auditId: id }).sort({ createdAt: 1 }).toArray()
    return { auditId: id, audit: d.audit as Audit, knowledge: d.knowledge as Chunk[], chats: chats.map(c => ({ question: c.question, answer: c.answer, mode: c.mode, createdAt: c.createdAt })) }
  } catch { return null }
}

export async function deleteAudit(id: string, user: Session) {
  try {
    const db = await getDb(); const _id = oid(id); if (!db || !_id) return false
    const r = await db.collection('audits').deleteOne({ _id, ...own(user) })
    if (r.deletedCount) await db.collection('chats').deleteMany({ auditId: id })
    return r.deletedCount > 0
  } catch { return false }
}

export async function saveChat(auditId: string, userId: string, question: string, answer: string, mode: 'llm' | 'offline') {
  try {
    const db = await getDb(); if (!db) return
    await db.collection('chats').insertOne({ auditId, userId, question, answer, mode, createdAt: new Date() })
  } catch {}
}

// Per-IP rate limit shared across instances (scope = 'scan' | 'auth'). null => DB unavailable.
export async function dbRateLimited(ip: string, max = 6, scope = 'scan'): Promise<boolean | null> {
  try {
    const db = await getDb(); if (!db) return null
    const col = db.collection('rate_limits')
    const n = await col.countDocuments({ ip, scope, at: { $gt: new Date(Date.now() - 60_000) } })
    if (n >= max) return true
    await col.insertOne({ ip, scope, at: new Date() })
    return false
  } catch { return null }
}

// ───────────── Admin queries (all users) ─────────────
export async function adminStats() {
  const db = await getDb(); if (!db) return null
  const A = db.collection('audits')
  const week = new Date(Date.now() - 7 * 864e5)
  const [users, scans, chats, week_scans, avg, grades, domains, recent, daily] = await Promise.all([
    db.collection('users').countDocuments(), A.countDocuments(), db.collection('chats').countDocuments(), A.countDocuments({ createdAt: { $gt: week } }),
    A.aggregate([{ $group: { _id: null, avg: { $avg: '$score' } } }]).toArray(),
    A.aggregate([{ $group: { _id: '$grade', n: { $sum: 1 } } }]).toArray(),
    A.aggregate([{ $group: { _id: '$domain', n: { $sum: 1 }, avg: { $avg: '$score' } } }, { $sort: { n: -1 } }, { $limit: 6 }]).toArray(),
    A.find({}, { projection: { url: 1, domain: 1, score: 1, grade: 1, userEmail: 1, createdAt: 1 } }).sort({ createdAt: -1 }).limit(8).toArray(),
    A.aggregate([{ $match: { createdAt: { $gt: week } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
  ])
  return {
    users, scans, chats, weekScans: week_scans, avgScore: Math.round(avg[0]?.avg || 0),
    grades: Object.fromEntries(grades.map(g => [g._id, g.n as number])),
    domains: domains.map(d => ({ domain: d._id as string, n: d.n as number, avg: Math.round(d.avg) })),
    recent: recent.map(r => ({ id: r._id.toString(), url: r.url as string, domain: r.domain as string, score: r.score as number, grade: r.grade as string, user: r.userEmail as string, createdAt: r.createdAt as Date })),
    daily: daily.map(d => ({ day: d._id as string, n: d.n as number })),
  }
}

export async function adminListScans(q = '', limit = 100) {
  const db = await getDb(); if (!db) return []
  const f = q ? { $or: [{ domain: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { userEmail: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }] } : {}
  const rows = await db.collection('audits').find(f, { projection: { url: 1, domain: 1, score: 1, grade: 1, pillars: 1, userEmail: 1, createdAt: 1, 'audit.issues': 1 } }).sort({ createdAt: -1 }).limit(limit).toArray()
  return rows.map(r => ({ id: r._id.toString(), url: r.url as string, domain: r.domain as string, score: r.score as number, grade: r.grade as string, user: r.userEmail as string, issues: (r.audit?.issues?.length || 0) as number, createdAt: r.createdAt as Date }))
}

export async function adminGetScan(id: string) {
  const db = await getDb(); const _id = oid(id); if (!db || !_id) return null
  const d = await db.collection('audits').findOne({ _id }); if (!d) return null
  const chats = await db.collection('chats').find({ auditId: id }).sort({ createdAt: 1 }).toArray()
  return { id, user: d.userEmail as string, userName: d.userName as string, createdAt: d.createdAt as Date, audit: d.audit as Audit, site: d.site as Site | undefined, knowledge: (d.knowledge || []) as Chunk[], chats: chats.map(c => ({ question: c.question as string, answer: c.answer as string, mode: c.mode as string, createdAt: c.createdAt as Date })) }
}
