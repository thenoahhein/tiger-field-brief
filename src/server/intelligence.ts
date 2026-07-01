import { createServerFn } from '@tanstack/react-start'
import type { Prisma, Watchlist } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './db'
import { persistBriefBundle } from './briefs'
import { generateFieldBrief, generateIntelligenceReport } from './llm'
import {
  createWatchlistSchema,
  deleteWatchlistSchema,
  generateReportSchema,
  runWatchlistsSchema,
  updateActionStatusSchema,
  updateWatchlistSchema,
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

const DEFAULT_WATCHLISTS: Array<
  Pick<
    Watchlist,
    | 'name'
    | 'category'
    | 'sourceType'
    | 'query'
    | 'cadence'
    | 'enabled'
    | 'limit'
    | 'lookbackDays'
  >
> = [
  {
    name: 'ClickHouse and InfluxDB pressure',
    category: 'competitive',
    sourceType: 'all',
    query:
      '("TimescaleDB" OR "TigerData" OR "Postgres time-series") (ClickHouse OR InfluxDB OR Prometheus)',
    cadence: 'daily',
    enabled: true,
    limit: 8,
    lookbackDays: 2,
  },
  {
    name: 'Migration and retention pain',
    category: 'migration_pain',
    sourceType: 'all',
    query:
      '("outgrew InfluxDB" OR "Prometheus retention" OR "time-series retention" OR "Postgres time-series")',
    cadence: 'daily',
    enabled: true,
    limit: 8,
    lookbackDays: 2,
  },
  {
    name: 'Product confusion',
    category: 'product_confusion',
    sourceType: 'all',
    query:
      '("TimescaleDB" OR "TigerData") ("just Postgres" OR hypertables OR "continuous aggregates" OR columnstore)',
    cadence: 'weekly',
    enabled: true,
    limit: 10,
    lookbackDays: 7,
  },
  {
    name: 'Market narrative',
    category: 'market_narrative',
    sourceType: 'web',
    query:
      '("real-time analytics" OR "time-series data" OR observability) PostgreSQL database',
    cadence: 'weekly',
    enabled: true,
    limit: 10,
    lookbackDays: 7,
  },
]

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function nextRunFrom(cadence: string, from = new Date()): Date {
  return addDays(from, cadence === 'weekly' ? 7 : 1)
}

function lookbackStart(days: number): Date {
  return addDays(new Date(), -Math.max(1, days))
}

async function ensureDefaultWatchlists() {
  const count = await prisma.watchlist.count()
  if (count > 0) return
  const now = new Date()
  await prisma.watchlist.createMany({
    data: DEFAULT_WATCHLISTS.map((w) => ({
      ...w,
      nextRunAt: now,
    })),
  })
}

function requestedSources(sourceType: string): Array<Exclude<SourceType, 'manual'>> {
  if (sourceType === 'all') return [...SEARCHABLE_SOURCES]
  if (sourceType === 'web' || sourceType === 'x' || sourceType === 'slack') {
    return [sourceType]
  }
  return []
}

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
  return truncate(blocks.join('\n\n'), MAX_COMBINED_BRIEF_CHARS)
}

