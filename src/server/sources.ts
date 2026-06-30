import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { persistBriefBundle } from './briefs'
import { generateFieldBrief } from './llm'
import {
  generateFromResultsSchema,
  sourceSearchSchema,
  type BriefMetadata,
} from './schema'
import {
  MAX_COMBINED_BRIEF_CHARS,
  SEARCHABLE_SOURCES,
  getConnector,
  listSourceStatuses,
  truncate,
  type SourceSearchResult,
  type SourceType,
} from '../lib/sources'

/** Configuration status of every source (manual, web, x, slack). */
export const getSourceStatuses = createServerFn({ method: 'GET' }).handler(
  async () => listSourceStatuses(),
)

/**
 * Run a read-only search against one configured source (or all configured
 * sources), persist a SourceSearchRun + SourceResult rows, and return them.
 * Per-source failures are captured and returned without failing the whole run.
 */
export const searchSources = createServerFn({ method: 'POST' })
  .validator((data: unknown) => sourceSearchSchema.parse(data))
  .handler(async ({ data }) => {
    const requested: Array<Exclude<SourceType, 'manual'>> =
      data.source === 'all' ? [...SEARCHABLE_SOURCES] : [data.source]

    const results: SourceSearchResult[] = []
    const errors: Array<{ source: string; message: string }> = []

    for (const type of requested) {
      const connector = getConnector(type)
      if (!connector.isConfigured()) {
        // Skip unconfigured sources silently when fanning out to "all"; surface
        // it as an error when the user explicitly picked this single source.
        if (data.source !== 'all') {
          errors.push({ source: type, message: `${connector.name} is not configured.` })
        }
        continue
      }
      try {
        const found = await connector.search({
          query: data.query,
          limit: data.limit,
          since: data.since,
          until: data.until,
        })
        results.push(...found)
      } catch (err) {
        errors.push({
          source: type,
          message: err instanceof Error ? err.message : 'Search failed.',
        })
      }
    }

    const run = await prisma.sourceSearchRun.create({
      data: {
        sourceType: data.source,
        query: data.query,
        since: data.since ? new Date(data.since) : null,
        until: data.until ? new Date(data.until) : null,
        limit: data.limit ?? null,
        results: {
          create: results.map((r) => ({
            sourceType: r.sourceType,
            sourceName: r.sourceName,
            title: r.title,
            url: r.url,
            author: r.author,
            channel: r.channel,
            publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
            capturedAt: new Date(r.capturedAt),
            text: r.text,
            metadataJson: (r.metadata ?? null) as Prisma.InputJsonValue,
          })),
        },
      },
      include: { results: true },
    })

    return { runId: run.id, results: run.results, errors }
  })

/** List past source search runs with result counts + whether a brief was made. */
export const listSourceRuns = createServerFn({ method: 'GET' }).handler(
  async () => {
    const runs = await prisma.sourceSearchRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        results: { select: { rawNoteId: true } },
      },
    })
    return runs.map((run) => ({
      id: run.id,
      createdAt: run.createdAt.toISOString(),
      sourceType: run.sourceType,
      query: run.query,
      resultCount: run.results.length,
      converted: run.results.some((r) => r.rawNoteId !== null),
    }))
  },
)

/** Fetch a single run with results + any generated brief link. */
export const getSourceRun = createServerFn({ method: 'GET' })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const run = await prisma.sourceSearchRun.findUnique({
      where: { id: data.id },
      include: {
        results: {
          orderBy: { createdAt: 'asc' },
          include: { rawNote: { select: { brief: { select: { id: true } } } } },
        },
      },
    })
    if (!run) return null

    const briefIds = Array.from(
      new Set(
        run.results
          .map((r) => r.rawNote?.brief?.id)
          .filter((id): id is string => !!id),
      ),
    )

    return {
      id: run.id,
      createdAt: run.createdAt.toISOString(),
      sourceType: run.sourceType,
      query: run.query,
      since: run.since?.toISOString() ?? null,
      until: run.until?.toISOString() ?? null,
      limit: run.limit,
      briefIds,
      results: run.results.map((r) => ({
        id: r.id,
        sourceType: r.sourceType,
        sourceName: r.sourceName,
        title: r.title,
        url: r.url,
        author: r.author,
        channel: r.channel,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        text: r.text,
        rawNoteId: r.rawNoteId,
        briefId: r.rawNote?.brief?.id ?? null,
      })),
    }
  })

/** Format selected source results into a single raw note for the LLM. */
function combineResults(
  results: Array<{
    sourceType: string
    sourceName: string | null
    title: string | null
    url: string | null
    author: string | null
    channel: string | null
    publishedAt: Date | null
    text: string
  }>,
): string {
  const blocks = results.map((r, i) => {
    const meta = [
      `source: ${r.sourceType}${r.sourceName ? ` (${r.sourceName})` : ''}`,
      r.author ? `author: ${r.author}` : null,
      r.channel ? `channel: ${r.channel}` : null,
      r.publishedAt ? `published: ${r.publishedAt.toISOString()}` : null,
      r.url ? `url: ${r.url}` : null,
    ]
      .filter(Boolean)
      .join(' | ')
    const heading = `--- Result ${i + 1}${r.title ? `: ${r.title}` : ''} ---`
    return `${heading}\n${meta}\n${r.text}`
  })
  // Cap total characters sent to the LLM.
  return truncate(blocks.join('\n\n'), MAX_COMBINED_BRIEF_CHARS)
}

/**
 * Combine selected source results into one raw note, run the existing brief
 * pipeline, persist RawNote/Signal/Brief, and link the selected results to the
 * new RawNote. Returns the new brief id.
 */
export const generateBriefFromResults = createServerFn({ method: 'POST' })
  .validator((data: unknown) => generateFromResultsSchema.parse(data))
  .handler(async ({ data }) => {
    const results = await prisma.sourceResult.findMany({
      where: { id: { in: data.resultIds } },
      orderBy: { createdAt: 'asc' },
    })
    if (results.length === 0) {
      throw new Error('No matching source results were found.')
    }

    const sourceTypes = Array.from(new Set(results.map((r) => r.sourceType)))
    const metadata: BriefMetadata = {
      source: sourceTypes.join(', '),
      company: null,
      persona: null,
      workload: null,
    }

    const rawText = combineResults(results)

    // Throws FieldBriefError on failure — nothing is saved.
    const { brief, signals } = await generateFieldBrief(rawText, metadata)

    const created = await prisma.$transaction(async (tx) => {
      const rawNote = await tx.rawNote.create({
        data: {
          noteDate: new Date(data.noteDate),
          rawText,
          source: metadata.source,
        },
      })

      const savedBrief = await persistBriefBundle(
        tx,
        rawNote.id,
        metadata,
        brief,
        signals,
      )

      await tx.sourceResult.updateMany({
        where: { id: { in: results.map((r) => r.id) } },
        data: { rawNoteId: rawNote.id },
      })

      return savedBrief
    })

    return { id: created.id }
  })
