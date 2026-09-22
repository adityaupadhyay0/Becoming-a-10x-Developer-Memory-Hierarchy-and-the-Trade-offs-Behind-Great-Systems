import { Context } from '@deepseek-ai/cordis'
import { HotZone, AccessSite } from '../models/index.js'
import type { LlmRuntime, Message } from '@deepseek-ai/dsh-llm'
import type { Branded } from '@deepseek-ai/dsh-brand'
import { extractText } from './utils.js'

export class LlmAutoFixer {
  constructor(private ctx: Context) {}

  public async generateExplanationAndFix(
    hotZone: HotZone,
    accessSites: AccessSite[],
    defaultProvider: string,
    defaultModel: string,
  ): Promise<void> {
    const llm = this.ctx.get('llm') as unknown as LlmRuntime

    if (!llm) {
      console.warn('LLM service not found. Cannot generate auto-fix.')
      return
    }

    const sitesContext = hotZone.access_site_ids.map((id) => {
      const site = accessSites.find(s => s.id === id)
      if (site) {
        return `- Location: ${site.file}:${site.line}\n- Snippet:\n\`\`\`javascript\n${site.code_snippet}\n\`\`\`\n`
      }
      return ''
    }).join('\n')

    const prompt = `
You are an expert systems architect analyzing a performance Hot Zone in a codebase.
Use the Systems Thinking: Memory Hierarchy & Engineering Trade-offs framework.

Hot Zone Details:
- ID: ${hotZone.id}
- Type: ${hotZone.anti_pattern_type}
- Severity: ${hotZone.severity_score}
- Static Explanation: ${hotZone.explanation}

Source Code Context:
${sitesContext}

Tasks:
1. Provide a brief explanation classifying the Hot Zone (trade-off, constraint, or false dichotomy).
2. Look at the Source Code Snippet and generate the exact code needed to refactor and fix the bottleneck. (e.g. converting a synchronous loop into a batched Promise.all or using a DataLoader).
3. Output the exact rewrite wrapped in a markdown code block starting with \`\`\`javascript (or typescript) and ending with \`\`\`.

Ensure the code rewrite uses the actual variables from the provided snippet.
`

    const messageId = 'msg-1' as Branded<'MessageId'>

    const messages: Message[] = [
      {
        id: messageId,
        role: 'user',
        content: [{ type: 'text', text: prompt }],
        source: { kind: 'user' },
      },
    ]

    try {
      const stream = llm.stream({
        provider: defaultProvider,
        model: defaultModel,
        messages,
        maxTokens: 1200, // Increased to accommodate code generation
        temperature: 0.1,
      })

      const fullText = await extractText(stream)
      if (fullText) {
        // Simple extraction heuristic for the markdown block
        const codeBlockRegex = /```(?:javascript|typescript)?\n([\s\S]*?)\n```/
        const match = fullText.match(codeBlockRegex)

        hotZone.explanation = fullText.replace(codeBlockRegex, '').trim()

        if (match && match[1]) {
          hotZone.auto_fix_code = match[1].trim()
        }
      }

    } catch (e) {
      console.error('Failed to generate LLM explanation and fix:', e)
    }
  }
}
