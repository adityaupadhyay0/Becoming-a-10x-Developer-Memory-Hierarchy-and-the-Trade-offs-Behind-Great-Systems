import { AccessSite, CriticalPath } from '../models/index.js'

export class CriticalPathProfiler {
  constructor(private accessSites: AccessSite[]) {}

  public profile(): CriticalPath[] {
    const paths: CriticalPath[] = []

    // Group sites by parent function
    const funcMap = new Map<string, AccessSite[]>()
    for (const site of this.accessSites) {
      if (site.parent_function) {
        if (!funcMap.has(site.parent_function)) {
          funcMap.set(site.parent_function, [])
        }
        const arr = funcMap.get(site.parent_function)
        if (arr) arr.push(site)
      }
    }

    // A highly simplified "theoretical minimum latency" calculation
    // Assume all operations in the same parent block execute sequentially in JS.
    // Cost = sum(estimated_latency * estimated_frequency)
    for (const [funcName, sites] of funcMap.entries()) {
      let totalCost = 0
      const bottlenecks: string[] = []

      for (const site of sites) {
        const siteCost = site.estimated_latency * site.estimated_frequency
        totalCost += siteCost
        if (siteCost >= 50) {
          bottlenecks.push(site.id)
        }
      }

      if (totalCost >= 100) { // Only log expensive critical paths
        paths.push({
          entry_function: funcName,
          theoretical_latency_ms: totalCost,
          bottleneck_sites: bottlenecks,
        })
      }
    }

    // Sort by most expensive first
    return paths.sort((a, b) => b.theoretical_latency_ms - a.theoretical_latency_ms)
  }
}
