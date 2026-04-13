# 飞书 Gateway 设计文档

**日期**: 2026-04-06  
**状态**: 待实现

---

## 背景

pi-claude-code 目前是纯终端 REPL。本方案为其增加 `pi gateway` 命令，通过可扩展的 Channel 插件架构，以飞书作为第一个渠道实现，让用户可以在飞书中与 Agent 交互。

---

## 目标

- 新增 `pi gateway` 命令，独立于现有 REPL 运行
- 定义 `ChannelPlugin` 插件接口，支持未来添加其他渠道（钉钉、企业微信等）
- 实现飞书渠道适配器，使用 WebSocket 长连接（无需公网 IP）
- 交互式工具（`AskUserQuestion`、`EnterPlanMode`）通过飞书卡片实现

---

## 架构

### 目录结构

```
src/gateway/
├── cmd.ts                    # `pi gateway` 命令入口
├── runner.ts                 # GatewayRunner 主循环
├── sessionManager.ts         # Session 生命周期管理
├── queryRunner.ts            # 无头包装 query()
├── channel/
│   ├── types.ts              # ChannelPlugin 接口定义
│   ├── registry.ts           # 渠道注册表
│   └── manager.ts            # 渠道连接管理（启动/停止/重连）
└── channels/
    └── feishu/
        ├── index.ts          # 注册 Feishu ChannelPlugin
        ├── client.ts         # WS 长连接（@larksuite/oapi-sdk-nodejs）
        ├── handler.ts        # 事件路由（消息 + 卡片回调）
        ├── sender.ts         # 发送文本 / 卡片
        └── cards.ts          # 卡片构建（AskUserQuestion、EnterPlanMode）
```

### 核心数据流

```
飞书用户发消息
  → FeishuClient（WS 长连接）
  → handler.ts（解析 im.message.receive_v1）
  → SessionManager.getOrCreate(chatId)
  → QueryRunner.run(session, userText, onChunk)
  → query()（复用现有引擎，零改动）
  → onChunk 流式回调
  → sender.ts 发回飞书

用户点击卡片按钮
  → handler.ts（解析 card.action.trigger）
  → SessionManager.resolveCardAction(openId, value)
  → query() 中挂起的 askUser() Promise 恢复
  → 继续执行
```

---

## 接口定义

### ChannelPlugin

```typescript
// src/gateway/channel/types.ts

export type ChannelPlugin = {
  id: string
  meta: {
    label: string
    description: string
  }

  // 从 settings.json 解析账号配置
  config: {
    resolveAccounts(cfg: GatewayConfig): ChannelAccount[]
  }

  // 建立长连接，接收消息
  gateway: {
    // 启动账号连接，返回 disconnect 函数
    startAccount(ctx: ChannelGatewayContext): Promise<() => void>
  }

  // 发送消息回渠道
  outbound: {
    sendText(ctx: ChannelOutboundContext): Promise<void>
    sendCard(ctx: ChannelCardContext): Promise<void>
    sendTyping?(chatId: string, accountId: string): Promise<void>
  }
}

export type ChannelGatewayContext = {
  account: ChannelAccount
  onMessage: (msg: InboundMessage) => void
  onCardAction: (openId: string, value: Record<string, string>) => void
  signal: AbortSignal
}

export type InboundMessage = {
  chatId: string
  senderId: string
  text: string
  messageId: string
  threadId?: string
}

export type ChannelOutboundContext = {
  account: ChannelAccount
  chatId: string
  text: string
  replyToId?: string
  threadId?: string
}

export type ChannelCardContext = {
  account: ChannelAccount
  chatId: string
  card: unknown  // 飞书卡片 JSON
}

export type ChannelAccount = {
  id: string
  [key: string]: unknown  // 渠道特定字段（appId、token 等）
}
```

---

## Session 管理

```typescript
// src/gateway/sessionManager.ts

type QuerySession = {
  chatId: string
  channelId: string
  accountId: string
  messages: MessageParam[]        // query() 消息历史
  lastActiveAt: number
  abortController: AbortController
  pendingReply: {                 // 等待卡片回调时非 null
    resolve: (value: string) => void
    reject: (err: Error) => void
  } | null
}
```

