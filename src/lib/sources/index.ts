import { slackConnector } from './slack'
import type { SourceConnector, SourceStatus, SourceType } from './types'
import { webConnector } from './web'
import { xConnector } from './x'

export * from './types'
export {
  MAX_COMBINED_BRIEF_CHARS,
  MAX_RESULT_TEXT_CHARS,
  truncate,
} from './util'

/** All external (searchable) connectors, keyed by source type. */
export const connectors: Record<
  Exclude<SourceType, 'manual'>,
  SourceConnector
> = {
  web: webConnector,
  x: xConnector,
  slack: slackConnector,
}

/** Source types that can be searched (everything except manual paste). */
export const SEARCHABLE_SOURCES: Array<Exclude<SourceType, 'manual'>> = [
  'web',
  'x',
  'slack',
]

export function getConnector(
  type: Exclude<SourceType, 'manual'>,
): SourceConnector {
  return connectors[type]
}

/** Status of every source for the /sources page (manual is always available). */
export function listSourceStatuses(): SourceStatus[] {
  const manual: SourceStatus = {
    type: 'manual',
    name: 'Manual Paste',
    configured: true,
    requiredEnv: [],
    configHint: 'Always available — paste notes at /new.',
  }
  const external = SEARCHABLE_SOURCES.map((type) => {
    const c = connectors[type]
    return {
      type: c.type,
      name: c.name,
      configured: c.isConfigured(),
      requiredEnv: c.requiredEnv,
      configHint: c.configHint,
    }
  })
  return [manual, ...external]
}
