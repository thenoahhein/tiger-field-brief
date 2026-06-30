import { isRecord } from './util'

/**
 * Minimal, dependency-free MCP (Model Context Protocol) client over the
 * Streamable HTTP transport (JSON-RPC 2.0 POST). It supports just what we need
 * for READ-ONLY source search: `initialize`, `tools/list`, and `tools/call`.
 *
 * This is intentionally a thin v0 wrapper. Different MCP servers expose
 * different tool names and argument/return shapes, so callers pass the tool
 * name (or a list of candidates) and defensively map the result. If you need a
 * fuller client later, swap this for the official `@modelcontextprotocol/sdk`.
 *
 * NOTE: never log auth tokens or full payloads from here.
 */

export type McpClientOptions = {
  serverUrl: string
  authToken?: string
}

export type McpContent = {
  /** Best-effort text extracted from the tool result content blocks. */
  text: string
  /** Structured content, if the server returned `structuredContent`. */
  structured?: unknown
  /** Raw content blocks for callers that want to map them. */
  blocks: unknown[]
}

let requestId = 0

async function rpc(
  opts: McpClientOptions,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // MCP Streamable HTTP servers may stream via SSE; accept both.
    Accept: 'application/json, text/event-stream',
  }
  if (opts.authToken) headers.Authorization = `Bearer ${opts.authToken}`

  const res = await fetch(opts.serverUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: ++requestId,
      method,
      params,
    }),
  })
  if (!res.ok) {
    throw new Error(`MCP ${method} failed (${res.status}).`)
  }

  const raw = await res.text()
  const json = parseMaybeSse(raw)
  if (isRecord(json) && isRecord(json.error)) {
    const msg =
      typeof json.error.message === 'string' ? json.error.message : 'error'
    throw new Error(`MCP ${method} error: ${msg}`)
  }
  return isRecord(json) ? json.result : undefined
}

/** Parse either a plain JSON body or an SSE stream containing JSON data lines. */
function parseMaybeSse(body: string): unknown {
  const trimmed = body.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed)
  }
  // SSE: take the last `data:` line that parses as JSON.
  const dataLines = trimmed
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice('data:'.length).trim())
  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i])
    } catch {
      // keep looking
    }
  }
  throw new Error('MCP response was not valid JSON.')
}

/** List available tool names from the server. */
export async function listTools(opts: McpClientOptions): Promise<string[]> {
  await rpc(opts, 'initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'tiger-field-brief', version: '0.1.0' },
  }).catch(() => undefined)
  const result = await rpc(opts, 'tools/list', {})
  if (isRecord(result) && Array.isArray(result.tools)) {
    return result.tools
      .filter(isRecord)
      .map((t) => (typeof t.name === 'string' ? t.name : ''))
      .filter((n) => n.length > 0)
  }
  return []
}

/** Call a tool by name with arguments and return normalized content. */
export async function callTool(
  opts: McpClientOptions,
  name: string,
  args: Record<string, unknown>,
): Promise<McpContent> {
  const result = await rpc(opts, 'tools/call', { name, arguments: args })
  const blocks =
    isRecord(result) && Array.isArray(result.content) ? result.content : []
  const text = blocks
    .filter(isRecord)
    .map((b) => (typeof b.text === 'string' ? b.text : ''))
    .filter(Boolean)
    .join('\n')
  const structured = isRecord(result) ? result.structuredContent : undefined
  return { text, structured, blocks }
}

/**
 * Pick the first tool name that matches one of the preferred candidates
 * (case-insensitive substring match), so connectors work across servers that
 * name their search tool slightly differently.
 */
export function pickTool(
  available: string[],
  candidates: string[],
): string | undefined {
  for (const c of candidates) {
    const exact = available.find((t) => t.toLowerCase() === c.toLowerCase())
    if (exact) return exact
  }
  for (const c of candidates) {
    const partial = available.find((t) =>
      t.toLowerCase().includes(c.toLowerCase()),
    )
    if (partial) return partial
  }
  return undefined
}
