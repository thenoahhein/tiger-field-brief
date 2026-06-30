import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { generateFieldBrief } from './llm'
import {
  generateInputSchema,
  type BriefMetadata,
  type LlmBrief,
  type LlmSignal,
} from './schema'

/**
 * Persist a generated brief + its signals against an already-created RawNote,
 * inside an existing transaction. Shared by the manual flow (generateBrief) and
 * the source-search flow (generateBriefFromResults in ./sources).
 */
export async function persistBriefBundle(
  tx: Prisma.TransactionClient,
  rawNoteId: string,
  metadata: BriefMetadata,
  brief: LlmBrief,
  signals: LlmSignal[],
) {
  const savedBrief = await tx.brief.create({
    data: {
      rawNoteId,
      title: brief.title,
      strongestMarketSignal: brief.strongestMarketSignal,
      topSignalsJson: brief.topSignals,
      repeatedPainsJson: brief.repeatedPains,
      customerLanguageJson: brief.customerLanguage,
      competitorsJson: brief.competitors,
      productConfusionJson: brief.productConfusion,
      docsGapsJson: brief.docsGaps,
      salesEnablementJson: brief.salesEnablement,
      productFeedbackJson: brief.productFeedback,
      recommendedAction: brief.recommendedAction,
      pmmTakeaway: brief.pmmTakeaway,
      fullMarkdown: brief.fullMarkdown,
    },
  })

  if (signals.length > 0) {
    await tx.signal.createMany({
      data: signals.map((s) => ({
        rawNoteId,
        source: s.source ?? metadata.source,
        company: s.company ?? metadata.company,
        persona: s.persona ?? metadata.persona,
        workload: s.workload ?? metadata.workload,
        currentSystem: s.currentSystem,
        painCategory: s.painCategory,
        pain: s.pain,
        competitor: s.competitor,
        exactCustomerLanguage: s.exactCustomerLanguage,
        productConfusion: s.productConfusion,
        docsGap: s.docsGap,
        salesEnablementNeed: s.salesEnablementNeed,
        productFeedback: s.productFeedback,
        businessImplication: s.businessImplication,
        suggestedAction: s.suggestedAction,
        confidence: s.confidence,
        sourceQuality: s.sourceQuality,
        signalType: s.signalType,
      })),
    })
  }

  return savedBrief
}

/**
 * Generate a field brief from raw notes + metadata, persist the raw note,
 * extracted signals, and brief, then return the new brief id.
 */
export const generateBrief = createServerFn({ method: 'POST' })
  .validator((data: unknown) => generateInputSchema.parse(data))
  .handler(async ({ data }) => {
    const metadata = {
      source: data.source ?? null,
      company: data.company ?? null,
      persona: data.persona ?? null,
      workload: data.workload ?? null,
    }

    // Throws FieldBriefError (validated against Zod) — nothing is saved on failure.
    const { brief, signals } = await generateFieldBrief(data.rawText, metadata)

    const created = await prisma.$transaction(async (tx) => {
      const rawNote = await tx.rawNote.create({
        data: {
          noteDate: new Date(data.noteDate),
          rawText: data.rawText,
          source: metadata.source,
          company: metadata.company,
          persona: metadata.persona,
          workload: metadata.workload,
        },
      })

      return persistBriefBundle(tx, rawNote.id, metadata, brief, signals)
    })

    return { id: created.id }
  })

/** List saved briefs in reverse chronological order (by note date). */
export const listBriefs = createServerFn({ method: 'GET' }).handler(async () => {
  const briefs = await prisma.brief.findMany({
    include: { rawNote: true },
    orderBy: [{ rawNote: { noteDate: 'desc' } }, { createdAt: 'desc' }],
  })
  return briefs.map((b) => ({
    id: b.id,
    title: b.title,
    noteDate: b.rawNote.noteDate.toISOString(),
    company: b.rawNote.company,
    strongestMarketSignal: b.strongestMarketSignal,
    recommendedAction: b.recommendedAction,
  }))
})

/** Fetch a single brief with its raw note and extracted signals. */
export const getBrief = createServerFn({ method: 'GET' })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const brief = await prisma.brief.findUnique({
      where: { id: data.id },
      include: { rawNote: { include: { signals: true } } },
    })
    if (!brief) return null
    return {
      id: brief.id,
      title: brief.title,
      noteDate: brief.rawNote.noteDate.toISOString(),
      createdAt: brief.createdAt.toISOString(),
      strongestMarketSignal: brief.strongestMarketSignal,
      recommendedAction: brief.recommendedAction,
      pmmTakeaway: brief.pmmTakeaway,
      topSignals: brief.topSignalsJson as string[],
      repeatedPains: brief.repeatedPainsJson as string[],
      customerLanguage: brief.customerLanguageJson as string[],
      competitors: brief.competitorsJson as Array<{
        name: string
        whyMentioned: string
        implication: string
      }>,
      productConfusion: brief.productConfusionJson as string[],
      docsGaps: brief.docsGapsJson as string[],
      salesEnablement: brief.salesEnablementJson as string[],
      productFeedback: brief.productFeedbackJson as string[],
      fullMarkdown: brief.fullMarkdown,
      rawNote: {
        rawText: brief.rawNote.rawText,
        source: brief.rawNote.source,
        company: brief.rawNote.company,
        persona: brief.rawNote.persona,
        workload: brief.rawNote.workload,
      },
      signals: brief.rawNote.signals,
    }
  })

const signalFilterSchema = z.object({
  competitor: z.string().trim().optional(),
  workload: z.string().trim().optional(),
  painCategory: z.string().trim().optional(),
  source: z.string().trim().optional(),
  q: z.string().trim().optional(),
})

/** List extracted signals with optional filters + free-text search. */
export const listSignals = createServerFn({ method: 'GET' })
  .validator((data: unknown) => signalFilterSchema.parse(data ?? {}))
  .handler(async ({ data }) => {
    const insensitive = 'insensitive' as const
    const and: Array<Record<string, unknown>> = []
    if (data.competitor)
      and.push({ competitor: { contains: data.competitor, mode: insensitive } })
    if (data.workload)
      and.push({ workload: { contains: data.workload, mode: insensitive } })
    if (data.painCategory)
      and.push({
        painCategory: { contains: data.painCategory, mode: insensitive },
      })
    if (data.source)
      and.push({ source: { contains: data.source, mode: insensitive } })
    if (data.q)
      and.push({
        OR: [
          { exactCustomerLanguage: { contains: data.q, mode: insensitive } },
          { pain: { contains: data.q, mode: insensitive } },
          { suggestedAction: { contains: data.q, mode: insensitive } },
        ],
      })

    const signals = await prisma.signal.findMany({
      where: and.length > 0 ? { AND: and } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        rawNote: { select: { id: true, brief: { select: { id: true } } } },
      },
    })
    return signals
  })
