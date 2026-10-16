import { getSession } from './auth'
// Re-check the role on the server for every admin API call (middleware is only the first gate).
export async function requireAdmin() { const s = await getSession(); return s?.role === 'admin' ? s : null }
