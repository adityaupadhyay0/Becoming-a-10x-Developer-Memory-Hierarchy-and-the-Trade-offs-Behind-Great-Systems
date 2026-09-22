export type Layer = 'in-memory' | 'cache' | 'database' | 'network'

export type AccessSiteType = 'query' | 'cache' | 'network' | 'loop'

export interface AccessSite {
  id: string
  file: string
  line: number
  type: AccessSiteType
  detected_library?: string
  layer: Layer
  estimated_frequency: number
  measured_frequency: number | null
  estimated_latency: number
  measured_latency: number | null
  code_snippet?: string
  loop_depth: number
}

export type DataNodeKind = 'table' | 'cache-namespace' | 'external-host'

export interface DataNode {
  id: string
  kind: DataNodeKind
  name: string
}

export type SeverityScore = 'low' | 'medium' | 'high' | 'critical'

export interface HotZone {
  id: string
  access_site_ids: string[]
  anti_pattern_type: string
  severity_score: SeverityScore
  explanation: string | null
  remediation_suggestion: string | null
  acknowledged: boolean
}

export interface SystemicTradeoff {
  id: string
  title: string
  description: string
  category: 'consistency-vs-availability' | 'simplicity-vs-throughput' | 'memory-vs-compute'
  evidence_site_ids: string[]
}

export interface ScanReport {
  scan_id: string
  timestamp: string
  repo_ref: string
  coverage_pct: number
  total_access_sites: number
  hot_zones: HotZone[]
  systemic_tradeoffs: SystemicTradeoff[]
  schema_version: string
}