**Session 生命周期：**
- 首条消息到达 → 创建 Session（空历史）
- 每轮对话后更新 `messages` 和 `lastActiveAt`
- 30 分钟无活动 → Reaper 自动清理
- 下次消息到达 → 重建 Session（新对话）

**并发处理：**
- 同一 `chatId` 前一条消息处理中，新消息排队等待（不打断当前 query）
- 不同 `chatId` 完全并行

**卡片回调处理：**
- 发送卡片时在 action value 中嵌入 `chatId`（如 `{ "chatId": "oc_xxx", "answer": "A" }`）
- `card.action.trigger` 到达时从 action value 取出 `chatId`，查找对应 session
- 调用 `session.pendingReply.resolve(value.answer)` 恢复挂起的 query

---

## QueryRunner

```typescript
// src/gateway/queryRunner.ts

async function runQuery(
  session: QuerySession,
  userText: string,
  onChunk: (text: string) => void,
  askUserViaChannel: (question: string, options?: string[]) => Promise<string>,
  signal: AbortSignal,
): Promise<void> {
  session.messages.push({ role: 'user', content: userText })

  const stream = query({
    messages: session.messages,
    tools: assembleToolPool(),
    systemPrompt: getSystemPrompt(),
    maxTurns: 10,
    canUseTool: () => ({ behavior: 'allow' }),
    signal,
    // gateway 模式替换 askUser 实现
    askUser: askUserViaChannel,
  })

  for await (const event of stream) {
    if (event.type === 'text_delta') {
      onChunk(event.text)
    }
    if (event.type === 'messages_snapshot') {
      session.messages = event.messages
    }
  }
}
```

---

## 飞书实现

### 长连接

```typescript
// src/gateway/channels/feishu/client.ts
import * as lark from '@larksuite/oapi-sdk-nodejs'

export function createFeishuClient(appId: string, appSecret: string) {
  const client = new lark.Client({ appId, appSecret })
  const wsClient = new lark.WSClient({ appId, appSecret })
  return { client, wsClient }
}
```

### 事件路由

```typescript
// src/gateway/channels/feishu/handler.ts

wsClient.start({
  eventDispatcher: new lark.EventDispatcher({})
    // 普通消息
    .register('im.message.receive_v1', async (data) => {
      const { chat_id, sender, message } = data.event
      ctx.onMessage({
        chatId: chat_id,
        senderId: sender.sender_id.user_id,
        text: extractText(message),
        messageId: message.message_id,
      })
    })
    // 卡片交互回调（chatId 由构建卡片时嵌入 action.value）
    .register('card.action.trigger', async (data) => {
      const { chatId, ...answer } = data.action.value
      ctx.onCardAction(chatId, answer)
    })
})
```

### 卡片形态

| 工具 | 卡片内容 |
|------|---------|
| `AskUserQuestion` | 问题文本 + 选项按钮（每个选项一个按钮） |
| `EnterPlanMode` | 计划内容（Markdown 渲染）+ 「批准」/「修改」按钮 |
| `ExitPlanMode` | 执行结果摘要 + 确认按钮 |

---

## 配置

扩展 `.pi/settings.json`：

```json
{
  "gateway": {
    "channels": {
      "feishu": {
        "accounts": {
          "default": {
            "appId": "cli_xxxxx",
            "appSecret": "xxxxx",
            "allowFrom": ["ou_xxxxx"]
          }
        }
      }
    }
  }
}
```

- `allowFrom`：允许触发 Agent 的用户/群 ID 列表，空数组表示不限制
- 支持多账号（`default`、`work` 等命名账号）

---

## 依赖

新增：
- `@larksuite/oapi-sdk-nodejs` — 飞书官方 Node.js SDK（含 WS 长连接）

---

## 不在范围内

- 媒体文件（图片、文件）收发
- 飞书群管理（创建群、邀请成员等）
- 其他渠道实现（钉钉、企业微信）
- Gateway 鉴权层（allowFrom 为当前唯一访问控制）
