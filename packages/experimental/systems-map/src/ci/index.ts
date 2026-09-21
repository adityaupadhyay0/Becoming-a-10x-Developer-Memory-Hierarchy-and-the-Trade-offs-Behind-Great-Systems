import { ScanReport, HotZone } from '../models/index.js'

export class ReportDiffer {
  public diff(baseReport: ScanReport, headReport: ScanReport): HotZone[] {
    const baseHotZoneIds = new Set(baseReport.hot_zones.map(hz => hz.id))
    const newHotZones = headReport.hot_zones.filter(hz => !baseHotZoneIds.has(hz.id))
    return newHotZones
  }
}

export function formatPRComment(newHotZones: HotZone[]): string | null {
  if (newHotZones.length === 0) return null

  let comment = '### 🗺️ Systems Map: New Hot Zones Detected\n\n'
  comment += `We found **${newHotZones.length}** new structural trade-off(s) or anti-pattern(s) introduced in this pull request.\n\n`
  comment += '| Severity | Type | Description | Remediation |\n'
  comment += '|----------|------|-------------|-------------|\n'

  for (const hz of newHotZones) {
    const icon = hz.severity_score === 'critical' ? '🔴' : hz.severity_score === 'high' ? '🟠' : '🟡'
    comment += `| ${icon} ${hz.severity_score} | **${hz.anti_pattern_type}** | ${hz.explanation?.replace(/\\n/g, ' ')} | ${hz.remediation_suggestion || 'N/A'} |\n`
  }

  comment += '\n*Please review these structural tradeoffs. Ensure they are either acknowledged as constraints or fixed before merging.*'

  return comment
}
