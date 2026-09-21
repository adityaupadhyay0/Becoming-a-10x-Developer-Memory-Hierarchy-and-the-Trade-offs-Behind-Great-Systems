import { Context } from '@deepseek-ai/cordis'
import { HotZone } from '../models/index.js'
import type { LlmRuntime, Message } from '@deepseek-ai/dsh-llm'
import type { Branded } from '@deepseek-ai/dsh-brand'
import { extractText } from './utils.js'

export class LlmExplainer {
  constructor(private ctx: Context) {}

  public async generateExplanation(hotZone: HotZone, defaultProvider: string, defaultModel: string): Promise<void> {
    const llm = this.ctx.get('llm') as unknown as LlmRuntime

    if (!llm) {
      console.warn('LLM service not found. Cannot generate explanation.')
      return
    }

    const prompt = `
You are an expert systems architect analyzing a performance Hot Zone in a codebase.
Use the Systems Thinking: Memory Hierarchy & Engineering Trade-offs framework.

Hot Zone Details:
- ID: ${hotZone.id}
- Type: ${hotZone.anti_pattern_type}
- Severity: ${hotZone.severity_score}
- Static Explanation: ${hotZone.explanation}

Provide a natural-language explanation classifying it as one of: a real trade-off, a violated constraint, or a likely false dichotomy.
Suggest a candidate remediation pattern.
Keep it strictly grounded to these facts. Do not invent any numbers. Output in simple text.
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
        maxTokens: 500,
        temperature: 0.1,
      })

      const fullText = await extractText(stream)
      if (fullText) {
        hotZone.explanation = fullText
      }

    } catch (e) {
      console.error('Failed to generate LLM explanation:', e)
    }
  }
}
