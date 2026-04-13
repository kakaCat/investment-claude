// 统一推理抽象层 — 对标 Claude Code src/utils/thinking.ts
// 职责：检测 ultrathink 关键词，根据模型返回正确的推理 API 参数

const ULTRATHINK_REGEX = /\bultrathink\b/i

/** 检测文本是否包含 ultrathink 关键词 */
export function hasUltrathinkKeyword(text: string): boolean {
  return ULTRATHINK_REGEX.test(text)
}

/**
 * 判断模型是否支持 thinking 参数。
 * - Claude 3.7+ 和 Claude 4 系列支持
 * - Claude 3.5 及以下、非 Claude 模型不支持（o1/R1 等推理模型自带推理，无需额外参数）
 */
export function modelSupportsThinking(model: string): boolean {
  const m = model.toLowerCase()
  if (!m.includes('claude')) return false
  // 排除 claude-3.5、claude-3-haiku/sonnet/opus（不支持 thinking 参数）
  if (
    m.includes('claude-3-5') ||
    m.includes('claude-3-haiku') ||
    m.includes('claude-3-sonnet') ||
    m.includes('claude-3-opus')
  ) {
    return false
  }
  return true
}

export type ThinkingAPIParams = {
  /** 传给 Anthropic API 的 thinking 字段 */
  thinking?: { type: 'enabled'; budget_tokens: number }
  /** thinking 激活时需要更大的 max_tokens（必须 > budget_tokens）*/
  max_tokens?: number
}

/**
 * 返回需要注入 API 调用的推理参数。
 *
 * - Claude 支持 thinking 参数的模型 → 返回 thinking + max_tokens
 * - o1 / o3 / deepseek-reasoner 等 → 返回 {}（模型自带推理，无需参数）
 */
export function getThinkingParams(model: string): ThinkingAPIParams {
  if (!modelSupportsThinking(model)) return {}
  return {
    thinking: { type: 'enabled', budget_tokens: 8000 },
    max_tokens: 16000,
  }
}
