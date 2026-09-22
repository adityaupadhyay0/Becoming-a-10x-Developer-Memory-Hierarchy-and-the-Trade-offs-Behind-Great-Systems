import { ScanReport } from '../models/index.js'

export class Reporter {
  constructor(private report: ScanReport) {}

  public toJSON(): string {
    return JSON.stringify(this.report, null, 2)
  }

  private generateMermaidGraph(): string {
    let mermaid = 'graph TD\\n'
    mermaid += '  App((Application Layer))\\n'


    // Identify what layers exist based on hot zones and access sites
    // For simplicity, we just declare the main components
    mermaid += '  Cache[(Cache Layer)]\\n'
    mermaid += '  DB[(Database Layer)]\\n'
    mermaid += '  Net((Network / External))\\n'

    // The connections represent the general memory hierarchy flow
    mermaid += '  App -->|Reads/Writes| Cache\\n'
    mermaid += '  App -->|Queries| DB\\n'
    mermaid += '  App -->|HTTP| Net\\n'

    // Dynamically inject cross-file calls if we have critical paths
    if (this.report.critical_paths) {
      for (const path of this.report.critical_paths) {
        mermaid += `  ${path.entry_function}((${path.entry_function})) -->|Path Latency: ${path.theoretical_latency_ms}ms| App\\n`
      }
    }

    return mermaid
  }

  public toHTML(): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Systems Map Report</title>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 2rem; background: #f9fafb; color: #111827; }
    h1 { margin-bottom: 0.5rem; }
    .summary { display: flex; gap: 2rem; background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 0.875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.5rem; font-weight: bold; }

    .graph-container { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; text-align: center; }

    .hotzone { background: white; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #e5e7eb; }
    .hotzone.critical { border-left-color: #ef4444; }
    .hotzone.high { border-left-color: #f97316; }
    .hotzone.medium { border-left-color: #eab308; }

    .hz-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem; border-bottom: 1px solid #f3f4f6; padding-bottom: 0.5rem;}
    .hz-title { font-weight: bold; font-size: 1.125rem; }
    .hz-badge { padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-high { background: #ffedd5; color: #9a3412; }
    .badge-medium { background: #fef9c3; color: #854d0e; }

    .hz-explanation { margin-bottom: 1rem; line-height: 1.5; color: #374151; }
    .hz-remediation { font-size: 0.875rem; background: #f3f4f6; padding: 1rem; border-radius: 0.375rem; }

    .tradeoff { background: white; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #3b82f6; }
    .tradeoff-title { font-weight: bold; font-size: 1.125rem; margin-bottom: 0.5rem; }
    .tradeoff-desc { color: #4b5563; line-height: 1.5; }

    .critical-path { background: white; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid #8b5cf6; }

    .sites-list { list-style: none; padding: 0; font-size: 0.875rem; color: #4b5563; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body>
  <h1>Systems Map Report</h1>
  <div class="summary">
    <div class="stat"><span class="stat-label">Coverage</span><span class="stat-value">${this.report.coverage_pct}%</span></div>
    <div class="stat"><span class="stat-label">Access Sites</span><span class="stat-value">${this.report.total_access_sites}</span></div>
    <div class="stat"><span class="stat-label">Hot Zones</span><span class="stat-value">${this.report.hot_zones.length}</span></div>
    <div class="stat"><span class="stat-label">Systemic Trade-offs</span><span class="stat-value">${this.report.systemic_tradeoffs?.length || 0}</span></div>
  </div>

  <div class="graph-container">
    <h2>Memory Hierarchy Flow</h2>
    <div class="mermaid">
      ${this.generateMermaidGraph()}
    </div>
  </div>

  <h2>Systemic Trade-offs</h2>
  ${(!this.report.systemic_tradeoffs || this.report.systemic_tradeoffs.length === 0) ? '<p>No systemic trade-offs detected.</p>' : ''}
  ${(this.report.systemic_tradeoffs || []).map(t => `
    <div class="tradeoff">
       <div class="tradeoff-title">${t.title}</div>
       <div class="tradeoff-desc">${t.description}</div>
    </div>
  `).join('')}

  <h2>Critical Paths</h2>
  ${(!this.report.critical_paths || this.report.critical_paths.length === 0) ? '<p>No critical latency paths detected.</p>' : ''}
  ${(this.report.critical_paths || []).map(p => `
    <div class="critical-path">
       <div class="tradeoff-title">${p.entry_function} (Est. ${p.theoretical_latency_ms}ms)</div>
       <div class="tradeoff-desc">Sequential bottlenecks: ${p.bottleneck_sites.length}</div>
       <ul class="sites-list">
          ${p.bottleneck_sites.map(id => `<li>${id}</li>`).join('')}
        </ul>
    </div>
  `).join('')}

  <h2>Hot Zones</h2>
  ${this.report.hot_zones.length === 0 ? '<p>No hot zones detected. Great job!</p>' : ''}

  ${this.report.hot_zones.map(hz => `
    <div class="hotzone ${hz.severity_score}">
      <div class="hz-header">
        <span class="hz-title">${hz.anti_pattern_type}</span>
        <span class="hz-badge badge-${hz.severity_score}">${hz.severity_score}</span>
      </div>
      <div class="hz-explanation">
        ${hz.explanation ? hz.explanation.replace(/\\n/g, '<br/>') : 'No explanation provided.'}
      </div>
      ${hz.remediation_suggestion ? `<div class="hz-remediation"><strong>Suggestion:</strong> ${hz.remediation_suggestion}</div>` : ''}
      ${hz.auto_fix_code ? `<div style="margin-top: 1rem;"><strong>Auto-Fix Code:</strong><pre style="background: #1f2937; color: #f8fafc; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;"><code>${hz.auto_fix_code}</code></pre></div>` : ''}
      <div style="margin-top: 1rem;">
        <strong>Access Sites:</strong>
        <ul class="sites-list">
          ${hz.access_site_ids.map(id => `<li>${id}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('')}

</body>
</html>
`
    return html
  }
}
