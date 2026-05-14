/**
 * 投资工具核心 — Python 桥接 + 市场检测
 *
 * callPython 返回原始字符串（对标 pi-investment），
 * 不做 JSON.parse，避免 is_error 包装层。
 */
import { execFile } from 'child_process'
import * as path from 'path'

const pythonScript = path.join(process.cwd(), 'python', 'akshare_bridge.py')

/**
 * 调用 Python 函数，返回原始 stdout 字符串（不解析 JSON）。
 * 与 pi-investment 保持一致：错误以 JSON 字符串返回，模型当普通文本处理。
 */
export async function callPython(
  func: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const argsJson = JSON.stringify(args)

  return new Promise<string>((resolve) => {
    const child = execFile(
      'python3',
      [pythonScript, func, argsJson],
      {
        timeout: 120_000,
        env: { ...process.env, TQDM_DISABLE: '1' },
      },
      (err, stdout, stderr) => {
        if (err) {
          const msg = stderr?.trim() || err.message
          resolve(JSON.stringify({ error: `Python调用失败: ${msg}` }))
          return
        }
        resolve(stdout.trim())
      },
    )
  })
}

/** 检测股票市场 */
export function detectMarket(symbol: string): 'ashare' | 'hk' | 'invalid' {
  const s = symbol.trim()
  if (/\.(US|SG|L|T)$/i.test(s)) return 'invalid'
  if (/\.HK$/i.test(s)) return 'hk'
  const noPrefix = s.replace(/^(sh|sz|bj)/i, '').trim()
  if (/^\d{6}$/.test(noPrefix)) return 'ashare'
  if (/^\d{1,5}$/.test(s)) return 'hk'
  return 'invalid'
}

/** 仅限A股校验：港股返回错误JSON字符串，A股返回null */
export function requireAshare(symbol: string): string | null {
  const market = detectMarket(symbol)
  if (market === 'ashare') return null
  if (market === 'hk') {
    return JSON.stringify({
      error: `本功能暂不支持港股代码 "${symbol}"。请使用 get_stock_price / get_stock_info 查询港股行情。`,
      unsupported_for_hk: true,
    })
  }
  return JSON.stringify({
    error: `不支持的股票代码 "${symbol}"。支持A股（6位数字）和港股（1-5位数字）。`,
    invalid_format: true,
  })
}
