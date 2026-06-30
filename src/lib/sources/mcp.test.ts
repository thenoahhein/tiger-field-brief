import { afterEach, describe, expect, it, vi } from 'vitest'
import { callTool, listTools } from './mcp'

type SeenRequest = {
  method: string
  protocolVersion: string | undefined
  sessionId: string | undefined
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MCP Streamable HTTP client', () => {
  it('initializes once and carries protocol and session headers', async () => {
    const seen: SeenRequest[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        const body = JSON.parse(String(init?.body)) as {
          id?: number
          method?: string
        }
        const method = body.method ?? ''

        seen.push({
          method,
          protocolVersion: headers.get('MCP-Protocol-Version') ?? undefined,
          sessionId: headers.get('Mcp-Session-Id') ?? undefined,
        })

        if (method === 'initialize') {
          return Response.json(
            {
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: '2025-06-18',
                serverInfo: { name: 'test-mcp', version: '0.0.0' },
                capabilities: { tools: {} },
              },
            },
            { headers: { 'Mcp-Session-Id': 'session-123' } },
          )
        }

        if (method === 'notifications/initialized') {
          return new Response(null, { status: 202 })
        }

        if (method === 'tools/list') {
          return Response.json({
            jsonrpc: '2.0',
            id: body.id,
            result: { tools: [{ name: 'search_posts_all' }] },
          })
        }

        if (method === 'tools/call') {
          return new Response(
            `event: message\ndata: ${JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { content: [{ type: 'text', text: 'ok' }] },
            })}\n\n`,
            { headers: { 'Content-Type': 'text/event-stream' } },
          )
        }

        return new Response(null, { status: 404 })
      }),
    )

    const opts = {
      serverUrl: 'https://mcp.example.test/session',
      protocolVersion: '2025-06-18',
    }

    await expect(listTools(opts)).resolves.toEqual(['search_posts_all'])
    await expect(callTool(opts, 'search_posts_all', { query: 'timescale' }))
      .resolves.toMatchObject({ text: 'ok' })

    expect(seen).toEqual([
      {
        method: 'initialize',
        protocolVersion: '2025-06-18',
        sessionId: undefined,
      },
      {
        method: 'notifications/initialized',
        protocolVersion: '2025-06-18',
        sessionId: 'session-123',
      },
      {
        method: 'tools/list',
        protocolVersion: '2025-06-18',
        sessionId: 'session-123',
      },
      {
        method: 'tools/call',
        protocolVersion: '2025-06-18',
        sessionId: 'session-123',
      },
    ])
  })
})
