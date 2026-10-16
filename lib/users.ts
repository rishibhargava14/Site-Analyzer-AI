import bcrypt from 'bcryptjs'
import { getDb, oid, ObjectId } from './db'
import type { Session } from './auth'

export type UserDoc = { _id: ObjectId; email: string; name: string; hash: string; role: 'user' | 'admin'; createdAt: Date; lastLoginAt?: Date }
const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
const toSession = (u: UserDoc): Session => ({ uid: u._id.toString(), email: u.email, name: u.name, role: u.role })

export async function createUser(email: string, name: string, password: string): Promise<{ session?: Session; error?: string }> {
  email = email.trim().toLowerCase(); name = name.trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address.' }
  if (name.length < 2 || name.length > 60) return { error: 'Name must be 2–60 characters.' }
  if (password.length < 8 || password.length > 100) return { error: 'Password must be at least 8 characters.' }
  const db = await getDb(); if (!db) return { error: 'Database is not configured (set MONGODB_URI).' }
  const users = db.collection<UserDoc>('users')
  await users.createIndex({ email: 1 }, { unique: true })
  if (await users.findOne({ email })) return { error: 'An account with this email already exists.' }
  // first account ever, or an email listed in ADMIN_EMAILS, becomes admin
  const role = adminEmails().includes(email) || (await users.countDocuments()) === 0 ? 'admin' : 'user'
  const doc = { email, name, hash: await bcrypt.hash(password, 10), role, createdAt: new Date() } as UserDoc
  try { const r = await users.insertOne(doc as any); doc._id = r.insertedId } catch { return { error: 'An account with this email already exists.' } }
  return { session: toSession(doc) }
}

export async function verifyLogin(email: string, password: string): Promise<{ session?: Session; error?: string }> {
  const db = await getDb(); if (!db) return { error: 'Database is not configured (set MONGODB_URI).' }
  const users = db.collection<UserDoc>('users')
  const u = await users.findOne({ email: email.trim().toLowerCase() })
  // same message for unknown user / wrong password so emails can't be enumerated
  if (!u || !(await bcrypt.compare(password, u.hash))) return { error: 'Incorrect email or password.' }
  if (adminEmails().includes(u.email) && u.role !== 'admin') { await users.updateOne({ _id: u._id }, { $set: { role: 'admin' } }); u.role = 'admin' }
  await users.updateOne({ _id: u._id }, { $set: { lastLoginAt: new Date() } })
  return { session: toSession(u) }
}

export async function listUsers() {
  const db = await getDb(); if (!db) return []
  const [users, counts] = await Promise.all([
    db.collection<UserDoc>('users').find({}, { projection: { hash: 0 } }).sort({ createdAt: -1 }).toArray(),
    db.collection('audits').aggregate([{ $group: { _id: '$userId', n: { $sum: 1 } } }]).toArray(),
  ])
  const m = new Map(counts.map(c => [String(c._id), c.n as number]))
  return users.map(u => ({ id: u._id.toString(), email: u.email, name: u.name, role: u.role, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null, scans: m.get(u._id.toString()) || 0 }))
}

export async function setRole(id: string, role: 'user' | 'admin') {
  const db = await getDb(); const _id = oid(id); if (!db || !_id) return false
  return (await db.collection('users').updateOne({ _id }, { $set: { role } })).matchedCount > 0
}
export async function deleteUser(id: string) {
  const db = await getDb(); const _id = oid(id); if (!db || !_id) return false
  const ids = (await db.collection('audits').find({ userId: id }, { projection: { _id: 1 } }).toArray()).map(a => a._id.toString())
  await Promise.all([db.collection('audits').deleteMany({ userId: id }), ids.length ? db.collection('chats').deleteMany({ auditId: { $in: ids } }) : null])
  return (await db.collection('users').deleteOne({ _id })).deletedCount > 0
}
