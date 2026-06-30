/**
 * Shared types for the external source-connector layer.
 *
 * Every external integration (web search, X, Slack) and the built-in manual
 * paste flow are modelled as a {@link SourceConnector} that produces a normalized
 * {@link SourceSearchResult}. This keeps the rest of the app (search UI, persistence,
 * brief generation) decoupled from the specifics of any one provider.
 *
 * All connectors are READ-ONLY. They never post, send, or mutate remote state.
 */

export type SourceType = 'manual' | 'web' | 'x' | 'slack'

/** A single normalized result returned by any source connector. */
export type SourceSearchResult = {
  sourceType: SourceType
  sourceName: string
  title?: string
  url?: string
  author?: string
  channel?: string
  publishedAt?: string
  capturedAt: string
  text: string
  metadata?: Record<string, unknown>
}

/** Search parameters passed to a connector. */
export type SourceSearchInput = {
  query: string
  limit?: number
  since?: string
  until?: string
}

/** A read-only connector for one external source type. */
export type SourceConnector = {
  /** Stable source type discriminator. */
  type: SourceType
  /** Human-readable name shown in the UI. */
  name: string
  /** Env vars the operator must set for this connector to be usable. */
  requiredEnv: string[]
  /** Short description of how to configure this source. */
  configHint: string
  /** True when the required env vars are present. */
  isConfigured(): boolean
  /** Run a read-only search and return normalized results. */
  search(input: SourceSearchInput): Promise<SourceSearchResult[]>
}

/** Configuration status of a single source, for the /sources page. */
export type SourceStatus = {
  type: SourceType
  name: string
  configured: boolean
  requiredEnv: string[]
  configHint: string
}