async function runSingleWatchlist(watchlist: Watchlist) {
  const since = lookbackStart(watchlist.lookbackDays)
  const until = new Date()
  const results: SourceSearchResult[] = []
  const errors: string[] = []

  for (const type of requestedSources(watchlist.sourceType)) {
    const connector = getConnector(type)
    if (!connector.isConfigured()) continue
    try {
      const found = await connector.search({
        query: watchlist.query,
        limit: watchlist.limit,
        since: since.toISOString(),
        until: until.toISOString(),
      })
      results.push(...found)
    } catch (err) {
      errors.push(
        `${type}: ${err instanceof Error ? err.message : 'Search failed.'}`,
      )
    }
  }

  const run = await prisma.sourceSearchRun.create({
    data: {
      watchlistId: watchlist.id,
      sourceType: watchlist.sourceType,
      query: watchlist.query,
      since,
      until,
      limit: watchlist.limit,
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

  let briefId: string | null = null
  if (run.results.length > 0) {
    const rawText = combineResults(run.results)
    const metadata: BriefMetadata = {
      source: `watchlist: ${watchlist.name}`,
      company: null,
      persona: null,
      workload: watchlist.category,
    }
    const { brief, signals } = await generateFieldBrief(rawText, metadata)
    const saved = await prisma.$transaction(async (tx) => {
      const rawNote = await tx.rawNote.create({
        data: {
          noteDate: new Date(),
          rawText,
          source: metadata.source,
          workload: metadata.workload,
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
        where: { id: { in: run.results.map((r) => r.id) } },
        data: { rawNoteId: rawNote.id },
      })
      return savedBrief
    })
    briefId = saved.id
  }

  await prisma.watchlist.update({
    where: { id: watchlist.id },
    data: {
      lastRunAt: new Date(),
      nextRunAt: nextRunFrom(watchlist.cadence),
      lastError: errors.length > 0 ? errors.join('\n') : null,
    },
  })

  return {
    watchlistId: watchlist.id,
    name: watchlist.name,
    runId: run.id,
    briefId,
    resultCount: run.results.length,
    errors,
  }
}

function resultPreview(result: {
  sourceType: string
  sourceName: string | null
  title: string | null
  url: string | null
  author: string | null
  text: string
}): string {
  return [
    `source=${result.sourceType}${result.sourceName ? `/${result.sourceName}` : ''}`,
    result.author ? `author=${result.author}` : null,
    result.title ? `title=${result.title}` : null,
    result.url ? `url=${result.url}` : null,
    `text=${truncate(result.text, 600)}`,
  ]
    .filter(Boolean)
    .join(' | ')
}

async function buildReportEvidence(periodStart: Date, periodEnd: Date) {
  const [runs, signals, briefs] = await Promise.all([
    prisma.sourceSearchRun.findMany({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        watchlist: true,
        results: { orderBy: { createdAt: 'asc' }, take: 8 },
      },
    }),
    prisma.signal.findMany({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    prisma.brief.findMany({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { rawNote: { select: { source: true, workload: true } } },
    }),
  ])

  const runBlocks = runs.map((run) => {
    const heading = [
      `RUN ${run.id}`,
      `watchlist=${run.watchlist?.name ?? 'manual search'}`,
      `category=${run.watchlist?.category ?? 'n/a'}`,
      `source=${run.sourceType}`,
      `query=${run.query}`,
      `results=${run.results.length}`,
    ].join(' | ')
    const body = run.results.map(resultPreview).join('\n')
    return `${heading}\n${body}`
  })

  const signalBlocks = signals.map((s) =>
    [
      `SIGNAL ${s.id}`,
      s.signalType ? `type=${s.signalType}` : null,
      s.sourceQuality ? `quality=${s.sourceQuality}` : null,
      s.competitor ? `competitor=${s.competitor}` : null,
      s.workload ? `workload=${s.workload}` : null,
      s.pain ? `pain=${s.pain}` : null,
      s.productConfusion ? `confusion=${s.productConfusion}` : null,
      s.docsGap ? `docsGap=${s.docsGap}` : null,
      s.suggestedAction ? `action=${s.suggestedAction}` : null,
      s.exactCustomerLanguage ? `language=${s.exactCustomerLanguage}` : null,
    ]
      .filter(Boolean)
      .join(' | '),
  )

  const briefBlocks = briefs.map((b) =>
    [
      `BRIEF ${b.id}`,
      `source=${b.rawNote.source ?? 'unknown'}`,
      b.rawNote.workload ? `workload=${b.rawNote.workload}` : null,
      b.strongestMarketSignal
        ? `strongestSignal=${b.strongestMarketSignal}`
        : null,
      b.recommendedAction ? `recommendedAction=${b.recommendedAction}` : null,
      b.pmmTakeaway ? `pmmTakeaway=${b.pmmTakeaway}` : null,
    ]
      .filter(Boolean)
      .join(' | '),
  )

  const evidence = truncate(
    [
      '# Source runs',
      runBlocks.join('\n\n') || 'No source runs.',
      '# Extracted signals',
      signalBlocks.join('\n') || 'No extracted signals.',
      '# Generated briefs',
      briefBlocks.join('\n') || 'No generated briefs.',
    ].join('\n\n'),
    MAX_COMBINED_BRIEF_CHARS,
  )

  return { evidence, runIds: runs.map((r) => r.id) }
}

export const getIntelligenceDashboard = createServerFn({ method: 'GET' }).handler(
  async () => {
    await ensureDefaultWatchlists()
    const now = new Date()
    const [watchlists, reports, actions, statuses, recentRuns] =
      await Promise.all([
        prisma.watchlist.findMany({
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          include: {
            runs: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { results: { select: { id: true } } },
            },
          },
        }),
        prisma.intelligenceReport.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
        prisma.actionItem.findMany({
          where: { status: { in: ['new', 'accepted'] } },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            report: { select: { id: true, title: true } },
            brief: { select: { id: true, title: true } },
          },
        }),
        listSourceStatuses(),
        prisma.sourceSearchRun.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            watchlist: { select: { name: true } },
            results: { select: { id: true } },
          },
        }),
      ])

    return {
      sourceStatuses: statuses,
      watchlists: watchlists.map((w) => ({
        id: w.id,
        name: w.name,
        category: w.category,
        sourceType: w.sourceType,
        query: w.query,
        cadence: w.cadence,
        enabled: w.enabled,
        limit: w.limit,
        lookbackDays: w.lookbackDays,
        lastRunAt: iso(w.lastRunAt),
        nextRunAt: iso(w.nextRunAt),
        due: w.enabled && (!w.nextRunAt || w.nextRunAt <= now),
        lastError: w.lastError,
        lastResultCount: w.runs[0]?.results.length ?? null,
      })),
      reports: reports.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        reportType: r.reportType,
        title: r.title,
        summary: r.summary,
        periodStart: r.periodStart.toISOString(),
        periodEnd: r.periodEnd.toISOString(),
      })),
      actions: actions.map((a) => ({
        id: a.id,
        title: a.title,
        recommendation: a.recommendation,
        rationale: a.rationale,
        owner: a.owner,
        useFor: a.useFor,
        status: a.status,
        origin: a.origin,
        createdAt: a.createdAt.toISOString(),
        reportId: a.reportId,
        reportTitle: a.report?.title ?? null,
        briefId: a.briefId,
        briefTitle: a.brief?.title ?? null,
      })),
      recentRuns: recentRuns.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        watchlistName: r.watchlist?.name ?? null,
        sourceType: r.sourceType,
        query: r.query,
        resultCount: r.results.length,
      })),
    }
  },
)

