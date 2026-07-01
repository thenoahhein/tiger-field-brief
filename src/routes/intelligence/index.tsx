import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  createWatchlist,
  deleteWatchlist,
  generateWeeklyReport,
  getIntelligenceDashboard,
  runWatchlists,
  toggleWatchlist,
  updateActionStatus,
} from '../../server/intelligence'

export const Route = createFileRoute('/intelligence/')({
  loader: () => getIntelligenceDashboard(),
  component: IntelligenceDashboard,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading intelligence loop…</p>
  ),
})

const REPORT_TYPES = [
  { value: 'weekly_synthesis', label: 'Weekly Synthesis' },
  { value: 'competitive_pressure', label: 'Competitive Pressure' },
  { value: 'docs_confusion', label: 'Docs Confusion' },
  { value: 'customer_language', label: 'Customer Language' },
] as const

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function labelText(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ') : 'Unassigned'
}

function IntelligenceDashboard() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reportType, setReportType] = useState<string>('weekly_synthesis')
  const [reportDays, setReportDays] = useState(7)
  const [showNewWatchlist, setShowNewWatchlist] = useState(false)

  const dueCount = data.watchlists.filter((w) => w.due).length
  const configured = data.sourceStatuses.filter(
    (s) => s.type !== 'manual' && s.configured,
  )

  async function refresh() {
    await router.invalidate()
  }

  async function runDue() {
    setBusy('runs')
    setError(null)
    setMessage(null)
    try {
      const res = await runWatchlists({ data: { mode: 'due' } })
      setMessage(`Ran ${res.count} due watchlist${res.count === 1 ? '' : 's'}.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watchlist run failed.')
    } finally {
      setBusy(null)
    }
  }

  async function createReport() {
    setBusy('report')
    setError(null)
    setMessage(null)
    try {
      const { id } = await generateWeeklyReport({
        data: { reportType, days: reportDays },
      })
      const typeLabel =
        REPORT_TYPES.find((t) => t.value === reportType)?.label ?? reportType
      setMessage(`Generated ${typeLabel} report.`)
      await refresh()
      router.navigate({ to: '/intelligence/reports/$id', params: { id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed.')
    } finally {
      setBusy(null)
    }
  }

  async function setActionStatus(
    id: string,
    status: 'accepted' | 'ignored' | 'done',
  ) {
    setBusy(id)
    setError(null)
    try {
      await updateActionStatus({ data: { id, status } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action update failed.')
    } finally {
      setBusy(null)
    }
  }

  async function handleToggleWatchlist(id: string) {
    setBusy(`toggle-${id}`)
    setError(null)
    try {
      await toggleWatchlist({ data: { id } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed.')
    } finally {
      setBusy(null)
    }
  }

  async function handleDeleteWatchlist(id: string) {
    setBusy(`delete-${id}`)
    setError(null)
    try {
      await deleteWatchlist({ data: { id } })
      setMessage('Watchlist deleted.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            GTM Intelligence Loop
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Scheduled watchlists pull read-only source signal, generate briefs
            and signals, then roll the week into actions for PMM, Sales, Docs,
            Product, and DevRel.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={runDue}
            disabled={busy !== null || dueCount === 0 || configured.length === 0}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'runs' ? 'Running…' : `Run Due (${dueCount})`}
          </button>
          <div className="flex items-end gap-1">
            <div>
              <label
                htmlFor="reportType"
                className="block text-xs text-slate-500"
              >
                Report type
              </label>
              <select
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="reportDays"
                className="block text-xs text-slate-500"
              >
                Days
              </label>
              <input
                id="reportDays"
                type="number"
                min={1}
                max={90}
                value={reportDays}
                onChange={(e) => setReportDays(Number(e.target.value))}
                className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={createReport}
              disabled={busy !== null}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === 'report' ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-4">
        <Metric label="Configured sources" value={String(configured.length)} />
        <Metric label="Watchlists" value={String(data.watchlists.length)} />
        <Metric label="Due now" value={String(dueCount)} />
        <Metric label="Open actions" value={String(data.actions.length)} />
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recommended Actions</h2>
          <span className="text-xs text-slate-500">
            Auto-generated from briefs and reports
          </span>
        </div>
        {data.actions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No open action items yet. Run watchlists, then generate a report.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {data.actions.map((action) => (
              <div key={action.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span
                        className={`rounded px-2 py-0.5 ${action.origin === 'brief' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}
                      >
                        {action.origin}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">
                        {labelText(action.owner)}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">
                        {labelText(action.useFor)}
                      </span>
                      <span>{action.status}</span>
                    </div>
                    <h3 className="mt-1 font-semibold text-slate-900">
                      {action.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-700">
                      {action.recommendation}
                    </p>
                    {action.rationale && (
                      <p className="mt-1 text-xs text-slate-500">
                        {action.rationale}
                      </p>
                    )}
                    <div className="mt-2 flex gap-3">
                      {action.reportId && (
                        <Link
                          to="/intelligence/reports/$id"
                          params={{ id: action.reportId }}
                          className="text-xs text-slate-500 underline"
                        >
                          View report
                        </Link>
                      )}
                      {action.briefId && (
                        <Link
                          to="/briefs/$id"
                          params={{ id: action.briefId }}
                          className="text-xs text-slate-500 underline"
                        >
                          View brief
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(['accepted', 'done', 'ignored'] as const).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setActionStatus(action.id, status)}
                          disabled={busy !== null}
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {status}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Watchlists</h2>
          <button
            type="button"
            onClick={() => setShowNewWatchlist((v) => !v)}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {showNewWatchlist ? 'Cancel' : 'New Watchlist'}
          </button>
        </div>
        {showNewWatchlist && (
          <NewWatchlistForm
            busy={busy !== null}
            onCreated={() => {
              setShowNewWatchlist(false)
              setMessage('Watchlist created.')
              refresh()
            }}
            onError={(msg) => setError(msg)}
          />
        )}
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Cadence</th>
                <th className="px-3 py-2">Last run</th>
                <th className="px-3 py-2">Next run</th>
                <th className="px-3 py-2">Results</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.watchlists.map((w) => (
                <tr
                  key={w.id}
                  className={
                    !w.enabled
                      ? 'opacity-50'
                      : w.due
                        ? 'bg-amber-50/50'
                        : undefined
                  }
                >
                  <td className="px-3 py-3 align-top">
                    <div className="font-medium text-slate-900">{w.name}</div>
                    <div className="mt-1 max-w-xl text-xs text-slate-500">
                      {w.query}
                    </div>
                    {w.lastError && (
                      <div className="mt-1 text-xs text-red-600">
                        {w.lastError}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 align-top">{w.sourceType}</td>
                  <td className="px-3 py-3 align-top">{w.cadence}</td>
                  <td className="px-3 py-3 align-top">
                    {formatDate(w.lastRunAt)}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {formatDate(w.nextRunAt)}
                  </td>
                  <td className="px-3 py-3 align-top">
                    {w.lastResultCount ?? '—'}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleToggleWatchlist(w.id)}
                        disabled={busy !== null}
                        className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:border-slate-400 disabled:opacity-60"
                      >
                        {w.enabled ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWatchlist(w.id)}
                        disabled={busy !== null}
                        className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:border-red-400 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold">Latest Reports</h2>
          <div className="mt-3 space-y-3">
            {data.reports.length === 0 ? (
              <p className="text-sm text-slate-500">
                No reports generated yet.
              </p>
            ) : (
              data.reports.map((report) => (
                <Link
                  key={report.id}
                  to="/intelligence/reports/$id"
                  params={{ id: report.id }}
                  className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="text-xs text-slate-500">
                    {report.reportType.replaceAll('_', ' ')} ·{' '}
                    {formatDate(report.createdAt)}
                  </div>
                  <div className="mt-1 font-semibold">
                    {report.title ?? 'Untitled report'}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {report.summary}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Recent Runs</h2>
          <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {data.recentRuns.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No runs yet.</p>
            ) : (
              data.recentRuns.map((run) => (
                <div key={run.id} className="p-4 text-sm">
                  <div className="font-medium">
                    {run.watchlistName ?? 'Manual source search'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDate(run.createdAt)} · {run.sourceType} ·{' '}
                    {run.resultCount} results
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{run.query}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function NewWatchlistForm({
  busy,
  onCreated,
  onError,
}: {
  busy: boolean
  onCreated: () => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('competitive')
  const [sourceType, setSourceType] = useState('all')
  const [query, setQuery] = useState('')
  const [cadence, setCadence] = useState('daily')
  const [limit, setLimit] = useState(10)
  const [lookbackDays, setLookbackDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await createWatchlist({
        data: { name, category, sourceType, query, cadence, limit, lookbackDays },
      })
      onCreated()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div className="sm:col-span-2">
        <label htmlFor="wl-name" className="block text-xs text-slate-500">
          Name
        </label>
        <input
          id="wl-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="wl-category" className="block text-xs text-slate-500">
          Category
        </label>
        <input
          id="wl-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="wl-source" className="block text-xs text-slate-500">
          Source
        </label>
        <select
          id="wl-source"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All</option>
          <option value="web">Web</option>
          <option value="x">X</option>
          <option value="slack">Slack</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <label htmlFor="wl-query" className="block text-xs text-slate-500">
          Query
        </label>
        <input
          id="wl-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="wl-cadence" className="block text-xs text-slate-500">
          Cadence
        </label>
        <select
          id="wl-cadence"
          value={cadence}
          onChange={(e) => setCadence(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      <div>
        <label htmlFor="wl-limit" className="block text-xs text-slate-500">
          Result limit
        </label>
        <input
          id="wl-limit"
          type="number"
          min={1}
          max={50}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label htmlFor="wl-lookback" className="block text-xs text-slate-500">
          Lookback days
        </label>
        <input
          id="wl-lookback"
          type="number"
          min={1}
          max={90}
          value={lookbackDays}
          onChange={(e) => setLookbackDays(Number(e.target.value))}
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={busy || submitting}
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
