# Site Analyzer
Real website audit (live crawler → scores → issues) + **RAG + LLM** consultant that answers questions about the crawled site.

## New features (v1.2)
- **Example URLs** – one-click demo buttons (Wikipedia, GitHub, Vercel, MDN)
- **Dark mode** – toggle in the nav, respects system preference + localStorage
- **Export report** – Copy report (plain text) or download full JSON
- **Better loading UX** – animated progress bar + step-by-step status messages
- **Free AI via OpenRouter** – use free models (no payment required)

## How it works
1. `POST /api/analyze` – crawls up to `MAX_PAGES` pages (cheerio), reads robots.txt/sitemap, optional Google PageSpeed, scores 4 pillars.
2. Page text + audit findings are chunked into a **knowledge base** (`lib/rag.ts`) and returned to the browser.
3. `POST /api/chat` – **BM25 retrieval** picks the top chunks → sent to the LLM (OpenRouter free models or Claude) → first tokens in ~1s. No key = offline RAG answers.
## Database (MongoDB)
Set `MONGODB_URI` to turn on persistence (leave it empty and the app still works statelessly).
- `lib/db.ts` – cached Mongo connection · `lib/store.ts` – save/list/get/delete audits, chats, rate-limit
- Collections: `audits` (full report + knowledge base), `chats` (question/answer per audit), `rate_limits` (TTL, auto-expires)
- API: `GET /api/history` · `GET /api/history/:id` · `DELETE /api/history/:id`
- Local: `docker compose up -d mongo`, then `MONGODB_URI=mongodb://localhost:27017`

## Run locally
```bash
npm install
cp .env.example .env.local
# Add OPENROUTER_API_KEY (free) — see below
npm run dev                    # http://localhost:3000
```

## Free AI setup (OpenRouter) – no credit card needed

1. Go to https://openrouter.ai and sign up (email only)
2. Open **Keys** → **Create Key** → copy the key (`sk-or-v1-...`)
3. In `.env.local` (or Vercel Environment Variables) set:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
MAX_PAGES=8
```

**Good free models to try:**
- `google/gemma-4-26b-a4b-it:free` (default, solid quality)
- `google/gemma-4-31b-it:free`
- `nvidia/nemotron-3.5-lightning:free`
- `qwen/qwen3.8-27b:free`
- `thinkingmachines/inkling-small:free`

Free tier ≈ 50 requests/day (increases to 1,000/day after a one-time $10 credit purchase on OpenRouter — optional).

## Deploy – Vercel (5 min)
1. `git init && git add . && git commit -m "init"` → push to a new GitHub repo.
2. vercel.com → Add New → Project → import the repo (Next.js is auto-detected).
3. Environment Variables:
   - `OPENROUTER_API_KEY` = your free key
   - `OPENROUTER_MODEL` = `google/gemma-4-26b-a4b-it:free`
   - `MAX_PAGES` = `8`
   - `PSI_API_KEY` (optional)
   - Do **not** set `ALLOW_LOCAL`
4. Deploy. Open the URL, scan a site.

## Deploy – Docker
```bash
docker build -t site-analyzer-ai .
docker run -p 3000:3000 \
  -e OPENROUTER_API_KEY=sk-or-v1-... \
  -e OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free \
  site-analyzer-ai
```

## Security notes
- SSRF protection blocks private/internal IPs (`lib/crawler.ts`). Never set `ALLOW_LOCAL=1` in production.
- Rate limit + cache are in-memory; use Upstash/Redis for multi-instance production.


## Accounts, admin & deployment (v2)

**Pages:** `/` landing · `/login` · `/signup` · `/analyze` (scanner, needs login) · `/admin` (admins only: overview, all scans with site-structure tree + analysis + chat, users).
**Roles:** the first account ever created becomes admin; add more via `ADMIN_EMAILS=a@x.com,b@y.com` or the Users page.
**Analysis:** 6 pillars (performance, content, indexing, structure, security, accessibility), 46 checklist items and 60+ individual signals.

### Required env vars
| Var | What |
|---|---|
| `MONGODB_URI` | MongoDB Atlas (free M0) or local connection string |
| `AUTH_SECRET` | random 32+ chars: `openssl rand -base64 32` |
| `ADMIN_EMAILS` | optional, comma-separated |
| `OPENROUTER_API_KEY` | optional, enables LLM answers |

### Vercel + Atlas
1. Atlas: create free cluster → Database Access user → Network Access **0.0.0.0/0** (Vercel IPs change) → copy the `mongodb+srv://…` string.
2. Push to GitHub → vercel.com → Import → add the env vars above → Deploy.
3. Open the site, **sign up with your own email first** (becomes admin), then use `/admin`.

### Docker
`cp .env.example .env` (set `AUTH_SECRET`) → `docker compose up --build` → http://localhost:3000.
