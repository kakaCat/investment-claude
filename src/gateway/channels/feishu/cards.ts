export function buildAskUserCard(
  chatId: string,
  question: string,
  options: ReadonlyArray<{ label: string; description?: string }>,
): unknown {
  return {
    schema: '2.0',
    body: {
      elements: [
        { tag: 'markdown', content: question },
        {
          tag: 'action',
          actions: options.map((opt) => ({
            tag: 'button',
            text: { tag: 'plain_text', content: opt.label },
            type: 'primary',
            value: { chatId, answer: opt.label },
          })),
        },
      ],
    },
  }
}

export function buildPlanApprovalCard(chatId: string, plan: string): unknown {
  return {
    schema: '2.0',
    body: {
      elements: [
        { tag: 'markdown', content: `**计划确认**\n\n${plan}` },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '批准' },
              type: 'primary',
              value: { chatId, answer: 'approved' },
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '拒绝' },
              type: 'danger',
              value: { chatId, answer: 'rejected' },
            },
          ],
        },
      ],
    },
  }
}

export function buildVerifyCard(chatId: string, summary: string): unknown {
  return {
    schema: '2.0',
    body: {
      elements: [
        { tag: 'markdown', content: `**执行结果确认**\n\n${summary}` },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '确认' },
              type: 'primary',
              value: { chatId, answer: 'confirmed' },
            },
          ],
        },
      ],
    },
  }
}
