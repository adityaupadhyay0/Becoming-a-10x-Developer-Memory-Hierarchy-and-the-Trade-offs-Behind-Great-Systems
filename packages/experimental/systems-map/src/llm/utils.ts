import type { StreamChunk } from '@deepseek-ai/dsh-llm'

export async function extractText(stream: AsyncIterable<StreamChunk>): Promise<string> {
  let result = ''
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') {
      result += chunk.text
    } else if (chunk.type === 'block-end' && chunk.block.type === 'text') {
      // block text is captured entirely by text-delta but just in case
    }
  }
  return result.trim()
}
