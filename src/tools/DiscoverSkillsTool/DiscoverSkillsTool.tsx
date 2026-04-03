import React from 'react'
import { buildTool } from '../../Tool.js'
import { listSkills, getSkillDirs } from '../../skills/index.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { DiscoverSkillsToolUseUI, DiscoverSkillsToolResultUI } from './UI.js'

export const DiscoverSkillsTool = buildTool({
  name: 'discover_skills',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  isReadOnly: () => true,
  renderToolUse: (_input) => <DiscoverSkillsToolUseUI />,
  renderToolResult: (result) => <DiscoverSkillsToolResultUI result={result} />,
  async call(_input, context) {
    const dirs = getSkillDirs(context.cwd)
    if (dirs.length === 0) {
      return 'No skill directories found. Create ~/.claude/commands/ or .claude/commands/ and add .md files.'
    }

    const skills = await listSkills(context.cwd)
    if (skills.length === 0) {
      return `Skill directories found (${dirs.join(', ')}) but no .md skill files inside them.`
    }

    const lines = skills.map(s =>
      s.description ? `- **${s.name}**: ${s.description}` : `- **${s.name}**`
    )
    return `Available skills (${skills.length}):\n\n${lines.join('\n')}`
  },
})
