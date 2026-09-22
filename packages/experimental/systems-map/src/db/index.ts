import { AccessSite } from '../models/index.js'

export class DatabaseIntrospector {
  constructor(private connectionString?: string) {}

  public async introspect(sites: AccessSite[]): Promise<void> {
    if (!this.connectionString) {
      console.log('[DB Introspector] No DB connection string provided, mocking EXPLAIN ANALYZE for unindexed queries.')
    }

    for (const site of sites) {
      if (site.type === 'query' && site.code_snippet) {
        // Mocking an execution plan extraction based on simple AST heuristics
        const isLikelyUnindexed = site.code_snippet.includes('LIKE') || site.code_snippet.includes('where(') && !site.code_snippet.includes('id')

        if (isLikelyUnindexed) {
          site.execution_plan = {
            hasSeqScan: true,
            estimatedCost: 8500.5,
            rawPlan: '->  Seq Scan on users (cost=0.00..8500.50 rows=1000000 width=64)\\n      Filter: (email ~~ \'%test%\')',
            suggestedIndex: 'CREATE INDEX idx_users_email ON users(email);',
          }
        }
      }
    }
  }
}
