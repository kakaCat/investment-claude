// Anthropic 客户端工厂 — 统一读取环境变量，避免散落在各模块
import Anthropic from '@anthropic-ai/sdk'

export function createAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.PI_BASE_URL,
  })
}
