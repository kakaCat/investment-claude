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
    if (!name) return { data: 'ERROR: Skill name cannot be empty.' }

    const found = await findSkill(name, context.cwd)
    if (!found) {
      return { data: `ERROR: Unknown skill '${name}'. Use discover_skills to list available skills.` }
    }

    let content: string
    try {
      content = await loadSkillContent(found)
    } catch {
      return { data: `ERROR: Failed to read skill file for '${name}'.` }
    }
    content = content.replace(/\$ARGUMENTS/g, args ?? '')
    return { data: content }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (data.startsWith('ERROR:')) {
      let errorMsg = `<error>${data}</error>\n\n`

      if (data.includes('Skill name cannot be empty')) {
        errorMsg += `Provide a valid skill name (e.g., "commit", "review-pr").`
      } else if (data.includes('Unknown skill')) {
        errorMsg += `The skill was not found. Use discover_skills to see all available skills in the current project.`
      } else if (data.includes('Failed to read skill file')) {
        errorMsg += `The skill file exists but could not be read. Check file permissions or file integrity.`
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: errorMsg,
        is_error: true,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `${data}\n\n[Skill loaded successfully. Follow the instructions above.]`,
    }
  },
})
