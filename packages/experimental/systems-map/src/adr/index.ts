import { HotZone } from '../models/index.js'
import * as fs from 'fs'
import * as path from 'path'

export class AdrGenerator {
  constructor(private adrDir: string = './docs/adr') {}

  public generateAdr(hz: HotZone): void {
    if (!fs.existsSync(this.adrDir)) {
      fs.mkdirSync(this.adrDir, { recursive: true })
    }

    const id = Date.now()
    const filename = path.join(this.adrDir, `${id}-refactor-${hz.anti_pattern_type.toLowerCase().replace(/\s+/g, '-')}.md`)

    const content = `# ADR ${id}: Resolve ${hz.anti_pattern_type}

## Status
Accepted / Implemented (Auto-Healed by Systems Map Agent)

## Context
The Systems Map Architectural Engine detected a structural memory hierarchy bottleneck (${hz.severity_score} severity).

**Explanation:**
${hz.explanation}

## Decision
The LlmAutoFixer multi-agent debate (Optimizer, Guard, Architect) arrived at the following refactored implementation to correct the architectural flaw:

\`\`\`javascript
${hz.auto_fix_code}
\`\`\`

## Consequences
- **Positive:** Reduces latency, heals memory constraints, and improves system throughput.
- **Negative:** Increased code complexity due to batching/caching logic.
`

    fs.writeFileSync(filename, content, 'utf8')
    console.log(`[ADR Generator] Wrote architectural decision record to ${filename}`)
  }
}
