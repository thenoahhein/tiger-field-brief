import type {
  SourceConnector,
  SourceSearchInput,
  SourceSearchResult,
} from './types'
import {
  MAX_RESULT_TEXT_CHARS,
  clampLimit,
  isRecord,
  pickString,
  truncate,
} from './util'

/**
 * Web search connector.
 *
 * Provider is selected via `WEB_SEARCH_PROVIDER` and the API key via
 * `WEB_SEARCH_API_KEY`. The DEFAULT provider is **Tavily** — it returns a clean
 * snippet/`content` field per result which maps well to our normalized shape.
 *
 * Additional providers (Brave, Serper) are included so the provider can be
 * swapped via env without code changes. To add another provider, implement a
 * function with the {@link ProviderFn} signature and register it in `PROVIDERS`.
 */

type ProviderFn = (
  apiKey: string,
  input: SourceSearchInput,
) => Promise<SourceSearchResult[]>

const DEFAULT_PROVIDER = 'tavily'

function provider(): string {
  return (process.env.WEB_SEARCH_PROVIDER || DEFAULT_PROVIDER).toLowerCase()
}

/**
 * Resolve a provider endpoint, allowing `WEB_SEARCH_BASE_URL` to override the
 * default host (useful for a proxy, a self-hosted gateway, or testing).
 */
function endpoint(defaultUrl: string): string {
  const base = process.env.WEB_SEARCH_BASE_URL?.trim()
  if (!base) return defaultUrl
  const path = new URL(defaultUrl).pathname
  return new URL(path, base).toString()
}

function nowIso(): string {
  return new Date().toISOString()
}

// --- Tavily (default) -------------------------------------------------------
const tavily: ProviderFn = async (apiKey, input) => {
  const res = await fetch(endpoint('https://api.tavily.com/search'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: input.query,
      max_results: clampLimit(input.limit),
      search_depth: 'basic',
    }),
  })
  if (!res.ok) {
    throw new Error(`Tavily request failed (${res.status}).`)
  }
  const data: unknown = await res.json()
  const results =
    isRecord(data) && Array.isArray(data.results) ? data.results : []
  const captured = nowIso()
  return results.filter(isRecord).map((r) => ({
    sourceType: 'web' as const,
    sourceName: 'tavily',
    title: pickString(r, 'title'),
    url: pickString(r, 'url'),
    publishedAt: pickString(r, 'published_date'),
    capturedAt: captured,
    text: truncate(
      pickString(r, 'content', 'snippet', 'raw_content') ?? '',
      MAX_RESULT_TEXT_CHARS,
    ),
    metadata: { score: r.score, query: input.query },
  }))
}

// --- Brave Search -----------------------------------------------------------
const brave: ProviderFn = async (apiKey, input) => {
  const url = new URL(endpoint('https://api.search.brave.com/res/v1/web/search'))
  url.searchParams.set('q', input.query)
  url.searchParams.set('count', String(clampLimit(input.limit)))
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
  })
  if (!res.ok) {
    throw new Error(`Brave Search request failed (${res.status}).`)
  }
  const data: unknown = await res.json()
  const results =
    isRecord(data) && isRecord(data.web) && Array.isArray(data.web.results)
      ? data.web.results
      : []
  const captured = nowIso()
  return results.filter(isRecord).map((r) => ({
    sourceType: 'web' as const,
    sourceName: 'brave',
    title: pickString(r, 'title'),
    url: pickString(r, 'url'),
    publishedAt: pickString(r, 'page_age', 'age'),
    capturedAt: captured,
    text: truncate(
      pickString(r, 'description', 'snippet') ?? '',
      MAX_RESULT_TEXT_CHARS,
    ),
    metadata: { query: input.query },
  }))
}

// --- Serper (google) --------------------------------------------------------
const serper: ProviderFn = async (apiKey, input) => {
  const res = await fetch(endpoint('https://google.serper.dev/search'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ q: input.query, num: clampLimit(input.limit) }),
  })
  if (!res.ok) {
    throw new Error(`Serper request failed (${res.status}).`)
  }
  const data: unknown = await res.json()
  const results =
    isRecord(data) && Array.isArray(data.organic) ? data.organic : []
  const captured = nowIso()
  return results.filter(isRecord).map((r) => ({
    sourceType: 'web' as const,
    sourceName: 'serper',
    title: pickString(r, 'title'),
    url: pickString(r, 'link'),
    publishedAt: pickString(r, 'date'),
    capturedAt: captured,
    text: truncate(pickString(r, 'snippet') ?? '', MAX_RESULT_TEXT_CHARS),
    metadata: { position: r.position, query: input.query },
  }))
}

const PROVIDERS: Record<string, ProviderFn> = { tavily, brave, serper }

export const webConnector: SourceConnector = {
  type: 'web',
  name: 'Web Search',
  requiredEnv: ['WEB_SEARCH_API_KEY', 'WEB_SEARCH_PROVIDER (optional)'],
  configHint:
    'Set WEB_SEARCH_API_KEY. Optionally set WEB_SEARCH_PROVIDER (tavily | brave | serper; default tavily).',
  isConfigured() {
    return (
      !!process.env.WEB_SEARCH_API_KEY && provider() in PROVIDERS
    )
  },
  async search(input) {
    const apiKey = process.env.WEB_SEARCH_API_KEY
    if (!apiKey) throw new Error('Web search is not configured.')
    const fn = PROVIDERS[provider()]
    if (!fn) {
      throw new Error(
        `Unsupported WEB_SEARCH_PROVIDER "${provider()}". Use tavily, brave, or serper.`,
      )
    }
    return fn(apiKey, input)
  },
}
