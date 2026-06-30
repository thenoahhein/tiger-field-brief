import { Link, createFileRoute } from '@tanstack/react-router'
import { listSourceRuns } from '../../../server/sources'

export const Route = createFileRoute('/sources/runs/')({
  loader: () => listSourceRuns(),
  component: SourceRuns,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading runs…</p>
  ),
})

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SourceRuns() {
  const runs = Route.useLoaderData()

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Source Search Runs</h1>
        <Link
          to="/sources/search"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Search Sources
        </Link>
      </div>

      {runs.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No source searches yet.{' '}
          <Link to="/sources/search" className="underline">
            Run one.
          </Link>
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Query</th>
                <th className="px-3 py-2">Results</th>
                <th className="px-3 py-2">Brief</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-3 py-2 text-slate-600">
                    {formatDateTime(run.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                      {run.sourceType}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-700">{run.query}</td>
                  <td className="px-3 py-2 text-slate-700">{run.resultCount}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {run.converted ? 'yes' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to="/sources/runs/$id"
                      params={{ id: run.id }}
                      className="text-slate-500 underline"
                    >
                      view
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
