import type {
  SourceConnector,
  SourceSearchInput,
  SourceSearchResult,
} from './types'
import { callTool, listTools, pickTool, type McpClientOptions } from './mcp'
import {
  MAX_RESULT_TEXT_CHARS,
  clampLimit,
  isRecord,
  pickString,
  truncate,
} from './util'

/**
 * X (Twitter) connector — READ-ONLY, via an MCP server.
 *
 * Configure with:
 *   X_MCP_SERVER_URL   - MCP server endpoint (hosted or local)
 *   X_MCP_AUTH_TOKEN   - optional bearer token for the MCP server
 *   X_MCP_SEARCH_TOOL  - optional explicit search tool name override
 *
 * This connector ONLY performs search/read. It never posts, likes, replies,
 * reposts, follows, or sends DMs — it only ever calls a search/read tool.
 *
 * Because MCP servers differ, the result mapping is best-effort: we try the
 * server's `structuredContent`, then JSON in the text content, then fall back
 * to a single text result. Adjust `SEARCH_TOOL_CANDIDATES` / env override for
 * your specific X MCP server.
 *
 * TODO: when a canonical X MCP server is chosen, tighten the field mapping and
 * (optionally) replace this thin client with the official MCP SDK.
 */

const SEARCH_TOOL_CANDIDATES = [
  'search_tweets',
  'searchTweets',
  'search_posts',
  'search',
  'recent_search',
  'tweet_search',
]

function options(): McpClientOptions | null {
  const serverUrl = process.env.X_MCP_SERVER_URL
  if (!serverUrl) return null
  return { serverUrl, authToken: process.env.X_MCP_AUTH_TOKEN }
}

function nowIso(): string {
  return new Date().toISOString()
}

/** Coerce arbitrary MCP output into an array of record-shaped items. */
function toItems(structured: unknown, text: string): Record<string, unknown>[] {
  if (Array.isArray(structured)) return structured.filter(isRecord)
  if (isRecord(structured)) {
    for (const key of ['results', 'data', 'tweets', 'posts', 'statuses']) {
      const v = structured[key]
      if (Array.isArray(v)) return v.filter(isRecord)
    }
    return [structured]
  }
  // Try to parse JSON embedded in text content.
  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.filter(isRecord)
      if (isRecord(parsed)) {
        for (const key of ['results', 'data', 'tweets', 'posts']) {
          const v = parsed[key]
          if (Array.isArray(v)) return v.filter(isRecord)
        }
        return [parsed]
      }
    } catch {
      // fall through to raw text
    }
  }
  return []
}

function mapItem(
  item: Record<string, unknown>,
  query: string,
): SourceSearchResult {
  const author =
    pickString(item, 'author', 'username', 'handle', 'screen_name') ??
    (isRecord(item.user)
      ? pickString(item.user, 'username', 'screen_name', 'name')
      : undefined)
  const id = pickString(item, 'id', 'id_str', 'tweet_id')
  const url =
    pickString(item, 'url', 'permalink', 'link') ??
    (author && id ? `https://x.com/${author}/status/${id}` : undefined)
  return {
    sourceType: 'x',
    sourceName: 'x',
    url,
    author,
    publishedAt: pickString(item, 'created_at', 'createdAt', 'date', 'timestamp'),
    capturedAt: nowIso(),
    text: truncate(
      pickString(item, 'text', 'full_text', 'content', 'body') ?? '',
      MAX_RESULT_TEXT_CHARS,
    ),
    metadata: { query, id },
  }
}

export const xConnector: SourceConnector = {
  type: 'x',
  name: 'X (via MCP)',
  requiredEnv: ['X_MCP_SERVER_URL', 'X_MCP_AUTH_TOKEN (optional)'],
  configHint:
    'Set X_MCP_SERVER_URL to a read-capable X MCP server. Optionally set X_MCP_AUTH_TOKEN and X_MCP_SEARCH_TOOL.',
  isConfigured() {
    return !!process.env.X_MCP_SERVER_URL
  },
  async search(input: SourceSearchInput) {
    const opts = options()
    if (!opts) throw new Error('X MCP is not configured.')

    const explicit = process.env.X_MCP_SEARCH_TOOL
    let tool = explicit
    if (!tool) {
      const available = await listTools(opts)
      tool = pickTool(available, SEARCH_TOOL_CANDIDATES)
    }
    if (!tool) {
      throw new Error(
        'No X search tool found on the MCP server. Set X_MCP_SEARCH_TOOL to the read/search tool name.',
      )
    }

    const limit = clampLimit(input.limit)
    const { structured, text } = await callTool(opts, tool, {
      query: input.query,
      q: input.query,
      max_results: limit,
      limit,
      since: input.since,
      until: input.until,
    })

    const items = toItems(structured, text)
    if (items.length === 0 && text.trim().length > 0) {
      return [
        {
          sourceType: 'x',
          sourceName: 'x',
          capturedAt: nowIso(),
          text: truncate(text, MAX_RESULT_TEXT_CHARS),
          metadata: { query: input.query, tool, note: 'unstructured MCP text' },
        },
      ]
    }
    return items.slice(0, limit).map((item) => mapItem(item, input.query))
  },
}