export const runWatchlists = createServerFn({ method: 'POST' })
  .validator((data: unknown) => runWatchlistsSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    await ensureDefaultWatchlists()
    const now = new Date()
    const watchlists = await prisma.watchlist.findMany({
      where:
        data.mode === 'all'
          ? { enabled: true }
          : {
              enabled: true,
              OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
            },
      orderBy: [{ nextRunAt: 'asc' }, { name: 'asc' }],
    })

    const runs = []
    for (const watchlist of watchlists) {
      try {
        runs.push(await runSingleWatchlist(watchlist))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Watchlist run failed.'
        await prisma.watchlist.update({
          where: { id: watchlist.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt: nextRunFrom(watchlist.cadence),
            lastError: message,
          },
        })
        runs.push({
          watchlistId: watchlist.id,
          name: watchlist.name,
          runId: null,
          briefId: null,
          resultCount: 0,
          errors: [message],
        })
      }
    }

    return { count: runs.length, runs }
  })

export const generateWeeklyReport = createServerFn({ method: 'POST' })
  .validator((data: unknown) => generateReportSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const periodEnd = new Date()
    const periodStart = addDays(periodEnd, -data.days)
    const { evidence, runIds } = await buildReportEvidence(periodStart, periodEnd)
    const report = await generateIntelligenceReport({
      reportType: data.reportType,
      period: `${periodStart.toISOString()} to ${periodEnd.toISOString()}`,
      evidence,
    })

    const saved = await prisma.intelligenceReport.create({
      data: {
        reportType: data.reportType,
        periodStart,
        periodEnd,
        title: report.title,
        summary: report.summary,
        learnedJson: report.learned,
        repeatedPainsJson: report.repeatedPains,
        competitorsJson: report.competitors,
        productConfusionJson: report.productConfusion,
        recommendedActionsJson: report.recommendedActions,
        salesNotesJson: report.salesNotes,
        productNotesJson: report.productNotes,
        sourceRunIdsJson: runIds as Prisma.InputJsonValue,
        fullMarkdown: report.fullMarkdown,
        actionItems: {
          create: report.recommendedActions.map((action) => ({
            title: action.title || action.recommendation,
            recommendation: action.recommendation,
            rationale: action.rationale,
            owner: action.owner,
            useFor: action.useFor,
            evidenceJson: action.evidence as Prisma.InputJsonValue,
          })),
        },
      },
    })

    return { id: saved.id }
  })

