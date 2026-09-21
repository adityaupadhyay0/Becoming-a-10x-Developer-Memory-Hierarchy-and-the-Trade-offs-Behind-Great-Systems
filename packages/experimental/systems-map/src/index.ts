import { Context } from '@deepseek-ai/cordis'
import * as Models from './models/index.js'
import { runScan } from './cli/index.js'
import { ReportDiffer, formatPRComment } from './ci/index.js'
import * as fs from 'fs'

export const name = 'systems-map'

export interface Config {}

export function apply(ctx: Context, _config: Config) {
  ctx.effect(() => {
    // Systems Map core initialized
    return () => {}
  })
}

export function diffReports(basePath: string, headPath: string): string | null {
  if (!fs.existsSync(basePath) || !fs.existsSync(headPath)) {
    throw new Error('Both base and head reports must exist to diff.')
  }
  const baseReport = JSON.parse(fs.readFileSync(basePath, 'utf8'))
  const headReport = JSON.parse(fs.readFileSync(headPath, 'utf8'))

  const differ = new ReportDiffer()
  const newHotZones = differ.diff(baseReport, headReport)
  return formatPRComment(newHotZones)
}

export { Models, runScan }
