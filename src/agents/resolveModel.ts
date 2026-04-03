// src/agents/resolveModel.ts

const MODEL_ALIASES: Record<string, string> = {
  haiku:  process.env.PI_MODEL_HAIKU  ?? 'claude-haiku-4-5',
  sonnet: process.env.PI_MODEL_SONNET ?? 'claude-sonnet-4-5',
  opus:   process.env.PI_MODEL_OPUS   ?? 'claude-opus-4-5',
}

/**
 * Resolves an agent's model field to an actual model name.
 * - undefined / 'inherit' → PI_MODEL env var (same model as parent agent)
 * - 'haiku' / 'sonnet' / 'opus' → alias lookup with env override
 * - any other string → returned as-is (full model name)
 */
export function resolveModel(model?: string): string {
  const defaultModel = process.env.PI_MODEL ?? 'deepseek-chat'
  if (!model || model === 'inherit') return defaultModel
  return MODEL_ALIASES[model] ?? model
}