export const getIntelligenceReport = createServerFn({ method: 'GET' })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const report = await prisma.intelligenceReport.findUnique({
      where: { id: data.id },
      include: { actionItems: { orderBy: { createdAt: 'asc' } } },
    })
    if (!report) return null
    return {
      id: report.id,
      createdAt: report.createdAt.toISOString(),
      reportType: report.reportType,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      title: report.title,
      summary: report.summary,
      learned: report.learnedJson as string[],
      repeatedPains: report.repeatedPainsJson as string[],
      competitors: report.competitorsJson as Array<{
        name: string
        whyItMatters: string
        evidence: string[]
      }>,
      productConfusion: report.productConfusionJson as string[],
      recommendedActions: report.recommendedActionsJson as Array<{
        title: string
        recommendation: string
        rationale: string | null
        owner: string | null
        useFor: string | null
        evidence: string[]
      }>,
      salesNotes: report.salesNotesJson as string[],
      productNotes: report.productNotesJson as string[],
      fullMarkdown: report.fullMarkdown,
      actionItems: report.actionItems.map((a) => ({
        id: a.id,
        title: a.title,
        recommendation: a.recommendation,
        rationale: a.rationale,
        owner: a.owner,
        useFor: a.useFor,
        status: a.status,
        evidence: (a.evidenceJson as string[] | null) ?? [],
      })),
    }
  })

export const updateActionStatus = createServerFn({ method: 'POST' })
  .validator((data: unknown) => updateActionStatusSchema.parse(data))
  .handler(async ({ data }) => {
    await prisma.actionItem.update({
      where: { id: data.id },
      data: { status: data.status },
    })
    return { ok: true }
  })

export const createWatchlist = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createWatchlistSchema.parse(data))
  .handler(async ({ data }) => {
    const now = new Date()
    const watchlist = await prisma.watchlist.create({
      data: {
        ...data,
        nextRunAt: now,
      },
    })
    return { id: watchlist.id }
  })

export const updateWatchlist = createServerFn({ method: 'POST' })
  .validator((data: unknown) => updateWatchlistSchema.parse(data))
  .handler(async ({ data }) => {
    const { id, ...fields } = data
    await prisma.watchlist.update({
      where: { id },
      data: fields,
    })
    return { ok: true }
  })

export const deleteWatchlist = createServerFn({ method: 'POST' })
  .validator((data: unknown) => deleteWatchlistSchema.parse(data))
  .handler(async ({ data }) => {
    await prisma.watchlist.delete({ where: { id: data.id } })
    return { ok: true }
  })

export const toggleWatchlist = createServerFn({ method: 'POST' })
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const w = await prisma.watchlist.findUniqueOrThrow({
      where: { id: data.id },
      select: { enabled: true },
    })
    await prisma.watchlist.update({
      where: { id: data.id },
      data: {
        enabled: !w.enabled,
        nextRunAt: !w.enabled ? new Date() : undefined,
      },
    })
    return { ok: true, enabled: !w.enabled }
  })

let schedulerTimer: ReturnType<typeof setInterval> | null = null

export function startScheduler(intervalMs = 60_000) {
  if (schedulerTimer) return
  schedulerTimer = setInterval(async () => {
    try {
      const now = new Date()
      const due = await prisma.watchlist.findMany({
        where: {
          enabled: true,
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
        },
      })
      for (const watchlist of due) {
        try {
          await runSingleWatchlist(watchlist)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Scheduled run failed.'
          await prisma.watchlist.update({
            where: { id: watchlist.id },
            data: {
              lastRunAt: new Date(),
              nextRunAt: nextRunFrom(watchlist.cadence),
              lastError: message,
            },
          })
        }
      }
    } catch {
      // swallow top-level errors so the interval keeps ticking
    }
  }, intervalMs)
}

export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

const SCHEDULER_INTERVAL_MS = Number(
  process.env.SCHEDULER_INTERVAL_MS || '60000',
)
if (SCHEDULER_INTERVAL_MS > 0) {
  startScheduler(SCHEDULER_INTERVAL_MS)
}
