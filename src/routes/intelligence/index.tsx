import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import {
  generateWeeklyReport,
  getIntelligenceDashboard,
  runWatchlists,
  updateActionStatus,
} from '../../server/intelligence'

export const Route = createFileRoute('/intelligence/')({
  loader: () => getIntelligenceDashboard(),
  component: IntelligenceDashboard,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading intelligence loop…</p>
  ),
})

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function label(value: string | null | undefined) {
  return value ? value.replaceAll('_', ' ') : 'Unassigned'
}

function IntelligenceDashboard() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        data: { reportType: 'weekly_synthesis', days: 7 },
      })
      setMessage('Generated weekly synthesis.')
      await refresh()
      router.navigate({ to: '/intelligence/reports/$id', params: { id } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report generation failed.')
    } finally {
      setBusy(null)
    }
  }

  async function setActionStatus(id: string, status: 'accepted' | 'ignored' | 'done') {
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runDue}
            disabled={busy !== null || dueCount === 0 || configured.length === 0}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'runs' ? 'Running…' : `Run Due (${dueCount})`}
          </button>
          <button
            type="button"
            onClick={createReport}
            disabled={busy !== null}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === 'report' ? 'Generating…' : 'Generate Weekly Report'}
          </button>
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
            New and accepted items from generated reports
          </span>
        </div>
        {data.actions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No open action items yet. Run watchlists, then generate a weekly
            report.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {data.actions.map((action) => (
              <div key={action.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-0.5">
                        {label(action.owner)}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">
                        {label(action.useFor)}
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
                    {action.reportId && (
                      <Link
                        to="/intelligence/reports/$id"
                        params={{ id: action.reportId }}
                        className="mt-2 inline-block text-xs text-slate-500 underline"
                      >
                        View report
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {(['accepted', 'done', 'ignored'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setActionStatus(action.id, status)}
                        disabled={busy !== null}
                        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Watchlists</h2>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.watchlists.map((w) => (
                <tr key={w.id} className={w.due ? 'bg-amber-50/50' : undefined}>
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
              <p className="text-sm text-slate-500">No reports generated yet.</p>
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
