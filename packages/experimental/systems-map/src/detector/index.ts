import { AccessSite, HotZone } from '../models/index.js'

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
      site => site.type === 'query' && site.estimated_frequency > 10,
    )

    for (const site of loopQueries) {
      this.hotZones.push({
        id: `hz-nplus1-${site.id}`,
        access_site_ids: [site.id],
        anti_pattern_type: 'N+1 Query Pattern',
        severity_score: 'high',
        explanation: 'A database query was detected inside a loop. This leads to the N+1 problem, generating excessive database round-trips.',
        remediation_suggestion: 'Batch the query outside the loop using an IN clause, or use DataLoader/eager loading.',
        acknowledged: false,
      })
    }
  }

  private detectNetworkInLoop(): void {
    const loopNetwork = this.accessSites.filter(
      site => site.type === 'network' && site.estimated_frequency > 10,
    )

    for (const site of loopNetwork) {
      this.hotZones.push({
        id: `hz-netloop-${site.id}`,
        access_site_ids: [site.id],
        anti_pattern_type: 'Network Call in Loop',
        severity_score: 'critical',
        explanation: 'An external network call was detected inside a loop. This causes severe latency due to repeated round-trips.',
        remediation_suggestion: 'Batch the network requests if the API supports it, or parallelize using Promise.all().',
        acknowledged: false,
      })
    }
  }

  private detectHighCostStandalone(): void {
    const expensiveCalls = this.accessSites.filter(
      site => (site.type === 'query' || site.type === 'network') && site.estimated_frequency <= 10,
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
