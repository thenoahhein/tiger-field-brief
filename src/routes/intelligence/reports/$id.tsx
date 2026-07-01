import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, createFileRoute } from '@tanstack/react-router'
import { getIntelligenceReport } from '../../../server/intelligence'

export const Route = createFileRoute('/intelligence/reports/$id')({
  loader: ({ params }) => getIntelligenceReport({ data: { id: params.id } }),
  component: IntelligenceReportDetail,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading report…</p>
  ),
})

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function IntelligenceReportDetail() {
  const report = Route.useLoaderData()
  if (!report) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Report not found</h1>
        <Link to="/intelligence" className="mt-2 inline-block text-sm underline">
          Back to intelligence loop
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link to="/intelligence" className="text-sm text-slate-500 underline">
        Back to intelligence loop
      </Link>
      <div className="mt-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {report.reportType.replaceAll('_', ' ')} ·{' '}
          {formatDate(report.periodStart)} to {formatDate(report.periodEnd)}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {report.title ?? 'Untitled intelligence report'}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          {report.summary}
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Action Queue</h2>
        {report.actionItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No action items were generated for this report.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {report.actionItems.map((action) => (
              <div
                key={action.id}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-0.5">
                    {action.owner ?? 'Unassigned'}
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-0.5">
                    {action.useFor?.replaceAll('_', ' ') ?? 'general'}
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
                {action.evidence.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                    {action.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel title="What We Learned" items={report.learned} />
        <Panel title="Repeated Pains" items={report.repeatedPains} />
        <Panel title="Product Confusion" items={report.productConfusion} />
        <Panel title="Sales Notes" items={report.salesNotes} />
        <Panel title="Product Notes" items={report.productNotes} />
        <div>
          <h2 className="text-lg font-semibold">Competitors</h2>
          <div className="mt-3 space-y-3">
            {report.competitors.length === 0 ? (
              <p className="text-sm text-slate-500">No competitor pattern.</p>
            ) : (
              report.competitors.map((c) => (
                <div
                  key={`${c.name}-${c.whyItMatters}`}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div className="font-semibold">{c.name}</div>
                  <p className="mt-1 text-sm text-slate-700">
                    {c.whyItMatters}
                  </p>
                  {c.evidence.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                      {c.evidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Full Report</h2>
        <div className="prose prose-slate mt-3 max-w-none rounded-lg border border-slate-200 bg-white p-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report.fullMarkdown}
          </ReactMarkdown>
        </div>
      </section>
    </div>
  )
}

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No clear pattern.</p>
      ) : (
        <ul className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
