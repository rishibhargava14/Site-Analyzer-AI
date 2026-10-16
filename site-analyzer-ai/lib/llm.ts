// Streams tokens from either OpenRouter (free models) or Anthropic.
// Priority: OPENROUTER_API_KEY → ANTHROPIC_API_KEY → offline fallback (null).

export async function llmStream(system: string, user: string): Promise<ReadableStream<Uint8Array> | null> {
  // 1. Prefer OpenRouter (free models available)
  const orKey = process.env.OPENROUTER_API_KEY
  if (orKey) {
    return openAICompatibleStream({
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      key: orKey,
      model: process.env.OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free',
      system,
      user,
      extraHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'https://site-analyzer.app',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Site Analyzer',
      },
    })
  }

  // 2. Fall back to Anthropic if key is present
  const antKey = process.env.ANTHROPIC_API_KEY
  if (antKey) {
    return anthropicStream(antKey, system, user)
  }

  // 3. No key → offline RAG mode
  return null
}

/** OpenAI-compatible streaming (OpenRouter, Groq, etc.) */
async function openAICompatibleStream(opts: {
  baseUrl: string
  key: string
  model: string
  system: string
  user: string
  extraHeaders?: Record<string, string>
}): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(`${opts.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.key}`,
      'Content-Type': 'application/json',
      ...opts.extraHeaders,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 700,
      stream: true,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenRouter/LLM error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const enc = new TextEncoder()
  const dec = new TextDecoder()
  let buf = ''
  const reader = res.body.getReader()

  return new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read()
      if (done) return ctrl.close()
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n')
      buf = parts.pop() || ''
      for (const line of parts) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') continue
        try {
          const j = JSON.parse(data)
          const text = j.choices?.[0]?.delta?.content
          if (text) ctrl.enqueue(enc.encode(text))
        } catch {
          // ignore malformed chunks
        }
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}

/** Original Anthropic Messages API streaming */
async function anthropicStream(key: string, system: string, user: string): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch((process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      max_tokens: 700,
      stream: true,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!res.ok || !res.body) throw new Error(`Anthropic LLM error ${res.status}`)

  const enc = new TextEncoder()
  const dec = new TextDecoder()
  let buf = ''
  const reader = res.body.getReader()

  return new ReadableStream({
    async pull(ctrl) {
      const { done, value } = await reader.read()
      if (done) return ctrl.close()
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() || ''
      for (const p of parts) {
        const line = p.split('\n').find(l => l.startsWith('data: '))
        if (!line) continue
        try {
          const j = JSON.parse(line.slice(6))
          if (j.type === 'content_block_delta' && j.delta?.text) {
            ctrl.enqueue(enc.encode(j.delta.text))
          }
        } catch {}
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}
