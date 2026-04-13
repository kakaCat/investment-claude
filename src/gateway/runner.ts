import fs from 'fs'
import os from 'os'
import path from 'path'

import { ChannelManager } from './channel/manager.js'
import { channelRegistry } from './channel/registry.js'
import type { GatewayConfig, InboundMessage } from './channel/types.js'
import { buildAskUserCard, buildPlanApprovalCard, buildVerifyCard } from './channels/feishu/cards.js'
import { runQuery } from './queryRunner.js'
import { SessionManager } from './sessionManager.js'

function loadGatewayConfig(): GatewayConfig {
  const candidates = [
    path.join(process.cwd(), '.pi', 'settings.json'),
    path.join(os.homedir(), '.pi', 'settings.json'),
  ]

  for (const candidate of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(candidate, 'utf-8')) as { gateway?: GatewayConfig }
      if (raw.gateway) return raw.gateway
    } catch {
      // Continue to the next candidate.
    }
  }

  return { channels: {} }
}

function buildSystemPrompt(): string {
  return `你是一个 AI 编程助手，正在通过飞书与用户交互。\n工作目录：${process.cwd()}`
}

export async function runGateway(): Promise<void> {
  await import('./channels/feishu/index.js')

  const cfg = loadGatewayConfig()
  const sessionManager = new SessionManager()
  const channelManager = new ChannelManager()
  const abortController = new AbortController()
  const systemPrompt = buildSystemPrompt()

  process.on('SIGINT', () => abortController.abort())
  process.on('SIGTERM', () => abortController.abort())

  const stopReaper = sessionManager.startReaper()

  await channelManager.start(
    cfg,
    {
      onMessage: async (channelId, accountId, msg: InboundMessage) => {
        console.log('[gateway] onMessage', { channelId, accountId, chatId: msg.chatId, text: msg.text })
        const session = sessionManager.getOrCreate(channelId, msg.chatId, accountId)
        const plugin = channelRegistry.get(channelId)

        if (!plugin) {
          throw new Error(`Channel plugin not registered: ${channelId}`)
        }

        const sendCardReply = (
          card: unknown,
        ): Promise<string> =>
          new Promise((resolve, reject) => {
            session.pendingReply = { resolve, reject }
            void plugin.outbound.sendCard({
              account: { id: accountId, channelId },
              chatId: msg.chatId,
              card,
            }).catch(reject)
          })

        if (msg.text.trim() === '/whoami') {
          await plugin.outbound.sendText({
            account: { id: accountId, channelId },
            chatId: msg.chatId,
            text: `senderId: ${msg.senderId}\nchatId: ${msg.chatId}`,
          })
          return
        }

        const task = async () => {
          await plugin.outbound.sendText({
            account: { id: accountId, channelId },
            chatId: msg.chatId,
            text: '⏳ 正在思考...',
          })
          const chunks: string[] = []
          await runQuery(
            session,
            msg.text,
            {
              onChunk: async (text) => {
                chunks.push(text)
              },
              askUser: (question, options) =>
                sendCardReply(buildAskUserCard(msg.chatId, question, options)),
              enterPlanMode: async () => {
                await plugin.outbound.sendText({
                  account: { id: accountId, channelId },
                  chatId: msg.chatId,
                  text: '正在进入计划模式...',
                })
              },
              exitPlanMode: (plan) =>
                sendCardReply(buildPlanApprovalCard(msg.chatId, plan)),
              verifyExecution: (summary) =>
                sendCardReply(buildVerifyCard(msg.chatId, summary)),
            },
            systemPrompt,
          )
          if (chunks.length > 0) {
            await plugin.outbound.sendText({
              account: { id: accountId, channelId },
              chatId: msg.chatId,
              text: chunks.join(''),
            })
          }
        }

        if (session.processing) {
          session.messageQueue.push(task)
          return
        }

        await task()

        while (session.messageQueue.length > 0) {
          const next = session.messageQueue.shift()
          if (!next) break
          await next()
        }
      },

      onCardAction: (channelId, _accountId, chatId, answer) => {
        sessionManager.resolveCardAction(channelId, chatId, answer)
      },
    },
    abortController.signal,
  )

  await new Promise<void>((resolve) => {
    abortController.signal.addEventListener('abort', () => resolve(), { once: true })
  })

  stopReaper()
  await channelManager.stop()
  console.log('Gateway stopped.')
}
