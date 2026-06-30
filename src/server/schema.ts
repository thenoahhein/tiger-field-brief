import { z } from 'zod'

/** Metadata the user can attach to a raw note before generating a brief. */
export const metadataSchema = z.object({
  source: z.string().trim().nullish(),
  company: z.string().trim().nullish(),
  persona: z.string().trim().nullish(),
  workload: z.string().trim().nullish(),
})
export type BriefMetadata = z.infer<typeof metadataSchema>

/** Input accepted by the "Generate Brief" server function. */
export const generateInputSchema = z.object({
  rawText: z.string().trim().min(1, 'Raw notes are required.'),
  noteDate: z.string().min(1, 'A date is required.'),
  source: z.string().trim().nullish(),
  company: z.string().trim().nullish(),
  persona: z.string().trim().nullish(),
  workload: z.string().trim().nullish(),
})
export type GenerateInput = z.infer<typeof generateInputSchema>

const nullableString = z.string().nullish().transform((v) => v ?? null)
const textOrEmpty = z
  .string()
  .nullish()
  .transform((v) => v ?? '')

export const competitorSchema = z.object({
  name: z.string(),
  whyMentioned: textOrEmpty,
  implication: textOrEmpty,
})
export type Competitor = z.infer<typeof competitorSchema>

/** Shape the LLM must return for the `brief` object. */
export const llmBriefSchema = z.object({
  title: textOrEmpty,
  strongestMarketSignal: textOrEmpty,
  topSignals: z.array(z.string()).default([]),
  repeatedPains: z.array(z.string()).default([]),
  customerLanguage: z.array(z.string()).default([]),
  competitors: z.array(competitorSchema).default([]),
  productConfusion: z.array(z.string()).default([]),
  docsGaps: z.array(z.string()).default([]),
  salesEnablement: z.array(z.string()).default([]),
  productFeedback: z.array(z.string()).default([]),
  recommendedAction: textOrEmpty,
  pmmTakeaway: textOrEmpty,
  fullMarkdown: textOrEmpty,
})
export type LlmBrief = z.infer<typeof llmBriefSchema>

/** Shape the LLM must return for each extracted signal. */
export const llmSignalSchema = z.object({
  source: nullableString,
  company: nullableString,
  persona: nullableString,
  workload: nullableString,
  currentSystem: nullableString,
  painCategory: nullableString,
  pain: nullableString,
  competitor: nullableString,
  exactCustomerLanguage: nullableString,
  productConfusion: nullableString,
  docsGap: nullableString,
  salesEnablementNeed: nullableString,
  productFeedback: nullableString,
  businessImplication: nullableString,
  suggestedAction: nullableString,
  confidence: z
    .number()
    .nullish()
    .transform((v) => (v == null ? null : Math.round(v))),
  sourceQuality: z
    .enum(['high', 'medium', 'low'])
    .nullish()
    .transform((v) => v ?? null),
  signalType: z
    .enum([
      'customer',
      'prospect',
      'internal',
      'public_market',
      'competitor',
      'unknown',
    ])
    .nullish()
    .transform((v) => v ?? null),
})
export type LlmSignal = z.infer<typeof llmSignalSchema>

/** Full strict shape the LLM response is validated against. */
export const llmResponseSchema = z.object({
  brief: llmBriefSchema,
  signals: z.array(llmSignalSchema).default([]),
})
export type LlmResponse = z.infer<typeof llmResponseSchema>

/** Source types that can be searched (manual paste is excluded). */
export const searchableSourceSchema = z.enum(['web', 'x', 'slack'])

/** Input accepted by the "Search Sources" server function. */
export const sourceSearchSchema = z.object({
  // "all" fans out to every configured connector.
  source: z.union([searchableSourceSchema, z.literal('all')]),
  query: z.string().trim().min(1, 'A query is required.'),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  since: z.string().trim().optional(),
  until: z.string().trim().optional(),
})
export type SourceSearchRequest = z.infer<typeof sourceSearchSchema>

/** Input for generating a brief from selected source results. */
export const generateFromResultsSchema = z.object({
  resultIds: z.array(z.string().min(1)).min(1, 'Select at least one result.'),
  noteDate: z.string().min(1, 'A date is required.'),
})
export type GenerateFromResultsInput = z.infer<
  typeof generateFromResultsSchema
>
