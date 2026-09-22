import { AccessSite, SystemicTradeoff } from '../models/index.js'

export class TradeoffAnalyzer {
  constructor(private accessSites: AccessSite[]) {}

  public analyze(): SystemicTradeoff[] {
    const tradeoffs: SystemicTradeoff[] = []

    // 1. Simplicity vs Throughput: Are there many network/db calls inside loops across the project?
    const loopCalls = this.accessSites.filter(site => (site.type === 'query' || site.type === 'network') && site.loop_depth > 0)
    if (loopCalls.length > 0) {
      tradeoffs.push({
        id: 'tradeoff-simplicity-throughput',
        title: 'Simplicity vs Throughput',
        category: 'simplicity-vs-throughput',
        description: 'The architecture favors simplicity (writing sequential data access logic) over high throughput (batching). Instances of database or network access inside loops were detected, which scales poorly but is easier to read and write.',
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

    // 3. Memory vs Compute: Heavy array computations without caching
    const deepComputeOps = this.accessSites.filter(site => site.type === 'compute' && site.loop_depth > 1)
    if (deepComputeOps.length > 0) {
      tradeoffs.push({
        id: 'tradeoff-memory-compute',
        title: 'Memory vs Compute',
        category: 'memory-vs-compute',
        description: 'The codebase executes deep sequential computational logic (e.g. nested reduce/filter functions) without intermediate variable memoization or caching. It aggressively trades CPU cycles to maintain a low memory footprint. Suggest evaluating if the results can be cached to lower latency.',
        evidence_site_ids: deepComputeOps.map(s => s.id),
      })
    }

    // 4. Coupling vs Coordination Cost: Detecting highly coupled external network requests
    const heavyNetwork = this.accessSites.filter(site => site.type === 'network')
    if (heavyNetwork.length > 5 || (heavyNetwork.length > 0 && loopCalls.some(s => s.type === 'network'))) {
      tradeoffs.push({
        id: 'tradeoff-coupling-coordination',
        title: 'Coupling vs Coordination',
        category: 'coupling-vs-coordination',
        description: 'The system frequently couples local execution to external network resources. This creates a "Distributed Monolith" effect where latency and failure states coordinate across process boundaries. Consider if this hard coupling can be loosened via asynchronous events or messaging.',
        evidence_site_ids: heavyNetwork.map(s => s.id),
      })
    }

    return tradeoffs
  }
}
