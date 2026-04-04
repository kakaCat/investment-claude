import { platform, release } from 'os'
import type { SectionContext } from '../constants/systemPromptSections.js'

export async function loadEnvInfo(ctx: SectionContext): Promise<string> {
  const lines = [
    '# User Environment Info',
    `Current project location: ${ctx.cwd}`,
    `Operating system: ${platform()}`,
    `System version: ${platform()} ${release()}`,
    `Session ID: ${ctx.sessionId}`,
    `Session date: ${new Date().toISOString().slice(0, 10)}`,
  ]
  return lines.join('\n')
}
