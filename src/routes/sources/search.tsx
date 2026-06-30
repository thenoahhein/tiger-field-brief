import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  generateBriefFromResults,
  getSourceStatuses,
  searchSources,
} from '../../server/sources'
import {
  defaultSearchGroupLabels,
  defaultSearches,
  type DefaultSearchGroup,
} from '../../config/default-searches'

export const Route = createFileRoute('/sources/search')({
  loader: () => getSourceStatuses(),
  component: SourceSearch,
})

type SearchResult = {
  id: string
  sourceType: string
  sourceName: string | null
  title: string | null
  url: string | null
  author: string | null
  channel: string | null
  publishedAt: Date | string | null
  text: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function SourceSearch() {
  const statuses = Route.useLoaderData()
  const navigate = useNavigate()

  const configured = useMemo(
    () => statuses.filter((s) => s.type !== 'manual' && s.configured),
    [statuses],
  )

  const [source, setSource] = useState<string>(
    configured[0]?.type ?? 'web',
  )
  const [query, setQuery] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [limit, setLimit] = useState(10)

  const [searching, setSearching] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searched, setSearched] = useState(false)

  const anyConfigured = configured.length > 0

  async function runSearch(q: string) {
    setError(null)
    setWarnings([])
    setSearching(true)
    setSearched(true)
    setSelected(new Set())
    try {
      const res = await searchSources({
        data: {
          source: source as 'web' | 'x' | 'slack' | 'all',
          query: q,
          limit,
          since: since || undefined,
          until: until || undefined,
        },
      })
      setResults(res.results as SearchResult[])
      setWarnings(res.errors.map((e) => `${e.source}: ${e.message}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!query.trim()) {
      setError('A query is required.')
      return
    }
    void runSearch(query.trim())
  }

  function onDefaultSearch(q: string) {
    setQuery(q)
    void runSearch(q)
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function onGenerate() {
    if (selected.size === 0) return
    setError(null)
    setGenerating(true)
    try {
      const { id } = await generateBriefFromResults({
        data: { resultIds: Array.from(selected), noteDate: today() },
      })
      navigate({ to: '/briefs/$id', params: { id } })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate brief.',
      )
      setGenerating(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Search Sources</h1>
      <p className="mt-1 text-sm text-slate-600">
        Pull read-only GTM signal from configured external sources, then turn
        selected results into a field brief.
      </p>

      {!anyConfigured && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No external sources are configured. See{' '}
          <a href="/sources" className="underline">
            /sources
          </a>{' '}
          for the required environment variables.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-5">
          <label className="block sm:col-span-1">
            <span className="text-xs font-medium text-slate-600">Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="all">All configured</option>
              {statuses
                .filter((s) => s.type !== 'manual')
                .map((s) => (
                  <option key={s.type} value={s.type} disabled={!s.configured}>
                    {s.name}
                    {s.configured ? '' : ' (not configured)'}
                  </option>
                ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-slate-600">Query</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="TimescaleDB, ClickHouse migration…"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Limit</span>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 10)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              Since (optional)
            </span>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">
              Until (optional)
            </span>
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={searching || !anyConfigured}
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searching ? 'Searching…' : 'Search Sources'}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Default searches
        </div>
        <div className="mt-3 space-y-3">
          {(Object.keys(defaultSearches) as DefaultSearchGroup[]).map(
            (group) => (
              <div key={group}>
                <div className="text-xs font-medium text-slate-500">
                  {defaultSearchGroupLabels[group]}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {defaultSearches[group].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onDefaultSearch(q)}
                      disabled={searching || !anyConfigured}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}

      {searched && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {results.length} result{results.length === 1 ? '' : 's'}
              {selected.size > 0 ? ` · ${selected.size} selected` : ''}
            </p>
            <button
              type="button"
              onClick={onGenerate}
              disabled={selected.size === 0 || generating}
              className="inline-flex items-center rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating
                ? 'Generating…'
                : 'Generate Brief From Selected Results'}
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {results.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="mt-1 h-4 w-4"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">
                      {r.sourceType}
                    </span>
                    {r.author && <span>@{r.author}</span>}
                    {r.channel && <span>#{r.channel}</span>}
                    {r.publishedAt && (
                      <span>
                        {new Date(r.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {r.title && (
                    <div className="mt-1 font-medium text-slate-900">
                      {r.title}
                    </div>
                  )}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {r.text}
                  </p>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-block text-xs text-slate-500 underline"
                    >
                      {r.url}
                    </a>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
