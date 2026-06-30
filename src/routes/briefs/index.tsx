import { Link, createFileRoute } from '@tanstack/react-router'
import { listBriefs } from '../../server/briefs'

export const Route = createFileRoute('/briefs/')({
  loader: () => listBriefs(),
  component: Briefs,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading briefs…</p>
  ),
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function Briefs() {
  const briefs = Route.useLoaderData()

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Briefs</h1>
        <Link
          to="/new"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          New Brief
        </Link>
      </div>

      {briefs.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No briefs yet.{' '}
          <Link to="/new" className="underline">
            Generate your first one.
          </Link>
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {briefs.map((b) => (
            <Link
              key={b.id}
              to="/briefs/$id"
              params={{ id: b.id }}
              className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{formatDate(b.noteDate)}</span>
                {b.company && (
                  <span className="rounded bg-slate-100 px-2 py-0.5">
                    {b.company}
                  </span>
                )}
              </div>
              <div className="mt-1 font-semibold">
                {b.title ?? 'Untitled brief'}
              </div>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Strongest Market Signal
                  </dt>
                  <dd className="text-slate-700">
                    {b.strongestMarketSignal ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Recommended Action
                  </dt>
                  <dd className="text-slate-700">
                    {b.recommendedAction ?? '—'}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
