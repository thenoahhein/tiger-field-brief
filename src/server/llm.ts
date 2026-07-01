import Anthropic from '@anthropic-ai/sdk'
import {
  intelligenceReportSchema,
  llmResponseSchema,
  type BriefMetadata,
  type IntelligenceReportResponse,
  type LlmResponse,
} from './schema'

/** Error thrown when the LLM call or validation fails. Carries a user-safe message. */
export class FieldBriefError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FieldBriefError'
  }
}

const PROMPT_TEMPLATE = `You are helping produce a daily GTM intelligence brief for TigerData's time-series business.

TigerData sells a Postgres-based time-series, analytics, and real-time data platform. We care about customer pains, sales objections, competitive pressure, product confusion, docs gaps, sales enablement opportunities, product feedback, and useful market narrative.

Analyze the raw notes below. Ground every recommendation in the notes. Do not invent details. If evidence is weak, say so.

Some notes may come from web search, X posts, or Slack messages. Treat these as raw market signals, not verified facts. Distinguish between:
- customer/prospect signal
- internal team signal
- public market chatter
- competitor narrative
- weak/noisy evidence

Do not overstate weak evidence. When source quality is low, say so.

Return strict JSON with this shape:

{
  "brief": {
    "title": "string",
    "strongestMarketSignal": "string",
    "topSignals": ["string"],
    "repeatedPains": ["string"],
    "customerLanguage": ["string"],
    "competitors": [
      {
        "name": "string",
        "whyMentioned": "string",
        "implication": "string"
      }
    ],
    "productConfusion": ["string"],
    "docsGaps": ["string"],
    "salesEnablement": ["string"],
    "productFeedback": ["string"],
    "recommendedAction": "string",
    "pmmTakeaway": "string",
    "fullMarkdown": "string"
  },
  "signals": [
    {
      "source": "string or null",
      "company": "string or null",
      "persona": "string or null",
      "workload": "string or null",
      "currentSystem": "string or null",
      "painCategory": "string or null",
      "pain": "string or null",
      "competitor": "string or null",
      "exactCustomerLanguage": "string or null",
      "productConfusion": "string or null",
      "docsGap": "string or null",
      "salesEnablementNeed": "string or null",
      "productFeedback": "string or null",
      "businessImplication": "string or null",
      "suggestedAction": "string or null",
      "confidence": 1,
      "sourceQuality": "high | medium | low",
      "signalType": "customer | prospect | internal | public_market | competitor | unknown"
    }
  ]
}

Raw notes:
{{RAW_NOTES}}

Metadata:
{{METADATA}}`

const REPORT_PROMPT_TEMPLATE = `You are helping produce a weekly GTM intelligence synthesis for TigerData's time-series business.

TigerData sells a Postgres-based time-series, analytics, and real-time data platform. We care about customer pains, sales objections, competitive pressure, product confusion, docs gaps, sales enablement opportunities, product feedback, and useful market narrative.

The input below is a bundle of source-search runs, extracted signals, and generated daily/source briefs. Treat public web and X data as directional market signal, not verified customer truth. Prefer repeated patterns and high-quality/internal/customer evidence when available. Do not invent details.

Your job is not to summarize everything. Your job is to say what TigerData should do with the signal.

Return strict JSON with this shape:

{
  "title": "string",
  "summary": "string",
  "learned": ["string"],
  "repeatedPains": ["string"],
  "competitors": [
    {
      "name": "string",
      "whyItMatters": "string",
      "evidence": ["string"]
    }
  ],
  "productConfusion": ["string"],
  "recommendedActions": [
    {
      "title": "string",
      "recommendation": "string",
      "rationale": "string or null",
      "owner": "PMM | Sales | Docs | Product | DevRel | Unknown",
      "useFor": "sales_enablement | positioning | docs | product_feedback | devrel | research",
      "evidence": ["string"]
    }
  ],
  "salesNotes": ["string"],
  "productNotes": ["string"],
  "fullMarkdown": "string"
}

Report type:
{{REPORT_TYPE}}

Period:
{{PERIOD}}

Evidence bundle:
{{EVIDENCE}}`

function buildPrompt(rawNote: string, metadata: BriefMetadata): string {
  return PROMPT_TEMPLATE.replace('{{RAW_NOTES}}', rawNote).replace(
    '{{METADATA}}',
    JSON.stringify(metadata, null, 2),
  )
}

function buildReportPrompt(input: {
  reportType: string
  period: string
  evidence: string
}): string {
  return REPORT_PROMPT_TEMPLATE.replace('{{REPORT_TYPE}}', input.reportType)
    .replace('{{PERIOD}}', input.period)
    .replace('{{EVIDENCE}}', input.evidence)
}

/** Pull a JSON object out of an LLM response, tolerating ```json fences / stray prose. */
function extractJson(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1] : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new FieldBriefError('The LLM did not return a JSON object.')
  }
  const slice = candidate.slice(start, end + 1)
  try {
    return JSON.parse(slice)
  } catch {
    throw new FieldBriefError('The LLM returned malformed JSON.')
  }
}

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
  if (!apiKey) {
    throw new FieldBriefError(
      'Missing ANTHROPIC_API_KEY (or CLAUDE_API_KEY). Set it in your .env.',
    )
  }
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
  const client = new Anthropic({ apiKey })
  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system:
      'You are a precise GTM analyst. Respond with ONLY a single valid JSON object and nothing else — no markdown, no commentary.',
    messages: [{ role: 'user', content: prompt }],
  })
  return res.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new FieldBriefError('Missing OPENAI_API_KEY. Set it in your .env.')
  }
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a precise GTM analyst. Respond with ONLY a single valid JSON object.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (!res.ok) {
    throw new FieldBriefError(`OpenAI API error (${res.status}).`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content ?? ''
}

/**
 * Send raw notes + metadata to the configured LLM and return a validated,
 * structured field brief. Throws FieldBriefError on any failure.
 */
export async function generateFieldBrief(
  rawNote: string,
  metadata: BriefMetadata,
): Promise<LlmResponse> {
  const prompt = buildPrompt(rawNote, metadata)
  const provider = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase()

  let rawText: string
  try {
    rawText =
      provider === 'openai'
        ? await callOpenAI(prompt)
        : await callAnthropic(prompt)
  } catch (err) {
    if (err instanceof FieldBriefError) throw err
    throw new FieldBriefError(
      `LLM request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  const parsed = extractJson(rawText)
  const result = llmResponseSchema.safeParse(parsed)
  if (!result.success) {
    console.error(
      '[generateFieldBrief] LLM output failed validation:',
      JSON.stringify(result.error.issues),
    )
    throw new FieldBriefError(
      'The LLM response did not match the expected shape. No data was saved.',
    )
  }
  return result.data
}

export async function generateIntelligenceReport(input: {
  reportType: string
  period: string
  evidence: string
}): Promise<IntelligenceReportResponse> {
  const prompt = buildReportPrompt(input)
  const provider = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase()

  let rawText: string
  try {
    rawText =
      provider === 'openai'
        ? await callOpenAI(prompt)
        : await callAnthropic(prompt)
  } catch (err) {
    if (err instanceof FieldBriefError) throw err
    throw new FieldBriefError(
      `LLM request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  const parsed = extractJson(rawText)
  const result = intelligenceReportSchema.safeParse(parsed)
  if (!result.success) {
    console.error(
      '[generateIntelligenceReport] LLM output failed validation:',
      JSON.stringify(result.error.issues),
    )
    throw new FieldBriefError(
      'The LLM response did not match the expected report shape. No report was saved.',
    )
  }
  return result.data
}
