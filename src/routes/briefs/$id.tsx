import { Link, createFileRoute } from '@tanstack/react-router'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getBrief } from '../../server/briefs'

export const Route = createFileRoute('/briefs/$id')({
  loader: ({ params }) => getBrief({ data: { id: params.id } }),
  component: BriefDetail,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading brief…</p>
  ),
})

function Card({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="mt-2 text-sm text-slate-800">{children}</div>
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (!items || items.length === 0)
    return <p className="text-slate-400">None noted.</p>
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

function BriefDetail() {
  const brief = Route.useLoaderData()

  if (!brief) {
    return (
      <div>
        <p className="text-slate-600">Brief not found.</p>
        <Link to="/briefs" className="mt-2 inline-block text-sm underline">
          Back to briefs
        </Link>
      </div>
    )
  }

  const date = new Date(brief.noteDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="space-y-6">
      <div>
        <Link to="/briefs" className="text-sm text-slate-500 hover:underline">
          ← Briefs
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {brief.title ?? 'Untitled brief'}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{date}</span>
          {brief.rawNote.company && (
            <span className="rounded bg-slate-100 px-2 py-0.5">
              {brief.rawNote.company}
            </span>
          )}
          {brief.rawNote.source && (
            <span className="rounded bg-slate-100 px-2 py-0.5">
              {brief.rawNote.source}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Strongest Market Signal">
          {brief.strongestMarketSignal ?? '—'}
        </Card>
        <Card title="Recommended Action">
          {brief.recommendedAction ?? '—'}
        </Card>
      </div>

      {brief.pmmTakeaway && <Card title="PMM Takeaway">{brief.pmmTakeaway}</Card>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Top Signals">
          <BulletList items={brief.topSignals} />
        </Card>
        <Card title="Repeated Pains">
          <BulletList items={brief.repeatedPains} />
        </Card>
        <Card title="Customer Language">
          <BulletList items={brief.customerLanguage} />
        </Card>
        <Card title="Product Confusion">
          <BulletList items={brief.productConfusion} />
        </Card>
        <Card title="Docs Gaps">
          <BulletList items={brief.docsGaps} />
        </Card>
        <Card title="Sales Enablement">
          <BulletList items={brief.salesEnablement} />
        </Card>
        <Card title="Product Feedback">
          <BulletList items={brief.productFeedback} />
        </Card>
        <Card title="Competitors">
          {brief.competitors.length === 0 ? (
            <p className="text-slate-400">None noted.</p>
          ) : (
            <ul className="space-y-2">
              {brief.competitors.map((c, i) => (
                <li key={i}>
                  <span className="font-semibold">{c.name}</span>
                  {c.whyMentioned && (
                    <span className="text-slate-600"> — {c.whyMentioned}</span>
                  )}
                  {c.implication && (
                    <div className="text-xs text-slate-500">{c.implication}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {brief.fullMarkdown && (
        <Card title="Full Brief">
          <div className="prose prose-sm max-w-none prose-slate">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {brief.fullMarkdown}
            </ReactMarkdown>
          </div>
        </Card>
      )}

      <Card title="Raw Notes">
        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700">
          {brief.rawNote.rawText}
        </pre>
      </Card>

      <section>
        <h2 className="text-lg font-semibold">
          Extracted Signals ({brief.signals.length})
        </h2>
        {brief.signals.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No signals extracted.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {brief.signals.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
              >
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {s.painCategory && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                      {s.painCategory}
                    </span>
                  )}
                  {s.competitor && (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-800">
                      {s.competitor}
                    </span>
                  )}
                  {s.workload && (
                    <span className="rounded bg-slate-100 px-2 py-0.5">
                      {s.workload}
                    </span>
                  )}
                  {typeof s.confidence === 'number' && (
                    <span className="rounded bg-slate-100 px-2 py-0.5">
                      confidence {s.confidence}
                    </span>
                  )}
                </div>
                {s.pain && (
                  <p className="mt-2">
                    <span className="font-medium">Pain:</span> {s.pain}
                  </p>
                )}
                {s.exactCustomerLanguage && (
                  <p className="mt-1 italic text-slate-600">
                    “{s.exactCustomerLanguage}”
                  </p>
                )}
                {s.suggestedAction && (
                  <p className="mt-1">
                    <span className="font-medium">Suggested action:</span>{' '}
                    {s.suggestedAction}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
