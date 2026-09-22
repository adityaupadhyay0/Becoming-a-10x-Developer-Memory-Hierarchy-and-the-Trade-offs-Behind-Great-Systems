import { AccessSite, SystemicTradeoff } from '../models/index.js'

export class TradeoffAnalyzer {
  constructor(private accessSites: AccessSite[]) {}

  public analyze(): SystemicTradeoff[] {
    const tradeoffs: SystemicTradeoff[] = []

    // 1. Simplicity vs Throughput: Are there many network/db calls inside loops across the project?
    const loopCalls = this.accessSites.filter(site => (site.type === 'query' || site.type === 'network') && site.loop_depth > 0)
    if (loopCalls.length > 2) {
      tradeoffs.push({
        id: 'tradeoff-simplicity-throughput',
        title: 'Simplicity vs Throughput',
        category: 'simplicity-vs-throughput',
        description: 'The architecture favors simplicity (writing sequential data access logic) over high throughput (batching). Multiple instances of database or network access inside loops were detected, which scales poorly but is easier to read and write.',
        evidence_site_ids: loopCalls.map(s => s.id),
      })
    }

    // 2. Consistency vs Availability: Is there a heavy reliance on direct DB queries without an intermediate cache layer?
    const dbQueries = this.accessSites.filter(site => site.type === 'query')
    const cacheCalls = this.accessSites.filter(site => site.type === 'cache')

    if (dbQueries.length > 0 && cacheCalls.length === 0) {
      tradeoffs.push({
        id: 'tradeoff-consistency-availability',
        title: 'Consistency vs Availability (No Caching)',
        category: 'consistency-vs-availability',
        description: 'The architecture favors strict Consistency by querying the database directly for all data, avoiding the latency and complexity of cache invalidation. However, this trades away Availability and low latency under high load, as the database is a single point of contention.',
        evidence_site_ids: dbQueries.map(s => s.id),
      })
    }

    // 3. Memory vs Compute: (Placeholder for when we detect memoization / heavy compute ops without caching)
    // For now, if we have cache writes but minimal reads, or vice versa

    return tradeoffs
  }
}
