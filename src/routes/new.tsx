import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { generateBrief } from '../server/briefs'

export const Route = createFileRoute('/new')({ component: NewBrief })

function today() {
  return new Date().toISOString().slice(0, 10)
}

function Field({
  label,
  name,
  placeholder,
}: {
  label: string
  name: string
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </label>
  )
}

function NewBrief() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const rawText = String(fd.get('rawText') ?? '').trim()
    if (!rawText) {
      setError('Raw notes are required.')
      return
    }
    setLoading(true)
    try {
      const { id } = await generateBrief({
        data: {
          rawText,
          noteDate: String(fd.get('noteDate') || today()),
          source: String(fd.get('source') ?? ''),
          company: String(fd.get('company') ?? ''),
          persona: String(fd.get('persona') ?? ''),
          workload: String(fd.get('workload') ?? ''),
        },
      })
      navigate({ to: '/briefs/$id', params: { id } })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong generating the brief.',
      )
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">New Field Brief</h1>
      <p className="mt-1 text-sm text-slate-600">
        Paste raw notes and add optional metadata, then generate a structured
        brief.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Raw Notes</span>
          <textarea
            name="rawText"
            rows={10}
            placeholder="Paste call notes, Slack threads, support tickets, competitor mentions…"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source" name="source" placeholder="Sales call, Slack…" />
          <Field
            label="Company / Account"
            name="company"
            placeholder="Acme Corp"
          />
          <Field label="Persona" name="persona" placeholder="Platform eng" />
          <Field
            label="Workload"
            name="workload"
            placeholder="IoT metrics, observability…"
          />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              name="noteDate"
              defaultValue={today()}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Generating…' : 'Generate Brief'}
        </button>
        {loading && (
          <p className="text-sm text-slate-500">
            Sending notes to the LLM and extracting signals — this can take a few
            seconds.
          </p>
        )}
      </form>
    </div>
  )
}
