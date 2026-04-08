// src/utils/apiRetry.ts
//
// API 错误重试工具 — 对标 CC src/services/api/withRetry.ts
// 指数退避 + jitter，支持 429/529/5xx 重试，401/403 不重试。

import { APIError } from '@anthropic-ai/sdk'

const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 32_000
const MAX_RETRIES = 5

export type RetryableErrorCategory = 'rate_limit' | 'server_error' | 'auth_failed' | 'unknown'

export function categorizeAPIError(error: unknown): RetryableErrorCategory {
  if (!(error instanceof APIError)) return 'unknown'
  const { status } = error
  if (status === 429 || status === 529) return 'rate_limit'
  if (status === 401 || status === 403) return 'auth_failed'
  if (status !== undefined && status >= 408) return 'server_error'
  return 'unknown'
}

export function isRetryable(error: unknown): boolean {
  const cat = categorizeAPIError(error)
  return cat === 'rate_limit' || cat === 'server_error'
}

/**
 * 计算第 attempt 次重试的等待时间（毫秒）。
 * 指数退避 + 25% jitter，遵守 Retry-After 响应头。
 */
export function getRetryDelay(attempt: number, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10)
    if (!isNaN(seconds)) return seconds * 1000
  }
  const base = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_DELAY_MS)
  const jitter = Math.random() * 0.25 * base
  return Math.round(base + jitter)
}

/**
 * 带重试的 API 调用包装器。
 * 对 rate_limit / server_error 自动重试，最多 MAX_RETRIES 次。
 * auth_failed / unknown 直接抛出。
 */
export async function withAPIRetry<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    if (signal?.aborted) throw new Error('Aborted')
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRetryable(err) || attempt > MAX_RETRIES) throw err

      const retryAfter = err instanceof APIError
        ? (err.headers?.['retry-after'] ?? null)
        : null
      const delay = getRetryDelay(attempt, retryAfter)

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay)
        signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          reject(new Error('Aborted'))
        }, { once: true })
      })
    }
  }
  throw lastError
}
