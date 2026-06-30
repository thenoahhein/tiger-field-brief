import { Link, createFileRoute } from '@tanstack/react-router'
import { getSourceStatuses } from '../../server/sources'

export const Route = createFileRoute('/sources/')({
  loader: () => getSourceStatuses(),
  component: Sources,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading sources…</p>
  ),
})

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
      Configured
    </span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
      Not configured
    </span>
  )
}

function Sources() {
  const statuses = Route.useLoaderData()

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sources</h1>
        <Link
          to="/sources/search"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Search Sources
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        External sources are read-only and environment-variable driven. Unset
        sources show as “Not configured” and are skipped — nothing breaks.
      </p>

      <div className="mt-6 space-y-3">
        {statuses.map((s) => (
          <div
            key={s.type}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">{s.name}</div>
              {s.type === 'manual' ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                  Available
                </span>
              ) : (
                <StatusBadge configured={s.configured} />
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">{s.configHint}</p>
            {s.requiredEnv.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.requiredEnv.map((env) => (
                  <code
                    key={env}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                  >
                    {env}
                  </code>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-4 text-sm">
        <Link to="/sources/search" className="underline">
          Search sources
        </Link>
        <Link to="/sources/runs" className="underline">
          Past search runs
        </Link>
      </div>
    </div>
  )
}
