// Turns a flat list of URLs into a folder-style tree (like a file explorer) for the admin "site structure" view.
export type TNode = { name: string; path: string; children: TNode[]; crawled?: { status: number; words: number; ms: number }; inSitemap: boolean; discovered: boolean }

export function buildTree(origin: string, crawled: { url: string; status: number; words: number; ms: number }[], sitemap: string[], discovered: string[]): TNode {
  const root: TNode = { name: new URL(origin).host, path: '/', children: [], inSitemap: false, discovered: false }
  const put = (url: string, f: (n: TNode) => void) => {
    let u: URL; try { u = new URL(url) } catch { return }
    if (u.origin !== origin) return
    let cur = root; let path = ''
    for (const seg of u.pathname.split('/').filter(Boolean)) {
      path += '/' + seg
      let next = cur.children.find(c => c.name === seg)
      if (!next) { next = { name: seg, path, children: [], inSitemap: false, discovered: false }; cur.children.push(next) }
      cur = next
    }
    f(cur)
  }
  discovered.forEach(u => put(u, n => { n.discovered = true }))
  sitemap.forEach(u => put(u, n => { n.inSitemap = true }))
  crawled.forEach(p => put(p.url, n => { n.crawled = { status: p.status, words: p.words, ms: p.ms } }))
  const sort = (n: TNode) => { n.children.sort((a, b) => (b.children.length > 0 ? 1 : 0) - (a.children.length > 0 ? 1 : 0) || a.name.localeCompare(b.name)); n.children.forEach(sort) }
  sort(root)
  return root
}
