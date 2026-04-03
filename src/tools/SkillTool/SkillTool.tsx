import React from 'react'
import { buildTool } from '../../Tool.js'
import { findSkill, loadSkillContent } from '../../skills/index.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { SkillToolUseUI, SkillToolResultUI } from './UI.js'

export const SkillTool = buildTool({
  name: 'skill',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'The skill name (e.g., "commit", "review-pr"). Leading slash is optional.',
      },
      args: {
        type: 'string',
        description: 'Optional arguments passed to the skill. Replaces $ARGUMENTS in the skill content.',
      },
    },
    required: ['skill'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <SkillToolUseUI input={input as { skill: string; args?: string }} />,
  renderToolResult: (result) => <SkillToolResultUI result={result} />,
  async call(input, context) {
    const { skill, args } = input as { skill: string; args?: string }
    const name = skill.trim()
    if (!name) return 'ERROR: Skill name cannot be empty.'

    const found = await findSkill(name, context.cwd)
    if (!found) {
      return `ERROR: Unknown skill '${name}'. Use discover_skills to list available skills.`
    }

    let content: string
    try {
      content = await loadSkillContent(found)
    } catch {
      return `ERROR: Failed to read skill file for '${name}'.`
    }
    content = content.replace(/\$ARGUMENTS/g, args ?? '')
    return content
  },
})
