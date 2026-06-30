/** Small, dependency-free helpers shared by the source connectors. */

/** Per-result text cap (characters) kept in the DB and sent downstream. */
export const MAX_RESULT_TEXT_CHARS = 2000
/** Total combined raw-note cap (characters) sent to the LLM. */
export const MAX_COMBINED_BRIEF_CHARS = 24000

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Read a string field from an unknown record, trying several keys. */
export function pickString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim().length > 0) return v
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  }
  return undefined
}

/** Truncate text to a max length, appending an ellipsis marker when cut. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`
}

/** Clamp a requested result limit to a sane range. */
export function clampLimit(limit: number | undefined, fallback = 10): number {
  if (typeof limit !== 'number' || Number.isNaN(limit)) return fallback
  return Math.max(1, Math.min(50, Math.floor(limit)))
}
