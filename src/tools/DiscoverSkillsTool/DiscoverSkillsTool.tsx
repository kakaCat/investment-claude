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
      return {

        data: 'No skill directories found. Create ~/.claude/commands/ or .claude/commands/ and add .md files.'

      }
    }

    const skills = await listSkills(context.cwd)
    if (skills.length === 0) {
      return {

        data: `Skill directories found (${dirs.join(', ')}) but no .md skill files inside them.`

      }
    }

    const lines = skills.map(s =>
      s.description ? `- **${s.name}**: ${s.description}` : `- **${s.name}**`
    )
    return {

      data: `Available skills (${skills.length}):\n\n${lines.join('\n')}`

    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (data.includes('No skill directories found')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `${data}\n\nSkills are custom commands stored as markdown files. To create skills:\n1. Create ~/.claude/commands/ (global) or .claude/commands/ (project-specific)\n2. Add .md files with skill definitions\n3. Use the skill tool to invoke them`,
      }
    }

    if (data.includes('but no .md skill files')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `${data}\n\nThe skill directories exist but are empty. Add .md files to define custom skills.`,
      }
    }

    const skillCount = data.match(/Available skills \((\d+)\)/)?.[1] || '0'
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `${data}\n\nUse the skill tool to invoke any of these ${skillCount} skills (e.g., skill: "commit").`,
    }
  },
})
