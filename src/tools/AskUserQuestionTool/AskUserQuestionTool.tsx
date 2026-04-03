import React from 'react'
import { buildTool, type AskUserOption } from '../../Tool.js'
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
      options: {
        type: 'array',
        description: '2-4 options for the user to choose from',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['label'],
        },
      },
    },
    required: ['question', 'options'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <AskUserQuestionToolUseUI
      input={input as { question: string; options: AskUserOption[] }}
    />
  ),
  renderToolResult: (result) => <AskUserQuestionToolResultUI result={result} />,
  async call(input, context) {
    const { question, options } = input as {
      question: string
      options: AskUserOption[]
    }

    if (!context.askUser) {
      return options[0]?.label ?? 'No options provided'
    }

    return context.askUser(question, options)
  },
})
