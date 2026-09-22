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

    // Persona 1: The Performance Optimizer
    const optimizerPrompt = `
You are The Performance Optimizer. Analyze this Hot Zone and propose an aggressive caching or batching mechanism to solve it.
Hot Zone Details: ${hotZone.anti_pattern_type} (${hotZone.severity_score})
Source Context:
${sitesContext}
`
    const optRes = await this.askPersona(llm, defaultProvider, defaultModel, optimizerPrompt)

    // Persona 2: The Consistency Guard
    const guardPrompt = `
You are The Consistency Guard. Critique this caching/batching proposal for race conditions and stale data risks.
Proposal to critique:
${optRes}
`
    const guardRes = await this.askPersona(llm, defaultProvider, defaultModel, guardPrompt)

    // Persona 3: The Architect
    const architectPrompt = `
You are The Architect. Synthesize the debate into a final, bulletproof refactoring plan.
Optimizer's Proposal: ${optRes}
Guard's Critique: ${guardRes}

Tasks:
1. Provide a brief explanation classifying the final trade-off.
2. Generate the exact code needed to refactor the bottleneck safely based on the debate.
3. Output the exact rewrite wrapped in a markdown code block starting with \`\`\`javascript and ending with \`\`\`.
`

    const finalRes = await this.askPersona(llm, defaultProvider, defaultModel, architectPrompt)

    if (finalRes) {
      const codeBlockRegex = /```(?:javascript|typescript)?\n([\s\S]*?)\n```/
      const match = finalRes.match(codeBlockRegex)

      hotZone.explanation = finalRes.replace(codeBlockRegex, '').trim()

      if (match && match[1]) {
        hotZone.auto_fix_code = match[1].trim()
      }
    }
  }

  private async askPersona(llm: LlmRuntime, provider: string, model: string, prompt: string): Promise<string> {
    const messageId = ('msg-' + Date.now()) as Branded<'MessageId'>
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
        provider,
        model,
        messages,
        maxTokens: 1200,
        temperature: 0.2,
      })
      return await extractText(stream)
    } catch (e) {
      console.error('Persona execution failed:', e)
      return ''
    }
  }
}
