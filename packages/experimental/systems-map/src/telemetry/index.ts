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
      this.autoInstrumentNode()
    }
  }

  private initLiveIngestion(): void {
    // Expose a method that external tools or test harnesses can call
  }

  private autoInstrumentNode(): void {
    if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
      const originalFetch = globalThis.fetch

      // Native Node.js Auto-Instrumentation hook
      globalThis.fetch = async (...args: [RequestInfo | URL, RequestInit?]) => {
        const startTime = Date.now()
        let method = 'GET'
        let url = ''

        if (typeof args[0] === 'string') url = args[0]
        else if (args[0] && (args[0] as { url: string }).url) url = (args[0] as { url: string }).url

        if (args[1] && args[1].method) method = args[1].method

        try {
          const response = await originalFetch(...args)
          this.ingestLiveSpan({
            traceId: `live-${Date.now()}`,
            spanId: `span-${Date.now()}`,
            name: `fetch ${method}`,
            kind: 'CLIENT',
            attributes: { 'http.method': method, 'http.url': url },
            durationMs: Date.now() - startTime,
          })
          return response
        } catch (e) {
          this.ingestLiveSpan({
            traceId: `live-${Date.now()}`,
            spanId: `span-${Date.now()}`,
            name: `fetch ${method} (error)`,
            kind: 'CLIENT',
            attributes: { 'http.method': method, 'http.url': url, 'error': true },
            durationMs: Date.now() - startTime,
          })
          throw e
        }
      }
      console.log('[Systems Map] Auto-Instrumentation attached to global fetch.')
    }
  }

  public getSpans(): TelemetrySpan[] {
    return this.spans
  }

  public ingestLiveSpan(span: TelemetrySpan): void {
    this.spans.push(span)
  }

  public ingestJsonFile(content: string): void {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        for (const span of parsed) {
          this.spans.push(span)
        }
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
