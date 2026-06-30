import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { listSignals } from '../server/briefs'

export const Route = createFileRoute('/signals')({
  loader: () => listSignals({ data: {} }),
  component: Signals,
  pendingComponent: () => (
    <p className="text-sm text-slate-500">Loading signals…</p>
  ),
})

function uniq(values: Array<string | null>): string[] {
  return Array.from(
    new Set(values.filter((v): v is string => !!v && v.trim().length > 0)),
  ).sort()
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

function Signals() {
  const signals = Route.useLoaderData()
  const [competitor, setCompetitor] = useState('')
  const [workload, setWorkload] = useState('')
  const [painCategory, setPainCategory] = useState('')
  const [source, setSource] = useState('')
  const [q, setQ] = useState('')

  const competitors = useMemo(
    () => uniq(signals.map((s) => s.competitor)),
    [signals],
  )
  const workloads = useMemo(() => uniq(signals.map((s) => s.workload)), [signals])
  const painCategories = useMemo(
    () => uniq(signals.map((s) => s.painCategory)),
    [signals],
  )
  const sources = useMemo(() => uniq(signals.map((s) => s.source)), [signals])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return signals.filter((s) => {
      if (competitor && s.competitor !== competitor) return false
      if (workload && s.workload !== workload) return false
      if (painCategory && s.painCategory !== painCategory) return false
      if (source && s.source !== source) return false
      if (needle) {
        const hay = [s.exactCustomerLanguage, s.pain, s.suggestedAction]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [signals, competitor, workload, painCategory, source, q])

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Signals</h1>
      <p className="mt-1 text-sm text-slate-600">
        Every extracted GTM signal. Filter and search across customer language,
        pain, and suggested action.
      </p>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customer language, pain, suggested action…"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <FilterSelect
            label="Competitor"
            value={competitor}
            options={competitors}
            onChange={setCompetitor}
          />
          <FilterSelect
            label="Workload"
            value={workload}
            options={workloads}
            onChange={setWorkload}
          />
          <FilterSelect
            label="Pain category"
            value={painCategory}
            options={painCategories}
            onChange={setPainCategory}
          />
          <FilterSelect
            label="Source"
            value={source}
            options={sources}
            onChange={setSource}
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        {filtered.length} of {signals.length} signals
      </p>

      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Pain category</th>
              <th className="px-3 py-2">Pain</th>
              <th className="px-3 py-2">Competitor</th>
              <th className="px-3 py-2">Customer language</th>
              <th className="px-3 py-2">Suggested action</th>
              <th className="px-3 py-2">Brief</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  No matching signals.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-3 py-2 text-slate-700">{s.company ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {s.painCategory ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{s.pain ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {s.competitor ?? '—'}
                  </td>
                  <td className="max-w-xs px-3 py-2 italic text-slate-600">
                    {s.exactCustomerLanguage ?? '—'}
                  </td>
                  <td className="max-w-xs px-3 py-2 text-slate-700">
                    {s.suggestedAction ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    {s.rawNote.brief ? (
                      <Link
                        to="/briefs/$id"
                        params={{ id: s.rawNote.brief.id }}
                        className="text-slate-500 underline"
                      >
                        view
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
