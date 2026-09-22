import { StaticAnalyzer } from '../analyzer/index.js'
import { AntiPatternDetector } from '../detector/index.js'
import { TradeoffAnalyzer } from '../detector/tradeoffs.js'
import { Reporter } from '../reporter/index.js'
import { ScanReport } from '../models/index.js'
import * as fs from 'fs'
import * as path from 'path'

export async function runScan(targetDir: string, outDir: string): Promise<ScanReport> {
  const analyzer = new StaticAnalyzer()

  function walkDir(dir: string) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'lib') {
          walkDir(fullPath)
        }
      } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.js')) {
        const content = fs.readFileSync(fullPath, 'utf8')
        analyzer.analyzeFile(fullPath, content)
      }
    }
  }

  if (fs.existsSync(targetDir)) {
    walkDir(targetDir)
  } else {
    throw new Error(`Target directory ${targetDir} does not exist.`)
  }

  const result = analyzer.getResult()

  const detector = new AntiPatternDetector(result.accessSites)
  const hotZones = detector.detect()

  const tradeoffAnalyzer = new TradeoffAnalyzer(result.accessSites)
  const tradeoffs = tradeoffAnalyzer.analyze()

  const report: ScanReport = {
    scan_id: `scan-${Date.now()}`,
    timestamp: new Date().toISOString(),
    repo_ref: 'HEAD',
    coverage_pct: result.coveragePct,
    total_access_sites: result.accessSites.length,
    hot_zones: hotZones,
    systemic_tradeoffs: tradeoffs,
    schema_version: '0.1.0',
  }

  const reporter = new Reporter(report)

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  fs.writeFileSync(path.join(outDir, 'systemsmap-report.json'), reporter.toJSON(), 'utf8')
  fs.writeFileSync(path.join(outDir, 'systemsmap-report.html'), reporter.toHTML(), 'utf8')

  return report
}
