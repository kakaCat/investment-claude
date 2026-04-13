import { describe, expect, it } from 'vitest'

import { buildAskUserCard, buildPlanApprovalCard, buildVerifyCard } from './cards.js'

describe('buildAskUserCard', () => {
  it('builds action buttons from the provided options', () => {
    expect(
      buildAskUserCard('chat-1', 'Choose one', [
        { label: 'A' },
        { label: 'B', description: 'unused' },
      ]),
    ).toEqual({
      schema: '2.0',
      body: {
        elements: [
          { tag: 'markdown', content: 'Choose one' },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: { tag: 'plain_text', content: 'A' },
                type: 'primary',
                value: { chatId: 'chat-1', answer: 'A' },
              },
              {
                tag: 'button',
                text: { tag: 'plain_text', content: 'B' },
                type: 'primary',
                value: { chatId: 'chat-1', answer: 'B' },
              },
            ],
          },
        ],
      },
    })
  })
})

describe('approval and verification cards', () => {
  it('builds the plan approval card', () => {
    expect(buildPlanApprovalCard('chat-1', '1. Step one')).toEqual({
      schema: '2.0',
      body: {
        elements: [
          { tag: 'markdown', content: '**计划确认**\n\n1. Step one' },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: { tag: 'plain_text', content: '批准' },
                type: 'primary',
                value: { chatId: 'chat-1', answer: 'approved' },
              },
              {
                tag: 'button',
                text: { tag: 'plain_text', content: '拒绝' },
                type: 'danger',
                value: { chatId: 'chat-1', answer: 'rejected' },
              },
            ],
          },
        ],
      },
    })
  })

  it('builds the verification card', () => {
    expect(buildVerifyCard('chat-1', 'All checks finished.')).toEqual({
      schema: '2.0',
      body: {
        elements: [
          { tag: 'markdown', content: '**执行结果确认**\n\nAll checks finished.' },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: { tag: 'plain_text', content: '确认' },
                type: 'primary',
                value: { chatId: 'chat-1', answer: 'confirmed' },
              },
            ],
          },
        ],
      },
    })
  })
})
