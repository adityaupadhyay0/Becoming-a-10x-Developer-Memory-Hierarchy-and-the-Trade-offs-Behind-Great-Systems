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
    comment += `| ${icon} ${hz.severity_score} | **${hz.anti_pattern_type}** | ${hz.explanation?.replace(/\n/g, ' ')} | ${hz.remediation_suggestion || 'N/A'} |\n`
  }

  comment += '\n*Please review these structural tradeoffs. Ensure they are either acknowledged as constraints or fixed before merging.*'

  return comment
}

export interface PRInlineComment {
  path: string
  line: number
  body: string
}

export function generateInlinePRReview(newHotZones: HotZone[]): PRInlineComment[] {
  const inlineComments: PRInlineComment[] = []

  for (const hz of newHotZones) {
    // We grab the first access site file/line to anchor the PR comment
    // In a real PR payload, we'd need to ensure the line is part of the diff
    const primarySiteId = hz.access_site_ids[0]
    if (!primarySiteId) continue

    // Extract file and line from ID (e.g. "src/file.ts:42-query")
    const match = primarySiteId.match(/^(.*?):(\d+)-/)
    if (match) {
      const file = match[1] || ''
      const line = parseInt(match[2] || '0', 10)

      let body = `**Systems Map Alert: ${hz.anti_pattern_type} (${hz.severity_score})**\n\n`
      body += `${hz.explanation}\n\n`
      body += `*Suggestion:* ${hz.remediation_suggestion}\n`

      if (hz.auto_fix_code) {
        body += `\n**LLM Recommended Auto-Fix:**\n\`\`\`javascript\n${hz.auto_fix_code}\n\`\`\`\n`
      }

      inlineComments.push({
        path: file,
        line,
        body,
      })
    }
  }

  return inlineComments
}
