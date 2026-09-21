import { AccessSite } from '../models/index.js'

export interface TelemetrySpan {
  traceId: string
  spanId: string
  name: string
  kind: string
  attributes: Record<string, string | number | boolean>
  durationMs: number
}

export class TelemetryIngester {
  private spans: TelemetrySpan[] = []


  public ingestJsonFile(content: string): void {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        this.spans.push(...parsed)
      }
    } catch (e) {
      console.error('Failed to parse telemetry JSON:', e)
    }
  }

  public correlate(accessSites: AccessSite[]): void {
    for (const site of accessSites) {
      const matchingSpans = this.spans.filter((span) => {
        if (site.type === 'query' && span.attributes['db.system']) return true
        if (site.type === 'network' && span.attributes['http.method']) return true
        if (site.type === 'cache' && span.attributes['db.system'] === 'redis') return true
        return false
      })

      if (matchingSpans.length > 0) {
        const totalDuration = matchingSpans.reduce((sum, s) => sum + s.durationMs, 0)
        site.measured_latency = totalDuration / matchingSpans.length
        site.measured_frequency = matchingSpans.length
      }
    }
  }
}
