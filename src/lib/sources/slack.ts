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
 * Slack connector — READ-ONLY.
 *
 * Two modes, in priority order:
 *   1. MCP   — SLACK_MCP_SERVER_URL (+ optional SLACK_MCP_AUTH_TOKEN)
 *   2. Web API — SLACK_BOT_TOKEN, via `search.messages`
 *
 * Only search/read operations are used. This connector NEVER sends messages,
 * updates messages, creates canvases, or modifies users/channels.
 *
 * NOTE on tokens: Slack's `search.messages` endpoint requires a *user* token
 * (`xoxp-…`) with the `search:read` scope. A bot token (`xoxb-…`) cannot call
 * search; if you only have a bot token, prefer the MCP mode. Put whatever
 * search-capable token you have in SLACK_BOT_TOKEN.
 *
 * Slack results may contain confidential internal information — see the README
 * "Sensitive data" section. We never log tokens or full payloads.
 */

const SEARCH_TOOL_CANDIDATES = [
  'search_messages',
  'searchMessages',
  'search',
  'conversations_search',
]

function nowIso(): string {
  return new Date().toISOString()
}

function mcpOptions(): McpClientOptions | null {
  const serverUrl = process.env.SLACK_MCP_SERVER_URL
  if (!serverUrl) return null
  return { serverUrl, authToken: process.env.SLACK_MCP_AUTH_TOKEN }
}

function toItems(structured: unknown, text: string): Record<string, unknown>[] {
  if (Array.isArray(structured)) return structured.filter(isRecord)
  if (isRecord(structured)) {
    for (const key of ['messages', 'results', 'matches', 'data']) {
      const v = structured[key]
      if (Array.isArray(v)) return v.filter(isRecord)
      if (isRecord(v) && Array.isArray(v.matches)) return v.matches.filter(isRecord)
    }
    return [structured]
  }
  const trimmed = text.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.filter(isRecord)
      if (isRecord(parsed) && Array.isArray(parsed.messages))
        return parsed.messages.filter(isRecord)
    } catch {
      // fall through
    }
  }
  return []
}

function mapItem(
  item: Record<string, unknown>,
  query: string,
): SourceSearchResult {
  const channel = isRecord(item.channel)
    ? pickString(item.channel, 'name', 'id')
    : pickString(item, 'channel', 'channel_name')
  const author =
    pickString(item, 'username', 'user', 'author', 'user_name') ??
    (isRecord(item.user) ? pickString(item.user, 'name', 'real_name') : undefined)
  const ts = pickString(item, 'ts', 'timestamp')
  const publishedAt =
    ts && /^\d+(\.\d+)?$/.test(ts)
      ? new Date(Number(ts.split('.')[0]) * 1000).toISOString()
      : pickString(item, 'created_at', 'date')
  return {
    sourceType: 'slack',
    sourceName: 'slack',
    channel,
    author,
    url: pickString(item, 'permalink', 'url'),
    publishedAt,
    capturedAt: nowIso(),
    text: truncate(
      pickString(item, 'text', 'message', 'body') ?? '',
      MAX_RESULT_TEXT_CHARS,
    ),
    metadata: { query, ts },
  }
}

async function searchViaMcp(
  opts: McpClientOptions,
  input: SourceSearchInput,
): Promise<SourceSearchResult[]> {
  const explicit = process.env.SLACK_MCP_SEARCH_TOOL
  let tool = explicit
  if (!tool) {
    const available = await listTools(opts)
    tool = pickTool(available, SEARCH_TOOL_CANDIDATES)
  }
  if (!tool) {
    throw new Error(
      'No Slack search tool found on the MCP server. Set SLACK_MCP_SEARCH_TOOL.',
    )
  }
  const limit = clampLimit(input.limit)
  const { structured, text } = await callTool(opts, tool, {
    query: input.query,
    q: input.query,
    count: limit,
    limit,
  })
  return toItems(structured, text)
    .slice(0, limit)
    .map((item) => mapItem(item, input.query))
}

async function searchViaWebApi(
  token: string,
  input: SourceSearchInput,
): Promise<SourceSearchResult[]> {
  const url = new URL('https://slack.com/api/search.messages')
  url.searchParams.set('query', input.query)
  url.searchParams.set('count', String(clampLimit(input.limit)))
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Slack API request failed (${res.status}).`)
  const data: unknown = await res.json()
  if (!isRecord(data) || data.ok !== true) {
    const err =
      isRecord(data) && typeof data.error === 'string' ? data.error : 'unknown'
    throw new Error(`Slack API error: ${err}`)
  }
  const matches =
    isRecord(data.messages) && Array.isArray(data.messages.matches)
      ? data.messages.matches
      : []
  return matches.filter(isRecord).map((item) => mapItem(item, input.query))
}

export const slackConnector: SourceConnector = {
  type: 'slack',
  name: 'Slack',
  requiredEnv: [
    'SLACK_MCP_SERVER_URL (MCP mode)',
    'SLACK_BOT_TOKEN (Web API mode)',
  ],
  configHint:
    'Either set SLACK_MCP_SERVER_URL (+ optional SLACK_MCP_AUTH_TOKEN), or set SLACK_BOT_TOKEN (search-capable token with search:read).',
  isConfigured() {
    return !!process.env.SLACK_MCP_SERVER_URL || !!process.env.SLACK_BOT_TOKEN
  },
  async search(input) {
    const opts = mcpOptions()
    if (opts) return searchViaMcp(opts, input)
    const token = process.env.SLACK_BOT_TOKEN
    if (token) return searchViaWebApi(token, input)
    throw new Error('Slack is not configured.')
  },
}
