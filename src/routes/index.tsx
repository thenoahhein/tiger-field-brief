import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

const links = [
  {
    to: '/new',
    title: 'New Field Brief',
    desc: 'Paste raw GTM notes and generate a structured daily brief.',
  },
  {
    to: '/sources',
    title: 'Sources',
    desc: 'Pull read-only GTM signal from web, X, and Slack into a brief.',
  },
  {
    to: '/briefs',
    title: 'Briefs',
    desc: 'Browse past daily briefs in reverse chronological order.',
  },
  {
    to: '/signals',
    title: 'Signals',
    desc: 'Search and filter every extracted GTM signal.',
  },
]

function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Tiger Field Brief</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Collect raw GTM signal for TigerData's time-series business and turn it
        into a daily field intelligence brief — customer pain, sales objections,
        competitor mentions, docs gaps, product confusion, and recommended PMM
        actions.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-lg border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="text-lg font-semibold">{l.title}</div>
            <p className="mt-1 text-sm text-slate-600">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
