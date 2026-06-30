import { afterEach, describe, expect, it, vi } from 'vitest'
import { webConnector } from './web'

const originalEnv = { ...process.env }

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

describe('webConnector', () => {
  it('uses Perplexity Search when PERPLEXITY_API_KEY is set', async () => {
    delete process.env.WEB_SEARCH_API_KEY
    delete process.env.WEB_SEARCH_PROVIDER
    process.env.PERPLEXITY_API_KEY = 'pplx-test-key'

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer pplx-test-key',
      )
      expect(JSON.parse(String(init?.body))).toMatchObject({
        query: 'postgres analytics',
        max_results: 2,
        search_context_size: 'low',
      })

      return Response.json({
        id: 'search-123',
        results: [
          {
            title: 'TigerData Postgres Analytics',
            url: 'https://www.tigerdata.com/',
            snippet: 'PostgreSQL analytics signal',
            date: '2026-06-30',
            last_updated: '2026-06-30',
          },
        ],
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      webConnector.search({ query: 'postgres analytics', limit: 2 }),
    ).resolves.toMatchObject([
      {
        sourceType: 'web',
        sourceName: 'perplexity',
        title: 'TigerData Postgres Analytics',
        url: 'https://www.tigerdata.com/',
        publishedAt: '2026-06-30',
        text: 'PostgreSQL analytics signal',
        metadata: { query: 'postgres analytics', requestId: 'search-123' },
      },
    ])
  })
})
