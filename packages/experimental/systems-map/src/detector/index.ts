import { AccessSite, HotZone, SeverityScore } from '../models/index.js'

export class AntiPatternDetector {
  private hotZones: HotZone[] = []

  constructor(private accessSites: AccessSite[]) {}

  public detect(): HotZone[] {
    this.hotZones = []
    this.detectNPlusOne()
    this.detectNetworkInLoop()
    this.detectHighCostStandalone()
    return this.hotZones
  }

  private detectNPlusOne(): void {
    const loopQueries = this.accessSites.filter(
      site => site.type === 'query' && site.loop_depth > 0,
    )

    for (const site of loopQueries) {
      let severity: SeverityScore = 'high'
      if (site.loop_depth > 1) severity = 'critical' // Nested loops doing queries are worse

      this.hotZones.push({
        id: `hz-nplus1-${site.id}`,
        access_site_ids: [site.id],
        anti_pattern_type: site.loop_depth > 1 ? 'Nested N+1 Query Pattern' : 'N+1 Query Pattern',
        severity_score: severity,
        explanation: `A database query was detected inside a loop (depth: ${site.loop_depth}). This leads to the N+1 problem, generating excessive database round-trips. Estimated frequency multiplier: ${site.estimated_frequency}x.`,
        remediation_suggestion: 'Batch the query outside the loop using an IN clause, or use DataLoader/eager loading.',
        acknowledged: false,
      })
    }
  }

  private detectNetworkInLoop(): void {
    const loopNetwork = this.accessSites.filter(
      site => site.type === 'network' && site.loop_depth > 0,
    )

    for (const site of loopNetwork) {
      this.hotZones.push({
        id: `hz-netloop-${site.id}`,
        access_site_ids: [site.id],
        anti_pattern_type: 'Network Call in Loop',
        severity_score: 'critical',
        explanation: `An external network call was detected inside a loop (depth: ${site.loop_depth}). This causes severe latency due to repeated round-trips. Estimated frequency multiplier: ${site.estimated_frequency}x.`,
        remediation_suggestion: 'Batch the network requests if the API supports it, or parallelize using Promise.all().',
        acknowledged: false,
      })
    }
  }

  private detectHighCostStandalone(): void {
    const expensiveCalls = this.accessSites.filter(
      site => (site.type === 'query' || site.type === 'network') && site.loop_depth === 0,
    )

    for (const site of expensiveCalls) {
      if (site.type === 'network') {
        this.hotZones.push({
          id: `hz-costly-${site.id}`,
          access_site_ids: [site.id],
          anti_pattern_type: 'High Latency Call',
          severity_score: 'medium',
          explanation: 'A standalone network call was detected. Ensure this is cached if it represents frequently accessed, rarely changing data.',
          remediation_suggestion: 'Consider caching the response if applicable to reduce latency.',
          acknowledged: false,
        })
      }
    }
  }
}
