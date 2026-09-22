import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { runScan } from '../cli/index.js'
import { LlmAutoFixer } from '../llm/index.js'

export function apply(ctx: Context) {
  ctx.effect(() => {
    // Assuming ToolRegistry is available loosely
    const tools = ctx.get('tools') as unknown as { register: (schema: unknown) => () => void }
    if (!tools) return () => {}

    const unregister = tools.register({
      name: 'systemsmap_scan',
      description: 'Statically analyzes the given directory to detect memory hierarchy bottlenecks, structural trade-offs, and critical path latencies. Optionally generates auto-fix refactoring code using the LLM for any discovered Hot Zones.',
      parameters: z.object({
        targetDir: z.string().description('The local directory path to scan. Defaults to "."'),
        generateAutoFixes: z.boolean().default(false).description('Whether to automatically query the LLM to generate auto-fix refactoring code for the hot zones.'),
      }),
      output: {
        render: (value: string) => value,
      },
      async execute({ targetDir, generateAutoFixes }: { targetDir: string; generateAutoFixes: boolean }, _scope: unknown) {
        try {
          const report = await runScan(targetDir || '.', './systemsmap-report')

          if (generateAutoFixes && report.hot_zones.length > 0) {
            const fixer = new LlmAutoFixer(ctx)
            for (const hz of report.hot_zones) {
              // passing empty array as fallback for the LLM
              await fixer.generateExplanationAndFix(hz, [], 'claude', 'claude-3-5-sonnet-latest')
            }
          }

          let resultText = `Scan Complete. Found ${report.hot_zones.length} Hot Zones and ${report.systemic_tradeoffs?.length || 0} Systemic Trade-offs.\n`

          if (report.hot_zones.length > 0) {
            resultText += '\nHot Zones:\n'
            for (const hz of report.hot_zones) {
              resultText += `- ${hz.anti_pattern_type} (${hz.severity_score})\n`
              if (hz.auto_fix_code) {
                resultText += `  Auto-Fix available!\n\`\`\`javascript\n${hz.auto_fix_code}\n\`\`\`\n`
              }
            }
          }

          return resultText
        } catch (e) {
          return `Scan failed: ${e instanceof Error ? e.message : String(e)}`
        }
      },
    })

    return () => {
      if (unregister) unregister()
    }
  })
}
