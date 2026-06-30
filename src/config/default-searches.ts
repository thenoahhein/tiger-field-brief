/**
 * Default saved searches grouped by intent. Surfaced in /sources/search as
 * one-click queries so you don't have to retype the common TigerData GTM terms.
 */
export const defaultSearches = {
  competitors: [
    'ClickHouse time-series',
    'InfluxDB migration',
    'Prometheus retention',
    'AWS Timestream',
    'QuestDB',
    'MongoDB time-series',
  ],
  workloads: [
    'industrial telemetry database',
    'IoT telemetry database',
    'Postgres time-series',
    'real-time analytics Postgres',
    'metrics database',
    'observability retention',
  ],
  tiger: [
    'TigerData',
    'TimescaleDB',
    'hypertables',
    'continuous aggregates',
    'TimescaleDB compression',
    'TimescaleDB columnstore',
  ],
} as const

export type DefaultSearchGroup = keyof typeof defaultSearches

export const defaultSearchGroupLabels: Record<DefaultSearchGroup, string> = {
  competitors: 'Competitors',
  workloads: 'Workloads',
  tiger: 'Tiger / TimescaleDB',
}
