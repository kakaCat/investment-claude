import { describe, expect, it } from 'vitest'
import * as lark from '@larksuite/oapi-sdk-nodejs'

import { createFeishuClients, extractTextFromMessage } from './client.js'

describe('createFeishuClients', () => {
  it('creates api and websocket clients with the provided credentials', () => {
    const clients = createFeishuClients('app-id', 'app-secret')

    expect(clients.client).toBeInstanceOf(lark.Client)
    expect(clients.wsClient).toBeInstanceOf(lark.WSClient)
  })
})

describe('extractTextFromMessage', () => {
  it('returns the text payload for text messages', () => {
    expect(
      extractTextFromMessage({
        message_type: 'text',
        content: JSON.stringify({ text: 'hello' }),
      }),
    ).toBe('hello')
  })

  it('returns an empty string for non-text or invalid payloads', () => {
    expect(
      extractTextFromMessage({
        message_type: 'post',
        content: JSON.stringify({ text: 'ignored' }),
      }),
    ).toBe('')
    expect(
      extractTextFromMessage({
        message_type: 'text',
        content: '{',
      }),
    ).toBe('')
  })
})
