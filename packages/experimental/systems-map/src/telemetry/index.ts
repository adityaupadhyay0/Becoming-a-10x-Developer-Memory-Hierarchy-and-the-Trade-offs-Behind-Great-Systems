import { AccessSite } from '../models/index.js'
import { Context } from '@deepseek-ai/cordis'

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

  constructor(private ctx?: Context) {
    if (this.ctx) {
      this.initLiveIngestion()
    }
  }

  private initLiveIngestion(): void {
    // In a full implementation, we'd hook into ctx.server.post('/v1/traces')
    // For this 10x upgrade, we export a method that external tools or test harnesses can call
    // to mock active OTLP span pushes during runtime.
  }

  public ingestLiveSpan(span: TelemetrySpan): void {
    this.spans.push(span)
  }

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
