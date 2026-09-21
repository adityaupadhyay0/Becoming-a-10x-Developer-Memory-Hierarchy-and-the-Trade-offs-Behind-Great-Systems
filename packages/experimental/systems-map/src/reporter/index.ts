import { ScanReport } from '../models/index.js'

export class Reporter {
  constructor(private report: ScanReport) {}

  public toJSON(): string {
    return JSON.stringify(this.report, null, 2)
  }

  public toHTML(): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Systems Map Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 2rem; background: #f9fafb; color: #111827; }
    h1 { margin-bottom: 0.5rem; }
    .summary { display: flex; gap: 2rem; background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    .stat { display: flex; flex-direction: column; }
    .stat-label { font-size: 0.875rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-value { font-size: 1.5rem; font-weight: bold; }

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

    .sites-list { list-style: none; padding: 0; font-size: 0.875rem; color: #4b5563; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body>
  <h1>Systems Map Report</h1>
  <div class="summary">
    <div class="stat"><span class="stat-label">Coverage</span><span class="stat-value">${this.report.coverage_pct}%</span></div>
    <div class="stat"><span class="stat-label">Access Sites</span><span class="stat-value">${this.report.total_access_sites}</span></div>
    <div class="stat"><span class="stat-label">Hot Zones</span><span class="stat-value">${this.report.hot_zones.length}</span></div>
  </div>

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
