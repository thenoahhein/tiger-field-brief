import { Link, createFileRoute } from '@tanstack/react-router'
import { getSourceRun } from '../../../server/sources'

export const Route = createFileRoute('/sources/runs/$id')({
  loader: ({ params }) => getSourceRun({ data: { id: params.id } }),
  component: SourceRunDetail,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading run…</p>
  ),
})

function SourceRunDetail() {
  const run = Route.useLoaderData()

  if (!run) {
    return (
      <div>
        <p className="text-slate-600">Run not found.</p>
        <Link to="/sources/runs" className="mt-2 inline-block text-sm underline">
          Back to runs
        </Link>
      </div>
    )
  }

  const date = new Date(run.createdAt).toLocaleString()

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/sources/runs"
          className="text-sm text-slate-500 hover:underline"
        >
          ← Source runs
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          “{run.query}”
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded bg-slate-100 px-2 py-0.5">
            {run.sourceType}
          </span>
          <span>{date}</span>
          <span>{run.results.length} results</span>
          {run.limit != null && <span>limit {run.limit}</span>}
        </div>
      </div>

      {run.briefIds.length > 0 && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Brief generated from this run:{' '}
          {run.briefIds.map((id, i) => (
            <span key={id}>
              {i > 0 && ', '}
              <Link
                to="/briefs/$id"
                params={{ id }}
                className="font-medium underline"
              >
                view brief
              </Link>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {run.results.length === 0 ? (
          <p className="text-sm text-slate-400">No results were returned.</p>
        ) : (
          run.results.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">
                  {r.sourceType}
                </span>
                {r.author && <span>@{r.author}</span>}
                {r.channel && <span>#{r.channel}</span>}
                {r.publishedAt && (
                  <span>{new Date(r.publishedAt).toLocaleDateString()}</span>
                )}
                {r.briefId && (
                  <Link
                    to="/briefs/$id"
                    params={{ id: r.briefId }}
                    className="underline"
                  >
                    in brief
                  </Link>
                )}
              </div>
              {r.title && (
                <div className="mt-1 font-medium text-slate-900">{r.title}</div>
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {r.text}
              </p>
              {r.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-slate-500 underline"
                >
                  {r.url}
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
