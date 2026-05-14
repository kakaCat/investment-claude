import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { AskUserQuestionToolUseUI, AskUserQuestionToolResultUI } from './UI.js'

export const AskUserQuestionTool = buildTool({
  name: 'ask_followup_question',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question to ask the user' },
      options: { type: 'array', description: '2-4 options', items: { type: 'object', properties: { label: { type: 'string' }, description: { type: 'string' } }, required: ['label'] } },
    },
    required: ['question', 'options'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <AskUserQuestionToolUseUI input={input as { question: string; options: Array<{ label: string; description?: string }> }} />,
  renderToolResult: (result) => <AskUserQuestionToolResultUI result={result} />,
  async call(input, context) {
    const { question, options } = input as { question: string; options: Array<{ label: string; description?: string }> }
    if (!context.askUser) {
      return {
        data: {
          question,
          options,
          answer: options[0]?.label ?? 'none',
          isDefault: true,
        }
      }
    }
    const answer = await context.askUser(question, options)
    return {
      data: {
        question,
        options,
        answer,
        isDefault: false,
      }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data.isDefault
        ? `[No interactive UI available — defaulting to first option: ${data.answer}]`
        : data.answer,
    }
  },
  renderToolResultMessage(data) {
    return <AskUserQuestionToolResultUI result={data} />
  },
})
